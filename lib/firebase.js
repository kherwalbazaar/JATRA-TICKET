import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc",
  authDomain: "event-management-system-27c89.firebaseapp.com",
  databaseURL: "https://event-management-system-27c89-default-rtdb.firebaseio.com",
  projectId: "event-management-system-27c89",
  storageBucket: "event-management-system-27c89.firebasestorage.app",
  messagingSenderId: "536795248572",
  appId: "1:536795248572:web:320f3d8b0920f7db8a9db9",
  measurementId: "G-0BXTHJD0VP",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const firestore = getFirestore(app);

let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
export { analytics };
