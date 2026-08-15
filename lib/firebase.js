import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc",
  authDomain: "event-management-system-27c89.firebaseapp.com",
  projectId: "event-management-system-27c89",
  storageBucket: "event-management-system-27c89.firebasestorage.app",
  messagingSenderId: "536795248572",
  appId: "1:536795248572:web:320f3d8b0920f7db8a9db9",
  measurementId: "G-0BXTHJD0VP",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);