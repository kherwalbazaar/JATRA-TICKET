import { ref, push, get, set } from "firebase/database";
import { db } from "./firebase";

const BOOKINGS_KEY = "bookings";

function genTicketId(seq) {
  const n = String(seq).padStart(5, "0");
  return `NJ26-${n}`;
}

export async function saveBooking({ tier, quantity, holders, contact, paymentMethod, totalAmount }) {
  const bookingsRef = ref(db, BOOKINGS_KEY);
  const snap = await get(bookingsRef);
  const existing = snap.exists() ? Object.values(snap.val()) : [];
  const seq = existing.length + 1;

  const booking = {
    bookingId: genTicketId(seq),
    tierId: tier.id,
    category: tier.name,
    gate: tier.gate,
    price: tier.price,
    quantity,
    totalAmount,
    paymentMethod,
    contact,
    holders: holders.map((h, i) => ({
      name: h.name,
      mobile: h.mobile,
      isPrimary: i === 0,
    })),
    createdAt: Date.now(),
  };

  const newRef = push(bookingsRef, booking);
  return { ...booking, key: newRef.key };
}

export async function fetchBookings() {
  const snap = await get(ref(db, BOOKINGS_KEY));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([key, value]) => ({ key, ...value }));
}

export function subscribeBookings(callback) {
  import("firebase/database").then(({ onValue }) => {
    onValue(ref(db, BOOKINGS_KEY), (snap) => {
      if (!snap.exists()) {
        callback([]);
        return;
      }
      callback(Object.entries(snap.val()).map(([key, value]) => ({ key, ...value })));
    });
  });
  return () => {};
}

export async function updateBookingStatus(bookingId, status) {
  const snap = await get(ref(db, BOOKINGS_KEY));
  if (!snap.exists()) return;
  for (const [key, value] of Object.entries(snap.val())) {
    if (value.bookingId === bookingId) {
      await set(ref(db, `${BOOKINGS_KEY}/${key}/status`), status);
      return;
    }
  }
}