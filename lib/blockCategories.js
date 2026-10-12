import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { firestore } from "./firebase";
import { supabase } from "./supabase";

/**
 * Diagram block categories — single source of truth shared by the
 * ADMIN, USER and SCANNER apps.
 *
 * Channel logic:
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
  return DEFAULT_BLOCK_IDS.map((id, idx) => ({
    id,
    name: id,
    enabled: true,
    online: true,
    counter: false,
    builtin: true,
    order: idx,
  }));
}

function sortedFromDocs(docs) {
  const list = docs.map((d) => ({ ...d.data(), id: d.id }));
  if (!list.length) return [];
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return list;
}

function normalizeSbCategories(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name || r.id,
    enabled: r.enabled ?? true,
    online: r.online ?? true,
    counter: r.counter ?? false,
    builtin: r.builtin ?? true,
    order: r.display_order ?? r.order ?? 0,
  })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Live subscription across Supabase + Firestore.
 */
export function subscribeBlockCategories(callback, onError) {
  let disposed = false;
  let lastJson = null;

  const emit = (list) => {
    if (disposed) return;
    const json = JSON.stringify(list);
    if (json === lastJson) return;
    lastJson = json;
    callback(list);
  };

  // 1. Fetch from Supabase
  try {
    supabase
      .from("block_categories")
      .select("*")
      .then(({ data, error }) => {
        if (!error && Array.isArray(data) && data.length > 0) {
          emit(normalizeSbCategories(data));
        }
      })
      .catch((err) => {
        console.warn("subscribeBlockCategories Supabase fetch notice:", err);
      });
  } catch (err) {
    /* ignore */
  }

  // 2. Realtime listener on Supabase
  let sbChannel = null;
  try {
    sbChannel = supabase
      .channel("realtime-block-categories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "block_categories" },
        () => {
          supabase
            .from("block_categories")
            .select("*")
            .then(({ data }) => {
              if (Array.isArray(data) && data.length > 0) {
                emit(normalizeSbCategories(data));
              }
            })
            .catch(() => {});
        }
      )
      .subscribe();
  } catch (e) {
    /* ignore */
  }

  // 3. Firestore fallback / real-time listener
  let unsubSnap = () => {};
  try {
    unsubSnap = onSnapshot(
      collection(firestore, BLOCK_CATEGORIES_COLLECTION),
      (snap) => {
        if (!snap.empty) {
          emit(sortedFromDocs(snap.docs));
        }
      },
      () => {
        // Soft fallback — do not break UI if firestore permissions differ
      }
    );
  } catch (err) {
    /* ignore */
  }

  return () => {
    disposed = true;
    try {
      unsubSnap();
    } catch (e) {}
    if (sbChannel) {
      try {
        supabase.removeChannel(sbChannel);
      } catch (e) {}
    }
  };
}

const find = (cats, id) => (cats || []).find((c) => c.id === id);

/** Unknown block / no config yet => available online (permissive fallback). */
export function isBlockOnline(cats, id) {
  if (!cats || !cats.length) return true;
  const hasAnyOnline = cats.some((c) => c.online === true);
  if (!hasAnyOnline) return true;
  const c = find(cats, id);
  if (!c) return true;
  return c.online === true;
}

export function isBlockCounter(cats, id) {
  const c = find(cats, id);
  if (!c) return false;
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
