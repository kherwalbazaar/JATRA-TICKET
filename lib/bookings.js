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
import { firestore } from "./firebase";

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
