import { calculateCustomerCharges } from "./pricing.js";
import { resolveCanonicalPaymentMethod } from "./paymentMethods.js";
import { supabase, sbSaveBooking } from "./supabase.js";

export function generateQrToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "tkn_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowDateStr() {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function nowTimeStr() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizePaymentMethod(value) {
  return resolveCanonicalPaymentMethod(value || "UPI");
}

/**
 * Generate sequential ticket number NJ26-XXXXX backed purely by Supabase bookings table.
 */
export async function nextTicketNumber() {
  try {
    const { data } = await supabase.from("bookings").select("ticket_number");
    const used = new Set(
      (data || []).map((d) => String(d.ticket_number || "")).filter(Boolean)
    );

    let seq = (data ? data.length : 0) + 1;
    let ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
    while (used.has(ticketNumber)) {
      seq += 1;
      ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
    }
    return ticketNumber;
  } catch (error) {
    console.warn("nextTicketNumber error, using random fallback:", error);
    const seq = Math.floor(Math.random() * 90000) + 10000;
    return `NJ26-${seq}`;
  }
}

/** If a caller did not pass an event, fall back to the first stored event from Supabase. */
async function resolveEventId(eventId) {
  if (eventId) return eventId;
  try {
    const { data } = await supabase.from("events").select("id").limit(1);
    return data && data[0] ? data[0].id : "";
  } catch (error) {
    console.warn("resolveEventId failed:", error?.message);
    return "";
  }
}

function normalizeSbBooking(sb) {
  return {
    key: sb.id,
    id: sb.id,
    bookingId: sb.ticket_number,
    ticketNumber: sb.ticket_number,
    showId: sb.event_id,
    eventId: sb.event_id,
    eventName: sb.event_name,
    customerName: sb.customer_name,
    customerPhone: sb.customer_phone,
    customerEmail: sb.customer_email,
    ticketTypeId: sb.ticket_type_id,
    ticketTypeName: sb.ticket_type_name,
    quantity: sb.quantity,
    unitPrice: Number(sb.unit_price) || 0,
    amount: Number(sb.amount) || 0,
    ticketAmount: Number(sb.ticket_amount) || 0,
    convenienceFee: Number(sb.convenience_fee) || 0,
    gstOnConvenienceFee: Number(sb.gst_on_convenience_fee) || 0,
    platformCharge: Number(sb.platform_charge) || 0,
    totalFees: Number(sb.total_fees) || 0,
    finalCustomerAmount: Number(sb.final_customer_amount || sb.amount) || 0,
    source: sb.source || "Online",
    paymentMethod: sb.payment_method || "UPI",
    time: sb.time,
    date: sb.date,
    bookingDate: sb.date,
    createdAt: sb.created_at,
    status: sb.status || "Confirmed",
    bookingStatus: sb.booking_status || "Confirmed",
    enteredCount: sb.entered_count || 0,
    remainingCount: sb.remaining_count || sb.quantity || 1,
    block: sb.block,
    seats: Array.isArray(sb.seats)
      ? sb.seats
      : typeof sb.seats === "string"
        ? sb.seats.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    seatCount: sb.seat_count || sb.quantity || 1,
  };
}

/**
 * Saves a booking directly into Supabase (bookings & tickets).
 */
export async function saveBooking({
  tier,
  quantity,
  paymentMethod,
  totalAmount,
  ticketAmount,
  convenienceFee,
  gstOnConvenienceFee,
  platformCharge,
  eventId,
  seats = [],
  blockId = "",
  eventName = "",
  customerName = "",
  customerPhone = "",
  date = "",
  time = "",
}) {
  if (!tier || typeof tier !== "object") {
    throw new Error("saveBooking: a ticket tier is required");
  }

  const seatList = Array.isArray(seats) ? seats.filter(Boolean) : [];
  const resolvedEventId = await resolveEventId(eventId);
  const ticketNumber = await nextTicketNumber();

  let eventDoc = null;
  if (resolvedEventId) {
    try {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("id", resolvedEventId)
        .maybeSingle();
      if (data) {
        eventDoc = data;
      }
    } catch (e) {
      console.warn("Could not fetch event for booking date/time:", e);
    }
  }

  const eventDate =
    date ||
    eventDoc?.date ||
    (eventDoc?.day_of_month && eventDoc?.month && eventDoc?.year
      ? `${eventDoc.day_of_month} ${eventDoc.month} ${eventDoc.year}`
      : "") ||
    nowDateStr();

  const eventTime =
    time ||
    eventDoc?.time ||
    eventDoc?.start_time ||
    eventDoc?.event_time ||
    "11:00 PM";

  const resolvedEventName =
    eventName ||
    eventDoc?.title ||
    eventDoc?.name ||
    eventDoc?.event_title ||
    "Event";

  // Gateway-independent charge calculation
  const count = Number(quantity) || seatList.length || 1;
  const unitPrice = Number(tier.price) || 0;
  const rawTicketAmount = Number(ticketAmount) > 0 ? Number(ticketAmount) : unitPrice * count;
  const charges = calculateCustomerCharges(rawTicketAmount);
  const finalAmount = Number(totalAmount) > 0 ? Number(totalAmount) : charges.finalCustomerAmount;

  // If seats are specified, delegate to atomic reserveSeatsTransaction in seats.js
  if (seatList.length > 0) {
    const { reserveSeatsTransaction } = await import("./seats.js");
    return reserveSeatsTransaction({
      showId: resolvedEventId,
      block: String(tier.gate || "").replace(/^Block\s+/i, "").trim(),
      seats: seatList,
      customerName,
      customerPhone,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      tier,
      eventName: resolvedEventName,
      date: eventDate,
      time: eventTime,
      ticketAmount: charges.ticketAmount,
      convenienceFee: charges.convenienceFee,
      gstOnConvenienceFee: charges.gstOnConvenienceFee,
      platformCharge: charges.platformCharge,
      totalAmount: finalAmount,
    });
  }

  const seatBlock =
    String(blockId || "").trim().toUpperCase() ||
    String(tier.gate || "").replace(/^Block\s+/i, "").trim().toUpperCase();

  if (seatBlock) {
    const { data: catData, error: catError } = await supabase
      .from("block_categories")
      .select("online, counter")
      .eq("id", seatBlock)
      .maybeSingle();

    if (!catError && catData && catData.online === false) {
      const err = new Error(
        "This block is available for counter booking only. Please select another block."
      );
      err.code = "BLOCK_COUNTER_ONLY";
      throw err;
    }
  }

  const bookingDocId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const booking = {
    bookingId: ticketNumber,
    ticketNumber,
    showId: resolvedEventId,
    eventId: resolvedEventId,
    customerName: customerName.trim() || "Walk-in",
    customerPhone: customerPhone.trim(),
    ticketTypeId: tier.id || null,
    ticketTypeName: tier.name || "General",
    quantity: count,
    unitPrice,
    ticketAmount: charges.ticketAmount,
    baseAmount: charges.ticketAmount,
    convenienceFee: charges.convenienceFee,
    gstOnConvenienceFee: charges.gstOnConvenienceFee,
    platformCharge: charges.platformCharge,
    totalFees: charges.totalFees,
    amount: finalAmount,
    finalCustomerAmount: finalAmount,
    source: "Online",
    paymentMethod: normalizePaymentMethod(paymentMethod),
    transactionId: "",
    time: eventTime,
    date: eventDate,
    bookingDate: nowDateStr(),
    bookingTime: nowTimeStr(),
    createdAt: new Date().toISOString(),
    status: "Confirmed",
    bookingStatus: "Confirmed",
    enteredCount: 0,
    remainingCount: count,
    assignedGate: tier.gate || "",
    block: seatBlock,
    seats: seatList,
    seatCount: seatList.length || count,
    eventName: resolvedEventName,
  };

  // Generate individual ticket records (one per quantity)
  const tickets = [];
  for (let i = 0; i < count; i++) {
    const individualTicketId = `${ticketNumber}-${i + 1}`;
    const individualSeat = seatList[i] || null;
    const qrToken = generateQrToken();

    tickets.push({
      ticketId: individualTicketId,
      bookingId: ticketNumber,
      bookingDocId: bookingDocId,
      ticketIndex: i + 1,
      totalTickets: count,
      showId: resolvedEventId,
      eventId: resolvedEventId,
      eventName: resolvedEventName,
      ticketTypeId: tier.id || null,
      ticketTypeName: tier.name || "General",
      seat: individualSeat,
      seatIndex: i + 1,
      seatCount: count,
      block: seatBlock,
      assignedGate: tier.gate || "",
      customerName: customerName.trim() || "Walk-in",
      customerPhone: customerPhone.trim(),
      serialNumber: individualTicketId,
      qrToken,
      status: "ACTIVE",
      date: eventDate,
      time: eventTime,
      unitPrice,
      createdAt: new Date().toISOString(),
    });
  }

  // Save to Supabase
  try {
    await sbSaveBooking({
      bookingId: bookingDocId,
      ticketNumber,
      eventId: resolvedEventId,
      eventName: resolvedEventName,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      ticketTypeId: tier.id || null,
      ticketTypeName: tier.name || "General",
      quantity: count,
      unitPrice,
      amount: finalAmount,
      ticketAmount: charges.ticketAmount,
      baseAmount: charges.ticketAmount,
      convenienceFee: charges.convenienceFee,
      gstOnConvenienceFee: charges.gstOnConvenienceFee,
      platformCharge: charges.platformCharge,
      totalFees: charges.totalFees,
      finalCustomerAmount: finalAmount,
      source: "Online",
      paymentMethod: normalizePaymentMethod(paymentMethod),
      date: eventDate,
      time: eventTime,
      block: seatBlock || null,
      seats: seatList,
      tickets,
    });
  } catch (sbErr) {
    console.error("Supabase booking save error:", sbErr?.message);
    throw new Error("Failed to save booking");
  }

  return {
    ...booking,
    tickets,
    key: bookingDocId,
    id: bookingDocId,
    bookingId: ticketNumber,
  };
}

export async function fetchTicketById(ticketId) {
  if (!ticketId) return null;
  const cleanId = String(ticketId).trim();
  try {
    // 1. Check Supabase tickets table
    const { data: sbTicket } = await supabase
      .from("tickets")
      .select("*")
      .or(`id.eq.${cleanId},ticket_id.eq.${cleanId},serial_number.eq.${cleanId}`)
      .maybeSingle();

    if (sbTicket) {
      let partyName = "";
      if (sbTicket.event_id) {
        try {
          const { data: ev } = await supabase
            .from("events")
            .select("party_name, organizer")
            .eq("id", sbTicket.event_id)
            .maybeSingle();
          if (ev) {
            partyName = ev.party_name || ev.organizer || "";
          }
        } catch {}
      }

      return {
        id: sbTicket.ticket_id || sbTicket.id,
        ticketId: sbTicket.ticket_id || sbTicket.id,
        bookingId: sbTicket.booking_id,
        bookingDocId: sbTicket.booking_doc_id || sbTicket.booking_id,
        ticketIndex: sbTicket.ticket_index || 1,
        totalTickets: sbTicket.total_tickets || 1,
        eventId: sbTicket.event_id,
        eventName: sbTicket.event_name,
        partyName,
        ticketTypeId: sbTicket.ticket_type_id || "seated",
        ticketTypeName: sbTicket.ticket_type_name || "General",
        seat: sbTicket.seat || null,
        seatIndex: sbTicket.seat_index || 1,
        seatCount: sbTicket.seat_count || 1,
        block: sbTicket.block,
        assignedGate: sbTicket.assigned_gate || (sbTicket.block ? `Block ${sbTicket.block}` : ""),
        customerName: sbTicket.customer_name,
        customerPhone: sbTicket.customer_phone,
        serialNumber: sbTicket.serial_number || sbTicket.ticket_id,
        qrToken: sbTicket.qr_token || sbTicket.ticket_id,
        status: sbTicket.status || "ACTIVE",
        date: sbTicket.date,
        time: sbTicket.time,
        scannedAt: sbTicket.scanned_at || sbTicket.scannedAt,
        scanned_at: sbTicket.scanned_at,
        scanTime: sbTicket.scan_time || sbTicket.scanTime,
        scan_time: sbTicket.scan_time,
        scanDate: sbTicket.scan_date,
        scan_date: sbTicket.scan_date,
        scannedBy: sbTicket.scanned_by || sbTicket.scanner_member_name,
        scanned_by: sbTicket.scanned_by || sbTicket.scanner_member_name,
        usedAt: sbTicket.scanned_at,
        entryTime: sbTicket.scan_time,
        unitPrice: Number(sbTicket.unit_price) || 0,
        createdAt: sbTicket.created_at || new Date().toISOString(),
      };
    }

    // 2. Fallback check booking by ticket number
    const m = cleanId.match(/^(.+)-(\d+)$/);
    const baseNumber = m ? m[1] : cleanId;
    const baseBooking = await fetchBookingByTicketNumber(baseNumber);
    if (baseBooking) {
      let partyName = baseBooking.partyName || "";
      if (!partyName && baseBooking.eventId) {
        try {
          const { data: ev } = await supabase
            .from("events")
            .select("party_name, organizer")
            .eq("id", baseBooking.eventId)
            .maybeSingle();
          if (ev) partyName = ev.party_name || ev.organizer || "";
        } catch {}
      }
      const seats = Array.isArray(baseBooking.seats) ? baseBooking.seats.filter(Boolean) : [];
      const count = seats.length || Number(baseBooking.quantity) || 1;
      const idx = m ? Number(m[2]) - 1 : 0;
      const seat = seats[idx] || null;
      const isUsed =
        baseBooking.usedTickets?.includes(cleanId) ||
        (baseBooking.usedCount && idx < baseBooking.usedCount) ||
        baseBooking.status === "Checked-in";
      return {
        id: cleanId,
        ticketId: cleanId,
        bookingId: baseBooking.ticketNumber || baseNumber,
        bookingDocId: baseBooking.id,
        ticketIndex: idx + 1,
        totalTickets: count,
        eventId: baseBooking.eventId,
        eventName: baseBooking.eventName,
        partyName,
        ticketTypeId: baseBooking.ticketTypeId,
        ticketTypeName: baseBooking.ticketTypeName,
        seat,
        seatIndex: idx + 1,
        seatCount: count,
        block: baseBooking.block,
        assignedGate: baseBooking.assignedGate,
        customerName: baseBooking.customerName,
        customerPhone: baseBooking.customerPhone,
        serialNumber: cleanId,
        qrToken: cleanId,
        status: isUsed ? "ENTERED" : "ACTIVE",
        date: baseBooking.date,
        time: baseBooking.time,
        scannedAt: baseBooking.scannedAt || baseBooking.usedAt,
        scanned_at: baseBooking.scannedAt || baseBooking.usedAt,
        usedAt: baseBooking.usedAt || baseBooking.scannedAt,
        scanTime: baseBooking.scanTime,
        scan_time: baseBooking.scanTime,
        scannedBy: baseBooking.scannedBy,
        entryTime: baseBooking.scanTime,
        unitPrice: baseBooking.unitPrice,
        createdAt: baseBooking.createdAt || new Date().toISOString(),
      };
    }

    return null;
  } catch (error) {
    console.error("fetchTicketById error:", error);
    return null;
  }
}

export function subscribeTicketById(ticketId, callback) {
  if (!ticketId) return () => {};
  const cleanId = String(ticketId).trim();
  let disposed = false;

  fetchTicketById(cleanId)
    .then((t) => {
      if (!disposed) callback(t);
    })
    .catch(() => {
      if (!disposed) callback(null);
    });

  let channel = null;
  try {
    channel = supabase
      .channel(`sb-ticket-${cleanId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async () => {
          if (disposed) return;
          try {
            const updated = await fetchTicketById(cleanId);
            if (!disposed) callback(updated);
          } catch (e) {}
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("subscribeTicketById channel setup error:", err);
  }

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export function subscribeAllTickets(callback) {
  let disposed = false;

  const mapSbTicket = (t) => ({
    id: t.ticket_id || t.id,
    ticketId: t.ticket_id || t.id,
    bookingId: t.booking_id,
    bookingDocId: t.booking_doc_id || t.booking_id,
    ticketIndex: t.ticket_index || 1,
    totalTickets: t.total_tickets || 1,
    eventId: t.event_id,
    eventName: t.event_name,
    ticketTypeId: t.ticket_type_id || "seated",
    ticketTypeName: t.ticket_type_name || "General",
    seat: t.seat || null,
    seatIndex: t.seat_index || 1,
    seatCount: t.seat_count || 1,
    block: t.block,
    assignedGate: t.assigned_gate || (t.block ? `Block ${t.block}` : ""),
    customerName: t.customer_name,
    customerPhone: t.customer_phone,
    serialNumber: t.serial_number || t.ticket_id,
    qrToken: t.qr_token || t.ticket_id,
    status: t.status || "ACTIVE",
    date: t.date,
    time: t.time,
    scannedAt: t.scanned_at || t.scannedAt,
    scanned_at: t.scanned_at,
    scanTime: t.scan_time || t.scanTime,
    scan_time: t.scan_time,
    scanDate: t.scan_date,
    scan_date: t.scan_date,
    scannedBy: t.scanned_by || t.scanner_member_name,
    usedAt: t.scanned_at,
    entryTime: t.scan_time,
    unitPrice: Number(t.unit_price) || 0,
    createdAt: t.created_at || new Date().toISOString(),
  });

  const fetchAll = async () => {
    try {
      const { data } = await supabase.from("tickets").select("*");
      if (Array.isArray(data) && !disposed) {
        callback(data.map(mapSbTicket));
      }
    } catch (e) {
      console.warn("subscribeAllTickets error:", e);
    }
  };

  fetchAll();

  let channel = null;
  try {
    channel = supabase
      .channel(`sb-all-tickets-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        fetchAll
      )
      .subscribe();
  } catch (e) {}

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export function subscribeTicketsByBookingId(bookingId, callback) {
  if (!bookingId) return () => {};
  const cleanId = String(bookingId).trim();
  let disposed = false;

  const fetchBookingTickets = async () => {
    try {
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .or(`booking_id.eq.${cleanId},booking_doc_id.eq.${cleanId}`);
      if (!disposed && Array.isArray(data)) {
        callback(
          data.map((t) => ({
            id: t.ticket_id || t.id,
            ticketId: t.ticket_id || t.id,
            bookingId: t.booking_id,
            ...t,
          }))
        );
      }
    } catch (e) {
      if (!disposed) callback([]);
    }
  };

  fetchBookingTickets();

  let channel = null;
  try {
    channel = supabase
      .channel(`sb-booking-tickets-${cleanId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        fetchBookingTickets
      )
      .subscribe();
  } catch (err) {}

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export async function fetchBookings() {
  const list = [];
  try {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (Array.isArray(data)) {
      list.push(...data.map(normalizeSbBooking));
    }
  } catch (err) {
    console.warn("fetchBookings error:", err);
  }

  return list;
}

export function subscribeBookings(callback) {
  let disposed = false;

  const fetchAll = async () => {
    try {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (Array.isArray(data) && !disposed) {
        callback(data.map(normalizeSbBooking));
      }
    } catch (err) {
      console.warn("subscribeBookings error:", err);
    }
  };

  fetchAll();

  let channel = null;
  try {
    channel = supabase
      .channel(`sb-bookings-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        fetchAll
      )
      .subscribe();
  } catch (e) {}

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export async function fetchBookingByTicketNumber(ticketNumber) {
  if (!ticketNumber) return null;
  const cleanNumber = String(ticketNumber).trim();
  try {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .or(`ticket_number.eq.${cleanNumber},id.eq.${cleanNumber}`)
      .maybeSingle();

    if (data) return normalizeSbBooking(data);
  } catch (err) {
    console.warn("fetchBookingByTicketNumber error:", err);
  }

  return null;
}

export async function updateBookingStatus(ticketNumber, status) {
  try {
    await supabase
      .from("bookings")
      .update({
        status,
        booking_status: status,
        updated_at: new Date().toISOString(),
      })
      .or(`ticket_number.eq.${ticketNumber},id.eq.${ticketNumber}`);
  } catch (err) {
    console.error("updateBookingStatus error:", err);
  }
}

export function subscribeBookingByTicketNumber(ticketNumber, callback) {
  if (!ticketNumber) return () => {};
  let disposed = false;

  const fetchSingle = async () => {
    const b = await fetchBookingByTicketNumber(ticketNumber);
    if (!disposed) callback(b);
  };

  fetchSingle();

  let channel = null;
  try {
    channel = supabase
      .channel(`sb-booking-${ticketNumber}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        fetchSingle
      )
      .subscribe();
  } catch (e) {}

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export function subscribeTicketEntries(callback) {
  let disposed = false;
  let lastSbTickets = [];
  let lastSbEntries = [];

  const emit = () => {
    if (disposed) return;
    const map = new Map();

    const addEntry = (item) => {
      const tid = String(item.ticket_id || item.ticketId || item.ticket_number || item.ticketNumber || item.id || "").trim().toUpperCase();
      const bid = String(item.booking_id || item.bookingId || item.baseTicketNumber || "").trim().toUpperCase();
      if (!tid && !bid) return;

      const key = `${tid}__${bid}__${item.scanned_at || item.scannedAt || ""}`;
      map.set(key, {
        id: item.id || tid,
        ticketId: tid,
        ticket_id: tid,
        ticketNumber: tid,
        ticket_number: tid,
        bookingId: bid,
        booking_id: bid,
        seat: item.seat || item.seat_label || "",
        seat_label: item.seat_label || item.seat || "",
        status: item.status || item.entry_status || "entered",
        entryStatus: item.entry_status || item.status || "entered",
        entry_status: item.entry_status || item.status || "entered",
        scanResult: String(item.scan_result || item.scanResult || "SUCCESS").toUpperCase(),
        scan_result: String(item.scan_result || item.scanResult || "SUCCESS").toUpperCase(),
        scannedAt: item.scanned_at || item.scannedAt || new Date().toISOString(),
        scanned_at: item.scanned_at || item.scannedAt || new Date().toISOString(),
        scanTime: item.scan_time || item.scanTime || "",
        scan_time: item.scan_time || item.scanTime || "",
        scannedBy: item.scanned_by || item.scannedBy || item.scanner_name || item.scannerName || "",
      });
    };

    lastSbEntries.forEach(addEntry);
    lastSbTickets.forEach(addEntry);

    callback(Array.from(map.values()));
  };

  // 1. Fetch & Listen to Supabase ticket_entries
  const fetchSbEntries = async () => {
    try {
      const { data } = await supabase
        .from("ticket_entries")
        .select("*")
        .order("scanned_at", { ascending: false })
        .limit(200);

      if (!disposed && Array.isArray(data)) {
        lastSbEntries = data;
        emit();
      }
    } catch (e) {}
  };

  // 2. Fetch & Listen to Supabase tickets (entered)
  const fetchSbTickets = async () => {
    try {
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .or("status.eq.ENTERED,status.eq.USED")
        .limit(200);

      if (!disposed && Array.isArray(data)) {
        lastSbTickets = data;
        emit();
      }
    } catch (e) {}
  };

  fetchSbEntries();
  fetchSbTickets();

  let sbChannel1 = null;
  let sbChannel2 = null;
  try {
    sbChannel1 = supabase
      .channel(`sb-entries-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_entries" }, fetchSbEntries)
      .subscribe();

    sbChannel2 = supabase
      .channel(`sb-entered-t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, fetchSbTickets)
      .subscribe();
  } catch (e) {}

  return () => {
    disposed = true;
    if (sbChannel1) supabase.removeChannel(sbChannel1);
    if (sbChannel2) supabase.removeChannel(sbChannel2);
  };
}

export function parseEventDate(dateStr, timeStr = "") {
  if (!dateStr) return null;
  const normalizedDate = String(dateStr).replace(/\bSept\b/gi, "Sep").trim();
  const timestamp = Date.parse(normalizedDate);
  if (isNaN(timestamp)) return null;

  const d = new Date(timestamp);

  const rangeMatch = String(timeStr).match(/[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (rangeMatch) {
    let endHours = parseInt(rangeMatch[1], 10);
    const endMinutes = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const endMeridiem = (rangeMatch[3] || "").toLowerCase();
    if (endMeridiem === "pm" && endHours < 12) endHours += 12;
    if (endMeridiem === "am" && endHours === 12) endHours = 0;

    const isOvernight = /pm/i.test(timeStr.split(/[-–—to]/)[0] || "") && endMeridiem === "am";
    if (isOvernight) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(endHours + 2, endMinutes, 0, 0);
    return d;
  }

  const startMatch = String(timeStr).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (startMatch) {
    let startHours = parseInt(startMatch[1], 10);
    const startMeridiem = (startMatch[3] || "").toLowerCase();
    if (startMeridiem === "pm" && startHours < 12) startHours += 12;
    if (startHours >= 18) {
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }
  }

  d.setHours(23, 59, 59, 999);
  return d;
}

export function isEventDateExpired(dateStr, timeStr = "") {
  const d = parseEventDate(dateStr, timeStr);
  if (!d) return false;
  return d.getTime() < Date.now();
}

export function getTicketStatus(ticket, usedCodesSet = new Set(), parentBooking = null) {
  const booking = parentBooking || ticket;

  const ticketRecordStatus = String(ticket?.status || "").toUpperCase();
  if (ticketRecordStatus === "ENTERED" || ticketRecordStatus === "USED") {
    return "used";
  }
  if (ticketRecordStatus === "CANCELLED" || ticketRecordStatus === "CANCELED") {
    return "cancelled";
  }

  // Explicit scan timestamp on ticket
  if (ticket?.scannedAt || ticket?.scanned_at || ticket?.usedAt || ticket?.used_at) {
    return "used";
  }

  const rawStatus = String(booking?.status || booking?.bookingStatus || booking?.booking_status || "").trim().toLowerCase();

  if (
    rawStatus === "cancelled" ||
    rawStatus === "canceled" ||
    rawStatus === "refunded" ||
    rawStatus === "failed"
  ) {
    return "cancelled";
  }

  const specificTicket = String(ticket?.ticketNumber || ticket?.ticket_number || ticket?.ticketId || ticket?.ticket_id || ticket?.serial || "").toUpperCase();
  const baseTicket = String(ticket?.baseTicketNumber || ticket?.bookingId || ticket?.booking_id || booking?.ticket_number || booking?.ticketNumber || "").toUpperCase();
  const seat = String(ticket?.seat || ticket?.seat_label || "").trim().toUpperCase();

  const bUsedTickets = (Array.isArray(booking?.usedTickets || booking?.used_tickets) ? (booking?.usedTickets || booking?.used_tickets) : []).map((s) => String(s).toUpperCase());
  const bUsedSeats = (Array.isArray(booking?.usedSeats || booking?.used_seats) ? (booking?.usedSeats || booking?.used_seats) : []).map((s) => String(s).toUpperCase());
  const totalCount = Number(
    booking?.seatCount ||
    booking?.seat_count ||
    booking?.quantity ||
    (Array.isArray(booking?.seats) ? booking.seats.length : 1) ||
    1
  );
  const isMultiTicket = totalCount > 1;

  const isSpecificCodeInEntries = Boolean(
    (specificTicket && usedCodesSet.has(specificTicket)) ||
    (baseTicket && !isMultiTicket && usedCodesSet.has(baseTicket))
  );
  const isSpecificInUsedTickets = Boolean(specificTicket && bUsedTickets.includes(specificTicket));
  const isSeatInUsedSeats = Boolean(seat && bUsedSeats.includes(seat));
  const isSpecificExplicitlyUsed = Boolean(ticket?.isUsed);

  if (isSpecificCodeInEntries || isSpecificInUsedTickets || isSeatInUsedSeats || isSpecificExplicitlyUsed) {
    return "used";
  }

  if (isMultiTicket) {
    if (bUsedTickets.length > 0 && specificTicket && !bUsedTickets.includes(specificTicket)) {
      if (rawStatus === "expired" || isEventDateExpired(booking?.date || ticket?.date, booking?.time || ticket?.time)) {
        return "expired";
      }
      return "upcoming";
    }

    if (bUsedSeats.length > 0 && seat && !bUsedSeats.includes(seat)) {
      if (rawStatus === "expired" || isEventDateExpired(booking?.date || ticket?.date, booking?.time || ticket?.time)) {
        return "expired";
      }
      return "upcoming";
    }

    const scannedCount = Number(booking?.usedCount || booking?.used_count || booking?.entered_count || 0) || bUsedTickets.length || bUsedSeats.length;
    if (scannedCount > 0 && scannedCount < totalCount) {
      const idx = Number(ticket?.seatIndex || ticket?.ticketIndex || 1);
      if (idx > scannedCount) {
        if (rawStatus === "expired" || isEventDateExpired(booking?.date || ticket?.date, booking?.time || ticket?.time)) {
          return "expired";
        }
        return "upcoming";
      }
      return "used";
    }
  }

  const isSingleBookingUsed =
    !isMultiTicket &&
    (rawStatus === "used" ||
      rawStatus === "checked-in" ||
      rawStatus === "checkedin" ||
      rawStatus === "checked in" ||
      rawStatus === "entered" ||
      rawStatus === "admitted" ||
      Boolean(booking?.usedAt || booking?.used_at) ||
      Boolean(booking?.scannedAt || booking?.scanned_at) ||
      (baseTicket && usedCodesSet.has(baseTicket)));

  if (isSingleBookingUsed) {
    return "used";
  }

  const effectiveUsedCount = Number(booking?.usedCount || booking?.used_count || booking?.entered_count || bUsedTickets.length);
  if (isMultiTicket && (rawStatus === "used" || rawStatus === "checked-in" || effectiveUsedCount >= totalCount)) {
    return "used";
  }

  if (rawStatus === "expired" || isEventDateExpired(booking?.date || ticket?.date, booking?.time || ticket?.time)) {
    return "expired";
  }

  return "upcoming";
}
