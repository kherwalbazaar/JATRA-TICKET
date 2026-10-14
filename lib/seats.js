import { calculateCustomerCharges } from "./pricing.js";
import {
  supabase,
  sbFetchSeats,
  subscribeRealtimeSeats,
  sbHoldSeat,
  sbReleaseSeatHold,
  sbSaveBooking,
} from "./supabase.js";
import { nextTicketNumber, generateQrToken } from "./bookings.js";
import { firestore } from "./firebase.js";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";

// Block definitions for the venue
const BLOCK_GROUPS = {
  rightSide: ["A1", "A2", "A3"],
  frontCenter: ["B1", "B2", "B3"],
  leftSide: ["C1", "C2", "C3"],
};

const BLOCK_SEATS = {
  A1: generateRows(8, 10),
  A2: generateRows(6, 8),
  A3: generateRows(5, 6),
  B1: generateRows(8, 15),
  B2: generateRows(6, 12),
  B3: generateRows(6, 10),
  C1: generateRows(8, 12),
  C2: generateRows(6, 8),
  C3: generateRows(5, 6),
};

function generateRows(count, startSeats) {
  return Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    count: startSeats + i,
  }));
}

// Generate B block seats with continuous alphabet
function generateBBlockSeats() {
  const seats = {};
  let currentLetter = 0;
  const b1Rows = Array.isArray(BLOCK_SEATS?.B1) ? BLOCK_SEATS.B1 : [];
  const b2Rows = Array.isArray(BLOCK_SEATS?.B2) ? BLOCK_SEATS.B2 : [];
  const b3Rows = Array.isArray(BLOCK_SEATS?.B3) ? BLOCK_SEATS.B3 : [];

  // Generate B1 seats (RIGHT → LEFT)
  seats.B1 = [];
  for (let i = 0; i < b1Rows.length; i++) {
    const row = b1Rows[i];
    const seatsInRow = [];
    for (let j = 0; j < row.count; j++) {
      const letter = String.fromCharCode(65 + (currentLetter % 26));
      seatsInRow.push({
        letter: letter,
        number: j + 1,
        displayIndex: row.count - 1 - j,
        seatId: `${letter}${j + 1}`,
      });
      currentLetter++;
    }
    seats.B1.push(seatsInRow);
  }

  // Generate B2 seats (RIGHT → LEFT, continues alphabet)
  seats.B2 = [];
  for (let i = 0; i < b2Rows.length; i++) {
    const row = b2Rows[i];
    const seatsInRow = [];
    for (let j = 0; j < row.count; j++) {
      const letter = String.fromCharCode(65 + (currentLetter % 26));
      seatsInRow.push({
        letter: letter,
        number: j + 1,
        displayIndex: row.count - 1 - j,
        seatId: `${letter}${j + 1}`,
      });
      currentLetter++;
    }
    seats.B2.push(seatsInRow);
  }

  // Generate B3 seats (LEFT → RIGHT, continues alphabet)
  seats.B3 = [];
  for (let i = 0; i < b3Rows.length; i++) {
    const row = b3Rows[i];
    const seatsInRow = [];
    for (let j = 0; j < row.count; j++) {
      const letter = String.fromCharCode(65 + (currentLetter % 26));
      seatsInRow.push({
        letter: letter,
        number: j + 1,
        displayIndex: j,
        seatId: `${letter}${j + 1}`,
      });
      currentLetter++;
    }
    seats.B3.push(seatsInRow);
  }

  return seats;
}

/**
 * Admin batch seat creation function targeting Supabase seats table.
 */
export async function storeAllSeats(showId) {
  const targetId = String(showId || "").trim();
  if (!targetId) throw new Error("storeAllSeats: showId is required");

  // Safeguard: never overwrite or inject fake seats if seats already exist in database
  const { data: existing } = await supabase
    .from("seats")
    .select("id")
    .eq("event_id", targetId)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`Real seats already exist for event ${targetId}, aborting generator to preserve real database rows.`);
    return existing.length;
  }

  const bBlockSeats = generateBBlockSeats();
  const seatsToStore = [];

  // Prepare regular blocks (A1, A2, A3, C1, C2, C3)
  for (const [blockId, rows] of Object.entries(BLOCK_SEATS)) {
    if (["B1", "B2", "B3"].includes(blockId)) continue;

    for (const row of rows) {
      for (let seatNum = 1; seatNum <= row.count; seatNum++) {
        const docId = `${blockId}-${row.id}-${seatNum}`;
        seatsToStore.push({
          id: docId,
          seat_id: docId,
          show_id: targetId,
          event_id: targetId,
          block: blockId,
          block_id: blockId,
          row: row.id,
          row_id: row.id,
          seat_number: seatNum,
          seat_label: `${row.id}${seatNum}`,
          status: "available",
          price: 100,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  // Prepare B blocks (B1, B2, B3)
  for (const blockId of ["B1", "B2", "B3"]) {
    const blockData = bBlockSeats[blockId];
    if (!blockData) continue;

    for (const row of blockData) {
      for (const seat of row) {
        const docId = `${blockId}-${seat.letter}-${seat.number}`;
        seatsToStore.push({
          id: docId,
          seat_id: docId,
          show_id: targetId,
          event_id: targetId,
          block: blockId,
          block_id: blockId,
          row: seat.letter,
          row_id: seat.letter,
          seat_number: seat.number,
          seat_label: seat.seatId,
          status: "available",
          price: 100,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < seatsToStore.length; i += CHUNK_SIZE) {
    const chunk = seatsToStore.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("seats").upsert(chunk);
    if (error) {
      console.warn("storeAllSeats chunk upsert warning:", error.message);
    }
  }

  console.log(`Stored ${seatsToStore.length} seats to Supabase seats table`);
  return seatsToStore.length;
}

function normalizeSbSeat(row, targetId) {
  if (!row) return null;
  const block = String(row.block_id || row.block || "").toUpperCase();
  const rowId = String(row.row_id || row.row || "").toUpperCase();
  const seatNum = Number(row.seat_number || row.number || 0);
  const seatLabel = row.seat_label || (rowId && seatNum ? `${rowId}${seatNum}` : row.id);
  const docId = row.seat_id || row.id || (block && rowId && seatNum ? `${block}-${rowId}-${seatNum}` : row.id);
  return {
    id: docId,
    seatId: docId,
    showId: targetId || row.event_id || row.show_id,
    eventId: targetId || row.event_id || row.show_id,
    block,
    blockId: block,
    row: rowId,
    rowId,
    seatNumber: seatNum,
    seatLabel,
    status: String(row.status || "available").toLowerCase(),
    price: row.price != null && !isNaN(Number(row.price)) ? Number(row.price) : 50,
    bookedAt: row.booked_at || null,
    bookingId: row.booking_id || null,
    reservedAt: row.reserved_at || null,
    reservedBy: row.reserved_by || null,
    displayIndex: row.display_index ?? seatNum,
  };
}

/**
 * Fetch all seats for a show from Supabase.
 */
export async function fetchSeats(showId) {
  const targetId = String(showId || "").trim();
  if (!targetId) return {};

  const seatsByBlock = {};
  try {
    const rows = await sbFetchSeats(targetId);
    if (Array.isArray(rows)) {
      rows.forEach((r) => {
        const s = normalizeSbSeat(r, targetId);
        if (!s || !s.block) return;
        if (!seatsByBlock[s.block]) seatsByBlock[s.block] = [];
        seatsByBlock[s.block].push(s);
      });

      // Sort seats within each block
      Object.keys(seatsByBlock).forEach((b) => {
        seatsByBlock[b].sort(
          (s1, s2) =>
            (s1.displayIndex ?? s1.seatNumber ?? 0) -
            (s2.displayIndex ?? s2.seatNumber ?? 0)
        );
      });
    }
  } catch (err) {
    console.warn("fetchSeats Supabase error:", err?.message);
  }

  return seatsByBlock;
}

/**
 * Fetch real seats for a specific block directly from Supabase.
 */
export async function fetchSeatsByBlock(showId, blockId) {
  const targetId = String(showId || "").trim();
  const cleanBlock = String(blockId || "").trim().toUpperCase();
  if (!targetId || !cleanBlock) return [];
  try {
    const { data, error } = await supabase
      .from("seats")
      .select("*")
      .eq("event_id", targetId)
      .eq("block_id", cleanBlock)
      .order("seat_number", { ascending: true });
    if (error) {
      console.warn("fetchSeatsByBlock error:", error.message);
      return [];
    }
    return (data || []).map((r) => normalizeSbSeat(r, targetId)).filter(Boolean);
  } catch (err) {
    console.warn("fetchSeatsByBlock exception:", err);
    return [];
  }
}

function normalizeFsSeat(docSnap, targetId) {
  const d = docSnap.data();
  if (!d) return null;
  const id = docSnap.id;
  const parts = id.split("-");
  const block = String(d.block || d.blockId || parts[0] || "").toUpperCase();
  const rowId = String(
    d.row ||
      d.rowId ||
      (parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : "A")
  ).toUpperCase();
  const seatNum = Number(
    d.seatNumber ||
      (parts.length >= 3 ? parts[2] : parts.length === 2 ? parts[1] : 0)
  );
  const seatLabel =
    d.seatLabel || (rowId && seatNum ? `${rowId}${seatNum}` : id);
  return {
    id,
    seatId: id,
    showId: targetId || d.showId || d.eventId,
    eventId: targetId || d.showId || d.eventId,
    block,
    blockId: block,
    row: rowId,
    rowId,
    seatNumber: seatNum,
    seatLabel,
    status: String(d.status || "available").toLowerCase(),
    price:
      d.price != null && !isNaN(Number(d.price)) ? Number(d.price) : 100,
    bookedAt: d.bookedAt || null,
    bookingId: d.bookingId || null,
    reservedAt: d.reservedAt || null,
    reservedBy: d.reservedBy || null,
    displayIndex: d.displayIndex ?? seatNum,
  };
}

/**
 * Live Real-Time Seat Availability Subscription backed by both Supabase and Firestore.
 */
export function subscribeSeats(showId, callback, onError) {
  const targetId = String(showId || "").trim();
  if (!targetId) {
    callback({});
    return () => {};
  }

  let disposed = false;
  const seatsMap = new Map();

  const emit = () => {
    if (disposed) return;
    const seatsByBlock = {};
    seatsMap.forEach((seat) => {
      const b = seat.block;
      if (!b) return;
      if (!seatsByBlock[b]) seatsByBlock[b] = [];
      seatsByBlock[b].push(seat);
    });

    Object.keys(seatsByBlock).forEach((b) => {
      seatsByBlock[b].sort(
        (s1, s2) =>
          Number(s1.seatNumber || 0) - Number(s2.seatNumber || 0)
      );
    });

    callback(seatsByBlock);
  };

  // 1. Initial fetch from Supabase
  sbFetchSeats(targetId)
    .then((rows) => {
      if (disposed || !Array.isArray(rows)) return;
      rows.forEach((r) => {
        const s = normalizeSbSeat(r, targetId);
        if (s && s.id) {
          seatsMap.set(s.id, s);
        }
      });
      emit();
    })
    .catch((err) => {
      console.warn("subscribeSeats Supabase fetch warning:", err?.message);
    });

  // 2. Supabase Realtime channel subscription
  const unsubRealtime = subscribeRealtimeSeats(targetId, (payload) => {
    if (disposed) return;
    const { eventType, new: newRow, old: oldRow } = payload || {};
    if (eventType === "DELETE" && oldRow) {
      const s = normalizeSbSeat(oldRow, targetId);
      if (s?.id) seatsMap.delete(s.id);
    } else if (newRow) {
      const s = normalizeSbSeat(newRow, targetId);
      if (s?.id) seatsMap.set(s.id, s);
    }
    emit();
  });

  // 3. Firestore Live Subscription: shows/{targetId}/seats
  let unsubFirestore = () => {};
  try {
    const fsSeatsRef = collection(firestore, "shows", targetId, "seats");
    unsubFirestore = onSnapshot(
      fsSeatsRef,
      (snap) => {
        if (disposed) return;
        snap.docChanges().forEach((change) => {
          if (change.type === "removed") {
            seatsMap.delete(change.doc.id);
          } else {
            const s = normalizeFsSeat(change.doc, targetId);
            if (s && s.id) {
              seatsMap.set(s.id, s);
            }
          }
        });
        emit();
      },
      (err) => {
        console.warn("subscribeSeats Firestore onSnapshot warning:", err?.message);
      }
    );
  } catch (fsErr) {
    console.warn("subscribeSeats Firestore init warning:", fsErr?.message);
  }

  return () => {
    disposed = true;
    if (typeof unsubRealtime === "function") unsubRealtime();
    if (typeof unsubFirestore === "function") unsubFirestore();
  };
}

// Normalize seat key: "A9" | "A-9" -> "A-9"
export function toSeatDocId(seatKey) {
  const raw = String(seatKey || "").trim();
  if (!raw) return raw;
  if (raw.includes("-")) {
    const parts = raw.split("-");
    if (parts.length >= 2) {
      return `${parts[0].toUpperCase()}-${parts[1]}`;
    }
  }
  const m = raw.match(/^([A-Za-z]+)(\d+)$/);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  return raw;
}

// Seat holds TTL (10 minutes)
const HOLD_TTL_MS = 10 * 60 * 1000;

export function getHoldSessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem("jatra:holdSession");
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem("jatra:holdSession", id);
    }
    return id;
  } catch (e) {
    return "";
  }
}

export function isHoldFresh(data) {
  const at = Date.parse((data && (data.reservedAt || data.reserved_at)) || "");
  if (Number.isNaN(at)) return false;
  return Date.now() - at < HOLD_TTL_MS;
}

function resolveSeatDocId(block, key) {
  const cleanBlock = String(block || "").trim().toUpperCase();
  const rawKey = String(key || "").trim();
  if (rawKey.includes("-") && rawKey.split("-").length >= 3) {
    return rawKey;
  }
  return cleanBlock ? `${cleanBlock}-${toSeatDocId(rawKey)}` : toSeatDocId(rawKey);
}

/**
 * Reserve a single seat in Supabase while the customer is selecting/checking out.
 */
export async function holdSeat(showId, block, key) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) return false;
  const sessionId = getHoldSessionId();
  const docId = resolveSeatDocId(block, key);
  const now = new Date().toISOString();

  try {
    await sbHoldSeat(targetShowId, docId, sessionId);
  } catch (e) {
    console.warn("holdSeat Supabase warning:", e?.message);
  }

  try {
    const fsRef = doc(collection(firestore, "shows", targetShowId, "seats"), docId);
    await updateDoc(fsRef, {
      status: "reserved",
      reservedBy: sessionId,
      reservedAt: now,
    });
  } catch (e) {
    // ignore if document does not exist in Firestore
  }

  return true;
}

/**
 * Release a seat hold in Supabase and Firestore.
 */
export async function releaseSeatHold(showId, block, key) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) return false;
  const sessionId = getHoldSessionId();
  const docId = resolveSeatDocId(block, key);

  try {
    await sbReleaseSeatHold(targetShowId, docId, sessionId);
  } catch (e) {
    // continue
  }

  try {
    const fsRef = doc(collection(firestore, "shows", targetShowId, "seats"), docId);
    await updateDoc(fsRef, {
      status: "available",
      reservedBy: null,
      reservedAt: null,
    });
  } catch (e) {
    // continue
  }

  return true;
}

/**
 * Concurrency Safety & Double-Booking Prevention:
 * Validates seat availability in Supabase and commits the booking atomically.
 */
export async function reserveSeatsTransaction({
  showId,
  block,
  seats = [],
  customerName = "Walk-in",
  customerPhone = "",
  paymentMethod = "UPI",
  tier = { id: "seated", name: "SEATED", price: 100 },
  eventName = "",
  date = "",
  time = "",
  ticketAmount = 0,
  convenienceFee = 0,
  gstOnConvenienceFee = 0,
  platformCharge = 0,
  totalAmount = 0,
}) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) {
    throw new Error("reserveSeatsTransaction: showId is required");
  }

  const seatList = Array.isArray(seats) ? seats.filter(Boolean) : [];
  if (seatList.length === 0) {
    throw new Error("reserveSeatsTransaction: At least one seat must be selected");
  }

  const cleanBlock = String(block || "").trim().toUpperCase();
  const sessionId = getHoldSessionId();

  // 1. Verify seat availability in Supabase
  const seatIds = seatList.map((key) => resolveSeatDocId(cleanBlock, key));
  const { data: currentSeats, error: readError } = await supabase
    .from("seats")
    .select("*")
    .eq("event_id", targetShowId)
    .in("id", seatIds);

  if (!readError && Array.isArray(currentSeats)) {
    for (const s of currentSeats) {
      const st = String(s.status || "").toLowerCase();
      const heldByOther =
        st === "reserved" && s.reserved_by !== sessionId && isHoldFresh(s);
      if (st === "booked" || heldByOther) {
        const collisionLabel = s.seat_label || s.id;
        const collisionError = new Error(
          `Seat Collision: Seat "${collisionLabel}" in Block ${cleanBlock} is already ${st === "booked" ? "booked" : "held"}. Please choose another seat.`
        );
        collisionError.code = "SEAT_COLLISION";
        collisionError.seat = collisionLabel;
        throw collisionError;
      }
    }
  }

  const ticketNumber = await nextTicketNumber();
  const nowIso = new Date().toISOString();
  const count = seatList.length;
  const unitPrice = Number(tier.price) || 100;
  const rawTicketAmount = Number(ticketAmount) > 0 ? Number(ticketAmount) : unitPrice * count;
  const charges = calculateCustomerCharges(rawTicketAmount);
  const finalAmount = Number(totalAmount) > 0 ? Number(totalAmount) : charges.finalCustomerAmount;
  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const bookingPayload = {
    id: bookingId,
    bookingId: ticketNumber,
    ticketNumber,
    showId: targetShowId,
    eventId: targetShowId,
    customerName: customerName.trim() || "Walk-in",
    customerPhone: customerPhone.trim(),
    ticketTypeId: tier.id || null,
    ticketTypeName: tier.name || "SEATED",
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
    paymentMethod,
    transactionId: "",
    time: time || "11:00 PM",
    date: date || new Date().toLocaleDateString("en-IN"),
    bookingDate: new Date().toLocaleDateString("en-IN"),
    bookingTime: new Date().toLocaleTimeString("en-IN"),
    createdAt: nowIso,
    status: "Confirmed",
    bookingStatus: "Confirmed",
    enteredCount: 0,
    remainingCount: count,
    assignedGate: tier.gate || `Block ${cleanBlock}`,
    block: cleanBlock,
    seats: seatList,
    seatCount: count,
    eventName: eventName || "Jatra Show",
  };

  // Generate individual ticket records
  const ticketDocs = [];
  for (let i = 0; i < count; i++) {
    const individualTicketId = count === 1 ? ticketNumber : `${ticketNumber}-${i + 1}`;
    const individualSeat = seatList[i] || null;
    const qrToken = generateQrToken();

    ticketDocs.push({
      id: individualTicketId,
      ticketId: individualTicketId,
      bookingId: ticketNumber,
      bookingDocId: bookingId,
      ticketIndex: i + 1,
      totalTickets: count,
      showId: targetShowId,
      eventId: targetShowId,
      eventName: eventName || "Jatra Show",
      ticketTypeId: tier.id || null,
      ticketTypeName: tier.name || "SEATED",
      seat: individualSeat,
      seatIndex: i + 1,
      seatCount: count,
      block: cleanBlock,
      assignedGate: tier.gate || `Block ${cleanBlock}`,
      customerName: customerName.trim() || "Walk-in",
      customerPhone: customerPhone.trim(),
      serialNumber: individualTicketId,
      qrToken,
      status: "ACTIVE",
      date: date || new Date().toLocaleDateString("en-IN"),
      time: time || "11:00 PM",
      unitPrice,
      createdAt: nowIso,
    });
  }

  // 2. Save booking and update seats to "booked" via sbSaveBooking
  try {
    await sbSaveBooking({
      bookingId,
      ticketNumber,
      eventId: targetShowId,
      eventName: bookingPayload.eventName,
      customerName: bookingPayload.customerName,
      customerPhone: bookingPayload.customerPhone,
      ticketTypeId: tier.id || null,
      ticketTypeName: tier.name || "SEATED",
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
      paymentMethod,
      date,
      time,
      block: cleanBlock,
      seats: seatList,
      tickets: ticketDocs,
    });
  } catch (sbErr) {
    console.error("reserveSeatsTransaction sbSaveBooking error:", sbErr?.message);
    throw new Error("Failed to reserve seats and save booking");
  }

  // 3. Dual-write booking, tickets, and booked seats to Firestore so Admin sees it immediately
  try {
    const batch = writeBatch(firestore);

    // Booked seats in Firestore
    const seatClaim = {
      status: "booked",
      bookedAt: nowIso,
      bookingId: ticketNumber,
      reservedBy: null,
      reservedAt: null,
    };
    for (const key of seatList) {
      const docId = resolveSeatDocId(cleanBlock, key);
      const fsLiveRef = doc(collection(firestore, "shows", targetShowId, "seats"), docId);
      batch.set(fsLiveRef, seatClaim, { merge: true });
      const fsLegacyRef = doc(collection(firestore, "seats", targetShowId, cleanBlock), toSeatDocId(key));
      batch.set(fsLegacyRef, seatClaim, { merge: true });
    }

    // Booking doc in Firestore
    const fsBookingRef = doc(collection(firestore, "bookings"), bookingId);
    batch.set(fsBookingRef, bookingPayload);

    // Individual tickets in Firestore
    for (const t of ticketDocs) {
      const fsTicketRef = doc(collection(firestore, "tickets"), t.ticketId);
      batch.set(fsTicketRef, t);
    }

    await batch.commit();
  } catch (fsErr) {
    console.warn("reserveSeatsTransaction Firestore dual-write notice:", fsErr?.message);
  }

  return {
    ...bookingPayload,
    key: bookingId,
    tickets: ticketDocs,
  };
}

// Mark seats as booked by document id
export async function markSeatsBooked(showId, blockId, seatKeys) {
  const targetId = String(showId || "").trim();
  const cleanBlock = String(blockId || "").trim().toUpperCase();
  const now = new Date().toISOString();

  for (const key of seatKeys) {
    const docId = resolveSeatDocId(cleanBlock, key);
    await supabase
      .from("seats")
      .update({
        status: "booked",
        booked_at: now,
        reserved_by: null,
        reserved_at: null,
        updated_at: now,
      })
      .eq("event_id", targetId)
      .or(`id.eq.${docId},seat_label.eq.${key}`);

    try {
      const fsLiveRef = doc(collection(firestore, "shows", targetId, "seats"), docId);
      await updateDoc(fsLiveRef, {
        status: "booked",
        bookedAt: now,
        reservedBy: null,
        reservedAt: null,
      });
      const fsLegacyRef = doc(collection(firestore, "seats", targetId, cleanBlock), toSeatDocId(key));
      await updateDoc(fsLegacyRef, {
        status: "booked",
        bookedAt: now,
        reservedBy: null,
        reservedAt: null,
      });
    } catch (e) {
      // ignore
    }
  }
}

// Mark seats as available (for cancellations)
export async function markSeatsAvailable(showId, blockId, seatKeys) {
  const targetId = String(showId || "").trim();
  const cleanBlock = String(blockId || "").trim().toUpperCase();
  const now = new Date().toISOString();

  for (const key of seatKeys) {
    const docId = resolveSeatDocId(cleanBlock, key);
    await supabase
      .from("seats")
      .update({
        status: "available",
        booked_at: null,
        reserved_by: null,
        reserved_at: null,
        updated_at: now,
      })
      .eq("event_id", targetId)
      .or(`id.eq.${docId},seat_label.eq.${key}`);

    try {
      const fsLiveRef = doc(collection(firestore, "shows", targetId, "seats"), docId);
      await updateDoc(fsLiveRef, {
        status: "available",
        bookedAt: null,
        reservedBy: null,
        reservedAt: null,
      });
      const fsLegacyRef = doc(collection(firestore, "seats", targetId, cleanBlock), toSeatDocId(key));
      await updateDoc(fsLegacyRef, {
        status: "available",
        bookedAt: null,
        reservedBy: null,
        reservedAt: null,
      });
    } catch (e) {
      // ignore
    }
  }
}

// Get block statistics
export function getBlockStats(seatsByBlock, blockId) {
  const blockSeats = seatsByBlock[blockId] || [];
  const total = blockSeats.length;
  const available = blockSeats.filter((s) => s.status === "available").length;
  return { total, available };
}

export { BLOCK_GROUPS, BLOCK_SEATS, generateBBlockSeats };
