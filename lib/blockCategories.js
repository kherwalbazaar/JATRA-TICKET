import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { firestore } from "./firebase";

/**
 * Diagram block categories — single source of truth shared by the
 * ADMIN, USER and SCANNER apps (Firestore collection: `blockCategories`).
 *
 * Channel logic (same as admin):
 *   Status ON  -> counter selling only (not bookable online)
 *   Status OFF -> active for online selling
 */
export const BLOCK_CATEGORIES_COLLECTION = "blockCategories";

/** The venue has exactly 9 block categories. */
export const DEFAULT_BLOCK_IDS = [
  "A1", "A2", "A3",
  "B1", "B2", "B3",
  "C1", "C2", "C3",
];

export function defaultBlockCategories() {
  return DEFAULT_BLOCK_IDS.map((id) => ({
    id,
    name: id,
    enabled: true, // status ON = counter selling
    online: false,
    counter: true,
    builtin: true,
  }));
}

const POLL_MS = 3000; // real-time safety net: 0–3s worst case

function sortedFromDocs(docs) {
  const list = docs.map((d) => ({ ...d.data(), id: d.id }));
  if (!list.length) return [];
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return list;
}

/**
 * Live subscription + 3s poll fallback.
 * The Firestore snapshot gives instant updates; the poll guarantees the
 * admin's status flips show up within 0–3 seconds even when the realtime
 * stream is paused (backgrounded APK, flaky network, cold start).
 * Emits only when the data actually changed.
 */
export function subscribeBlockCategories(callback, onError) {
  let lastJson = null;
  const emit = (list) => {
    const json = JSON.stringify(list);
    if (json === lastJson) return;
    lastJson = json;
    callback(list);
  };

  let unsubSnap = () => {};
  try {
    unsubSnap = onSnapshot(
      collection(firestore, BLOCK_CATEGORIES_COLLECTION),
      (snap) => emit(sortedFromDocs(snap.docs)),
      (err) => {
        console.warn("subscribeBlockCategories error:", err);
        if (lastJson === null) emit([]);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn("subscribeBlockCategories failed:", err);
    if (lastJson === null) emit([]);
  }

  const interval = setInterval(async () => {
    try {
      const snap = await getDocs(collection(firestore, BLOCK_CATEGORIES_COLLECTION));
      emit(sortedFromDocs(snap.docs));
    } catch (err) {
      /* keep the realtime stream as the source of truth */
    }
  }, POLL_MS);

  return () => {
    clearInterval(interval);
    try {
      unsubSnap();
    } catch (err) {
      /* ignore */
    }
  };
}

const find = (cats, id) => (cats || []).find((c) => c.id === id);

/** Unknown block / no config yet => available online (permissive fallback). */
export function isBlockOnline(cats, id) {
  const c = find(cats, id);
  if (!c) return true;
  return c.online === true;
}

export function isBlockCounter(cats, id) {
  const c = find(cats, id);
  if (!c) return true;
  return c.counter === true;
}

/** Custom display name from admin, falls back to the block id. */
export function blockDisplayName(cats, id) {
  const c = find(cats, id);
  return c && c.name ? c.name : id;
}

/** "Counter" when selling at counter, otherwise "Online". */
export function blockChannelText(cats, id) {
  return isBlockCounter(cats, id) ? "Counter" : "Online";
}
