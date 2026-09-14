import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { firestore } from "./firebase";

const EVENTS_COL = "events";

export async function fetchEvents() {
  const q = query(collection(firestore, EVENTS_COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ key: d.id, ...d.data() }));
}

export function subscribeEvents(callback) {
  const q = query(collection(firestore, EVENTS_COL), orderBy("createdAt", "desc"));
  const unsubscribe = onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ key: d.id, ...d.data() }));
    callback(data);
  });
  return unsubscribe;
}
