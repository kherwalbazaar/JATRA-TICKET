import { ref, push, get, set } from "firebase/database";
import { collection, addDoc, getDocs, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, firestore } from "./firebase";

const BOOKINGS_KEY = "bookings";
const FIRESTORE_BOOKINGS = "bookings";

function genTicketId(seq) {
  const n = String(seq).padStart(5, "0");
  return `NJ26-${n}`;
}

function nowDateStr() {
  return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function nowTimeStr() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export async function saveBooking({ tier, quantity, holders, contact, paymentMethod, totalAmount, eventId }) {
  let bookingId;
  let seq = 1;

  // ── 1. Try to save to Realtime Database (backward compatible) ──
  if (db) {
    try {
      const bookingsRef = ref(db, BOOKINGS_KEY);
      const snap = await get(bookingsRef);
      const existing = snap.exists() ? Object.values(snap.val()) : [];
      seq = existing.length + 1;
      bookingId = genTicketId(seq);

      const rtdbBooking = {
        bookingId,
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

      await push(bookingsRef, rtdbBooking);
    } catch (error) {
      console.warn("RTDB save failed, using Firestore only:", error.message);
      // Generate fallback booking ID
      const timestamp = Date.now().toString().slice(-6);
      bookingId = `NJ26-${timestamp}`;
    }
  } else {
    // Generate booking ID without RTDB
    const timestamp = Date.now().toString().slice(-6);
    bookingId = `NJ26-${timestamp}`;
  }

  // ── 2. Save to Firestore (primary storage) ──
  const firestoreBooking = {
    eventId: eventId || "EVT-2026-001",
    ticketNumber: bookingId,
    customerName: contact.name,
    customerPhone: contact.mobile,
    customerEmail: contact.email || "",
    ticketTypeId: tier.id,
    ticketTypeName: tier.name,
    quantity,
    unitPrice: tier.price,
    amount: totalAmount,
    source: "Online",
    paymentMethod: paymentMethod === "upi" ? "UPI" : paymentMethod === "cash" ? "Cash" : "Card",
    transactionId: "",
    time: nowTimeStr(),
    date: nowDateStr(),
    status: "Confirmed",
    assignedGate: tier.gate,
  };

  try {
    const docRef = await addDoc(collection(firestore, FIRESTORE_BOOKINGS), firestoreBooking);
    return { ...firestoreBooking, key: docRef.id, bookingId };
  } catch (err) {
    console.error("Firestore write failed:", err);
    throw new Error("Failed to save booking");
  }
}

export async function fetchBookings() {
  // Use Firestore as primary storage
  try {
    const q = query(collection(firestore, FIRESTORE_BOOKINGS));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ key: d.id, ...d.data() }));
  } catch (error) {
    console.error("Failed to fetch bookings from Firestore:", error);
    
    // Fallback to RTDB if available
    if (db) {
      try {
        const snap = await get(ref(db, BOOKINGS_KEY));
        if (!snap.exists()) return [];
        return Object.entries(snap.val()).map(([key, value]) => ({ key, ...value }));
      } catch (rtdbError) {
        console.error("RTDB fallback also failed:", rtdbError);
        return [];
      }
    }
    return [];
  }
}

export function subscribeBookings(callback) {
  // Use Firestore as primary storage
  try {
    const q = query(collection(firestore, FIRESTORE_BOOKINGS));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ key: d.id, ...d.data() }));
      callback(data);
    });
    return unsubscribe;
  } catch (error) {
    console.error("Failed to subscribe to Firestore bookings:", error);
    
    // Fallback to RTDB if available
    if (db) {
      import("firebase/database").then(({ onValue }) => {
        onValue(ref(db, BOOKINGS_KEY), (snap) => {
          if (!snap.exists()) {
            callback([]);
            return;
          }
          callback(Object.entries(snap.val()).map(([key, value]) => ({ key, ...value })));
        });
      });
    }
    return () => {};
  }
}

export async function updateBookingStatus(bookingId, status) {
  // Update in Firestore (primary storage)
  try {
    const q = query(collection(firestore, FIRESTORE_BOOKINGS), where("ticketNumber", "==", bookingId));
    const fsSnap = await getDocs(q);
    for (const d of fsSnap.docs) {
      await updateDoc(doc(firestore, FIRESTORE_BOOKINGS, d.id), { status });
    }
  } catch (err) {
    console.error("Firestore status update failed:", err);
  }

  // Also update in RTDB if available
  if (db) {
    try {
      const snap = await get(ref(db, BOOKINGS_KEY));
      if (!snap.exists()) return;
      for (const [key, value] of Object.entries(snap.val())) {
        if (value.bookingId === bookingId) {
          await set(ref(db, `${BOOKINGS_KEY}/${key}/status`), status);
          break;
        }
      }
    } catch (error) {
      console.warn("RTDB status update failed:", error.message);
    }
  }
}
