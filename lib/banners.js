import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { firestore } from "./firebase";

const BANNERS_COL = "banners";

export async function fetchBanners() {
  const q = query(collection(firestore, BANNERS_COL), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ key: d.id, ...d.data() }));
}

export function subscribeBanners(callback) {
  const q = query(collection(firestore, BANNERS_COL), orderBy("order", "asc"));
  const unsubscribe = onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ key: d.id, ...d.data() }));
    callback(data);
  });
  return unsubscribe;
}
