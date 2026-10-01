import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "./firebase.js";

const FIRESTORE_BOOKINGS = "bookings";
const FIRESTORE_EVENTS = "events";

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
  eventId,
  seats = [],
  eventName = "",
  customerName = "",
  customerPhone = "",
}) {
  if (!tier || typeof tier !== "object") {
    throw new Error("saveBooking: a ticket tier is required");
  }

  const seatList = Array.isArray(seats) ? seats.filter(Boolean) : [];
  const resolvedEventId = await resolveEventId(eventId);
  const ticketNumber = await nextTicketNumber();

  const booking = {
    eventId: resolvedEventId,
    ticketNumber,
    customerName: customerName.trim() || "Walk-in",
    customerPhone: customerPhone.trim(),
    ticketTypeId: tier.id || "seated",
    ticketTypeName: tier.name || "General",
    quantity: Number(quantity) || seatList.length || 1,
    unitPrice: Number(tier.price) || 0,
    amount: Number(totalAmount) || 0,
    source: "Online",
    paymentMethod: normalizePaymentMethod(paymentMethod),
    transactionId: "",
    time: nowTimeStr(),
    date: nowDateStr(),
    status: "Confirmed",
    assignedGate: tier.gate || "",
    block: String(tier.gate || "").replace(/^Block\s+/i, "").trim(),
    seats: seatList,
    seatCount: seatList.length || Number(quantity) || 1,
    eventName,
  };

  try {
    const docRef = await addDoc(
      collection(firestore, FIRESTORE_BOOKINGS),
      booking,
    );
    return { ...booking, key: docRef.id, id: docRef.id, bookingId: ticketNumber };
  } catch (error) {
    console.error("Firestore write failed:", error);
    throw new Error("Failed to save booking");
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
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    if (timeStr) {
      const timeMatch = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const meridiem = (timeMatch[3] || "").toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        d.setHours(hours, minutes, 0, 0);
        return d;
      }
    }
    // End of the day so it doesn't expire prematurely on the day of the event
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return null;
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
  const rawStatus = String(booking?.status || ticket?.status || "").trim().toLowerCase();

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


