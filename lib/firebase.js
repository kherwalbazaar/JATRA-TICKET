import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Same env var names as "JATRA BAZAAR ADMIN" so both apps share one config.
// Values fall back to the project defaults if .env.local is missing.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "event-management-system-27c89.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://event-management-system-27c89-default-rtdb.firebaseio.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "event-management-system-27c89",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "event-management-system-27c89.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "536795248572",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:536795248572:web:320f3d8b0920f7db8a9db9",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-0BXTHJD0VP",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Realtime Database (legacy mirror — bookings used to be written here)
let db = null;
try {
  db = getDatabase(app);
} catch (error) {
  console.warn("Firebase Realtime Database initialization failed:", error.message);
}

export const firestore = getFirestore(app);

let analytics = null;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn("Firebase Analytics initialization failed:", error.message);
  }
}

export { db, analytics };
