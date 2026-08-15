import { ref, onValue, get } from "firebase/database";
import { db } from "./firebase";

const EVENTS_KEY = "events";

export async function fetchEvents() {
  const snap = await get(ref(db, EVENTS_KEY));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([key, value]) => ({ key, ...value }));
}

export function subscribeEvents(callback) {
  onValue(ref(db, EVENTS_KEY), (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    callback(Object.entries(snap.val()).map(([key, value]) => ({ key, ...value })));
  });
  return () => {};
}