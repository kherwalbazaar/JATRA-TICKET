import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./firebase.js";
import { calculateCustomerCharges } from "./pricing.js";

const FIRESTORE_BOOKINGS = "bookings";
const FIRESTORE_TICKETS = "tickets";
const FIRESTORE_EVENTS = "events";

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
  if (value === "upi" || value === "UPI") return "UPI";
  if (value === "cash" || value === "Cash") return "Cash";
  return "Card";
}

/**
 * Ticket numbers live in Firestore only — the admin panel and the gate
 * scanner both look bookings up by `bookings.ticketNumber`, so it must be
 * generated from the same collection both of them read.
 */
async function nextTicketNumber() {
  const snap = await getDocs(collection(firestore, FIRESTORE_BOOKINGS));
  const used = new Set(
    snap.docs.map((d) => String(d.data()?.ticketNumber || "")).filter(Boolean),
  );

  let seq = snap.size + 1;
  let ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
  while (used.has(ticketNumber)) {
    seq += 1;
    ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
  }
  return ticketNumber;
}

/** If a caller did not pass an event, fall back to the first stored event. */
async function resolveEventId(eventId) {
  if (eventId) return eventId;
  try {
    const snap = await getDocs(collection(firestore, FIRESTORE_EVENTS));
    return snap.empty ? "" : snap.docs[0].id;
  } catch (error) {
    console.warn("resolveEventId failed:", error?.message);
    return "";
  }
}

/**
 * Saves a booking into the shared `bookings` collection.
 *
 * The ADMIN panel (BookingsView), the POS counter and the gate scanner all
 * read this collection, so every field below matches `BookingItem` in
 * JATRA BAZAAR ADMIN/src/types/index.ts.
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
      const snap = await getDoc(doc(firestore, FIRESTORE_EVENTS, resolvedEventId));
      if (snap.exists()) {
        eventDoc = snap.data();
      }
    } catch (e) {
      console.warn("Could not fetch event for booking date/time:", e);
    }
  }

  const eventDate =
    date ||
    eventDoc?.date ||
    (eventDoc?.dayOfMonth && eventDoc?.month && eventDoc?.year
      ? `${eventDoc.dayOfMonth} ${eventDoc.month} ${eventDoc.year}`
      : "") ||
    nowDateStr();

  const eventTime =
    time ||
    eventDoc?.time ||
    eventDoc?.startTime ||
    eventDoc?.eventTime ||
    "11:00 PM";

  const resolvedEventName =
    eventName ||
    eventDoc?.eventTitle ||
    eventDoc?.title ||
    eventDoc?.name ||
    "Event";

  // Gateway-independent charge calculation
  const count = Number(quantity) || seatList.length || 1;
  const unitPrice = Number(tier.price) || 0;
  const rawTicketAmount = Number(ticketAmount) > 0 ? Number(ticketAmount) : (unitPrice * count);
  const charges = calculateCustomerCharges(rawTicketAmount);

  const booking = {
    bookingId: ticketNumber,
    ticketNumber,
    eventId: resolvedEventId,
    customerName: customerName.trim() || "Walk-in",
    customerPhone: customerPhone.trim(),
    ticketTypeId: tier.id || "seated",
    ticketTypeName: tier.name || "General",
    quantity: count,
    unitPrice,
    ticketAmount: charges.ticketAmount,
    baseAmount: charges.ticketAmount,
    convenienceFee: charges.convenienceFee,
    gstOnConvenienceFee: charges.gstOnConvenienceFee,
    platformCharge: charges.platformCharge,
    totalFees: charges.totalFees,
    amount: charges.finalCustomerAmount,
    finalCustomerAmount: charges.finalCustomerAmount,
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
    block: String(tier.gate || "").replace(/^Block\s+/i, "").trim(),
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
      ticketIndex: i + 1,
      totalTickets: count,
      eventId: resolvedEventId,
      eventName: resolvedEventName,
      ticketTypeId: tier.id || "seated",
      ticketTypeName: tier.name || "General",
      seat: individualSeat,
      seatIndex: i + 1,
      seatCount: count,
      block: String(tier.gate || "").replace(/^Block\s+/i, "").trim(),
      assignedGate: tier.gate || "",
      customerName: customerName.trim() || "Walk-in",
      customerPhone: customerPhone.trim(),
      serialNumber: individualTicketId,
      qrToken,
      status: "ACTIVE",
      date: eventDate,
      time: eventTime,
      unitPrice,
      scannedAt: null,
      scannedBy: null,
      scannerMemberId: null,
      scannerMemberName: null,
      scanGateId: null,
      scanDate: null,
      scanTime: null,
      createdAt: new Date().toISOString(),
    });
  }

  try {
    const batch = writeBatch(firestore);
    const bookingDocRef = doc(collection(firestore, FIRESTORE_BOOKINGS));
    batch.set(bookingDocRef, booking);

    for (const t of tickets) {
      const ticketDocRef = doc(firestore, FIRESTORE_TICKETS, t.ticketId);
      batch.set(ticketDocRef, {
        ...t,
        bookingDocId: bookingDocRef.id,
      });
    }

    await batch.commit();
    return {
      ...booking,
      tickets,
      key: bookingDocRef.id,
      id: bookingDocRef.id,
      bookingId: ticketNumber,
    };
  } catch (error) {
    console.error("Firestore write failed:", error);
    throw new Error("Failed to save booking");
  }
}

export async function fetchTicketById(ticketId) {
  if (!ticketId) return null;
  const cleanId = String(ticketId).trim();
  try {
    // 1. Check tickets collection by document ID
    const snap = await getDoc(doc(firestore, FIRESTORE_TICKETS, cleanId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }

    // 2. Query tickets where ticketId == cleanId
    const q = query(
      collection(firestore, FIRESTORE_TICKETS),
      where("ticketId", "==", cleanId),
    );
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const d = qSnap.docs[0];
      return { id: d.id, ...d.data() };
    }

    // 3. Fallback for legacy bookings where tickets were not written as separate docs
    const m = cleanId.match(/^(.+)-(\d+)$/);
    const baseNumber = m ? m[1] : cleanId;
    const baseBooking = await fetchBookingByTicketNumber(baseNumber);
    if (baseBooking) {
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
  try {
    const ticketDocRef = doc(firestore, FIRESTORE_TICKETS, cleanId);
    return onSnapshot(
      ticketDocRef,
      (snap) => {
        if (snap.exists()) {
          callback({ id: snap.id, ...snap.data() });
        } else {
          fetchTicketById(cleanId).then(callback).catch(() => callback(null));
        }
      },
      (error) => {
        console.warn("subscribeTicketById error, falling back to fetch:", error);
        fetchTicketById(cleanId).then(callback).catch(() => callback(null));
      },
    );
  } catch (error) {
    console.warn("subscribeTicketById setup error:", error);
    return () => {};
  }
}

export function subscribeAllTickets(callback) {
  try {
    const q = query(collection(firestore, FIRESTORE_TICKETS));
    return onSnapshot(
      q,
      (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("subscribeAllTickets error:", err);
        callback([]);
      },
    );
  } catch (err) {
    console.warn("subscribeAllTickets setup error:", err);
    return () => {};
  }
}

export function subscribeTicketsByBookingId(bookingId, callback) {
  if (!bookingId) return () => {};
  try {
    const q = query(
      collection(firestore, FIRESTORE_TICKETS),
      where("bookingId", "==", String(bookingId).trim()),
    );
    return onSnapshot(
      q,
      (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("subscribeTicketsByBookingId error:", err);
        callback([]);
      },
    );
  } catch (err) {
    console.warn("subscribeTicketsByBookingId setup error:", err);
    return () => {};
  }
}

export async function fetchBookings() {
  const snap = await getDocs(collection(firestore, FIRESTORE_BOOKINGS));
  return snap.docs.map((d) => ({ key: d.id, id: d.id, ...d.data() }));
}

export function subscribeBookings(callback) {
  try {
    const q = query(collection(firestore, FIRESTORE_BOOKINGS));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ key: d.id, id: d.id, ...d.data() })));
    });
  } catch (error) {
    console.error("Failed to subscribe to Firestore bookings:", error);
    return () => {};
  }
}

export async function fetchBookingByTicketNumber(ticketNumber) {
  try {
    const q = query(
      collection(firestore, FIRESTORE_BOOKINGS),
      where("ticketNumber", "==", ticketNumber),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { key: d.id, id: d.id, ...d.data() };
  } catch (error) {
    console.error("Failed to fetch booking:", error);
    return null;
  }
}

export async function updateBookingStatus(ticketNumber, status) {
  try {
    const q = query(
      collection(firestore, FIRESTORE_BOOKINGS),
      where("ticketNumber", "==", ticketNumber),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(firestore, FIRESTORE_BOOKINGS, d.id), { status });
    }
  } catch (error) {
    console.error("Booking status update failed:", error);
  }
}

export function subscribeBookingByTicketNumber(ticketNumber, callback) {
  try {
    const q = query(
      collection(firestore, FIRESTORE_BOOKINGS),
      where("ticketNumber", "==", ticketNumber),
    );
    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          callback(null);
        } else {
          const d = snap.docs[0];
          callback({ key: d.id, id: d.id, ...d.data() });
        }
      },
      (error) => {
        console.error("Failed to subscribe to booking by ticketNumber:", error);
        callback(null);
      },
    );
  } catch (error) {
    console.error("subscribeBookingByTicketNumber error:", error);
    return () => {};
  }
}

export function subscribeTicketEntries(callback) {
  try {
    const q = query(collection(firestore, "ticketEntries"));
    return onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs.map((d) => ({
          key: d.id,
          id: d.id,
          ...d.data(),
        }));
        callback(entries);
      },
      (error) => {
        console.warn("Failed to subscribe to ticketEntries:", error?.message);
        callback([]);
      },
    );
  } catch (error) {
    console.warn("subscribeTicketEntries setup error:", error?.message);
    return () => {};
  }
}

export function parseEventDate(dateStr, timeStr = "") {
  if (!dateStr) return null;
  // Normalize "Sept" -> "Sep" for JavaScript Date parser compatibility across browsers
  const normalizedDate = String(dateStr).replace(/\bSept\b/gi, "Sep").trim();
  const timestamp = Date.parse(normalizedDate);
  if (isNaN(timestamp)) return null;

  const d = new Date(timestamp);

  // Check if timeStr contains an end time, e.g. "11:00 PM - 5:00 AM" or "6 PM - 10 PM"
  const rangeMatch = String(timeStr).match(/[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (rangeMatch) {
    let endHours = parseInt(rangeMatch[1], 10);
    const endMinutes = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const endMeridiem = (rangeMatch[3] || "").toLowerCase();
    if (endMeridiem === "pm" && endHours < 12) endHours += 12;
    if (endMeridiem === "am" && endHours === 12) endHours = 0;

    // Overnight event check: start was PM and end is AM
    const isOvernight = /pm/i.test(timeStr.split(/[-–—to]/)[0] || "") && endMeridiem === "am";
    if (isOvernight) {
      d.setDate(d.getDate() + 1);
    }
    // Buffer of 2 hours after event finishes
    d.setHours(endHours + 2, endMinutes, 0, 0);
    return d;
  }

  // Check if start time is evening (6 PM or later) -> overnight Jatra show, valid until noon next day
  const startMatch = String(timeStr).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (startMatch) {
    let startHours = parseInt(startMatch[1], 10);
    const startMeridiem = (startMatch[3] || "").toLowerCase();
    if (startMeridiem === "pm" && startHours < 12) startHours += 12;
    if (startHours >= 18) {
      // Night/evening event: keep valid until 12:00 PM (noon) next day
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }
  }

  // Default: End of event day so it doesn't expire prematurely on the day of the event
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isEventDateExpired(dateStr, timeStr = "") {
  const d = parseEventDate(dateStr, timeStr);
  if (!d) return false;
  return d.getTime() < Date.now();
}

/**
 * Robust status resolver handling both single and multi-seat/multi-ticket bookings,
 * ensuring scanning 1 ticket marks ONLY that specific ticket as used while
 * leaving other tickets active.
 */
export function getTicketStatus(ticket, usedCodesSet = new Set(), parentBooking = null) {
  const booking = parentBooking || ticket;

  // Direct status on individual ticket record
  const ticketRecordStatus = String(ticket?.status || "").toUpperCase();
  if (ticketRecordStatus === "ENTERED") {
    return "used";
  }
  if (ticketRecordStatus === "CANCELLED" || ticketRecordStatus === "CANCELED") {
    return "cancelled";
  }

  const rawStatus = String(booking?.status || booking?.bookingStatus || "").trim().toLowerCase();

  // 1. Cancelled or refunded
  if (
    rawStatus === "cancelled" ||
    rawStatus === "canceled" ||
    rawStatus === "refunded" ||
    rawStatus === "failed"
  ) {
    return "cancelled";
  }

  const specificTicket = String(ticket?.ticketNumber || ticket?.serial || "").toUpperCase();
  const baseTicket = String(ticket?.baseTicketNumber || booking?.ticketNumber || "").toUpperCase();
  const seat = String(ticket?.seat || "").trim().toUpperCase();

  const bUsedTickets = (Array.isArray(booking?.usedTickets) ? booking.usedTickets : []).map((s) => String(s).toUpperCase());
  const bUsedSeats = (Array.isArray(booking?.usedSeats) ? booking.usedSeats : []).map((s) => String(s).toUpperCase());
  const totalCount = Number(
    booking?.seatCount ||
    booking?.quantity ||
    (Array.isArray(booking?.seats) ? booking.seats.length : 1) ||
    1
  );
  const isMultiTicket = totalCount > 1;

  // Direct match on this specific ticket or seat
  const isSpecificCodeInEntries = Boolean(specificTicket && usedCodesSet.has(specificTicket));
  const isSpecificInUsedTickets = Boolean(specificTicket && bUsedTickets.includes(specificTicket));
  const isSeatInUsedSeats = Boolean(seat && bUsedSeats.includes(seat));
  const isSpecificExplicitlyUsed = Boolean(ticket?.isUsed);

  if (isSpecificCodeInEntries || isSpecificInUsedTickets || isSeatInUsedSeats || isSpecificExplicitlyUsed) {
    return "used";
  }

  // Multi-ticket booking handling:
  if (isMultiTicket) {
    // If specific used records exist and this ticket is NOT in them, it is NOT used!
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

    // If booking doc itself was marked "Used", but usedCount indicates only partial scans:
    const scannedCount = Number(booking?.usedCount || 0) || bUsedTickets.length || bUsedSeats.length;
    if (scannedCount > 0 && scannedCount < totalCount) {
      const idx = Number(ticket?.seatIndex || 1);
      if (idx > scannedCount) {
        if (rawStatus === "expired" || isEventDateExpired(booking?.date || ticket?.date, booking?.time || ticket?.time)) {
          return "expired";
        }
        return "upcoming";
      }
      return "used";
    }
  }

  // Single ticket booking:
  const isSingleBookingUsed =
    !isMultiTicket &&
    (rawStatus === "used" ||
      rawStatus === "checked-in" ||
      rawStatus === "checkedin" ||
      rawStatus === "checked in" ||
      rawStatus === "entered" ||
      rawStatus === "admitted" ||
      Boolean(booking?.usedAt) ||
      Boolean(booking?.scannedAt) ||
      (baseTicket && usedCodesSet.has(baseTicket)));

  if (isSingleBookingUsed) {
    return "used";
  }

  // All tickets on booking confirmed used
  if (isMultiTicket && (rawStatus === "used" || rawStatus === "checked-in") && bUsedTickets.length >= totalCount) {
    return "used";
  }

  // 3. Expired
  if (rawStatus === "expired" || isEventDateExpired(booking?.date || ticket?.date, booking?.time || ticket?.time)) {
    return "expired";
  }

  return "upcoming";
}


