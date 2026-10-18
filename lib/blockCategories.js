import { supabase } from "./supabase";

/**
 * Diagram block categories — single source of truth from Supabase.
 *
 * Channel logic:
 *   Switch ON  -> Online selling (Green)
 *   Switch OFF -> Counter selling only (Yellow, not bookable online)
 */
export const DEFAULT_BLOCK_IDS = [
  "A1", "A2", "A3",
  "B1", "B2", "B3",
  "C1", "C2", "C3",
];

export function defaultBlockCategories() {
  return DEFAULT_BLOCK_IDS.map((id, idx) => ({
    id,
    name: id,
    enabled: false,
    online: false,
    counter: true,
    builtin: true,
    order: idx,
  }));
}

function normalizeSbCategories(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((r) => {
    const isOnline = r.online === true;
    return {
      id: r.id,
      name: r.name || r.id,
      enabled: isOnline,
      online: isOnline,
      counter: r.counter === true || !isOnline,
      builtin: r.builtin ?? true,
      order: r.display_order ?? r.order ?? 0,
    };
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Live subscription to Supabase public.block_categories.
 * Listens to:
 * 1. Postgres Changes (database updates)
 * 2. Realtime Broadcasts ('block_categories_broadcast') for sub-100ms sync
 * 3. Window focus / visibility changes
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

  // 1. Initial & refresh fetch from Supabase
  const loadCategories = () => {
    supabase
      .from("block_categories")
      .select("*")
      .order("display_order", { ascending: true })
      .then(({ data, error }) => {
        if (!error && Array.isArray(data) && data.length > 0) {
          emit(normalizeSbCategories(data));
        } else {
          emit(defaultBlockCategories());
        }
      })
      .catch((err) => {
        console.warn("subscribeBlockCategories Supabase fetch notice:", err);
        emit(defaultBlockCategories());
      });
  };

  loadCategories();

  // 2. Realtime listener on Supabase (postgres_changes + broadcast)
  let sbChannel = null;
  try {
    sbChannel = supabase
      .channel(`realtime-block-categories-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "block_categories" },
        () => {
          if (!disposed) loadCategories();
        }
      )
      .on("broadcast", { event: "channel_update" }, () => {
        if (!disposed) loadCategories();
      })
      .on("broadcast", { event: "name_update" }, () => {
        if (!disposed) loadCategories();
      })
      .on("broadcast", { event: "categories_changed" }, () => {
        if (!disposed) loadCategories();
      })
      .subscribe();
  } catch (e) {
    console.warn("subscribeBlockCategories channel error:", e);
  }

  // 3. Window focus re-sync to prevent stale caches
  const onFocus = () => {
    if (!disposed) loadCategories();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
  }

  return () => {
    disposed = true;
    if (sbChannel) {
      try {
        supabase.removeChannel(sbChannel);
      } catch (e) {}
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    }
  };
}

const find = (cats, id) => (cats || []).find((c) => c.id === id);

/**
 * Returns true if block is actively enabled for online booking in Supabase.
 * If configured as counter-only (online === false), returns false.
 */
export function isBlockOnline(cats, id) {
  if (!cats || !cats.length) return false;
  const c = find(cats, id);
  if (!c) return false;
  return c.online === true;
}

/**
 * Returns true if block is restricted to Counter box-office sales only.
 */
export function isBlockCounter(cats, id) {
  const c = find(cats, id);
  if (!c) return true;
  return c.counter === true || c.online === false;
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
