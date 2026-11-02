// ============================================================
// JATRA BAZAAR — Firebase Firestore Client
// Primary database for Event Management & Event Discovery
// ============================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "event-management-system-27c89.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://event-management-system-27c89-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "event-management-system-27c89",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "event-management-system-27c89.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "536795248572",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:536795248572:web:320f3d8b0920f7db8a9db9",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-0BXTHJD0VP",
};

// Singleton pattern to prevent re-initialization on Next.js HMR/Fast Refresh
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
})();

export const FIRESTORE_COLLECTIONS = {
  EVENTS: "events",
  TICKET_TYPES: "ticketTypes",
  SETTINGS: "settings",
  PARTIES: "parties",
  BANNERS: "banners",
  BLOCK_CATEGORIES: "blockCategories",
};

export default db;
