import { supabase } from "./supabase";

/**
 * Diagram block categories — single source of truth from Supabase.
 *
 * Channel logic:
 *   Status ON  -> counter selling only (not bookable online)
 *   Status OFF -> active for online selling
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
    enabled: true,
    online: true,
    counter: false,
    builtin: true,
    order: idx,
  }));
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
 * Live subscription to Supabase public.block_categories.
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

  // 1. Initial fetch from Supabase
  const loadCategories = () => {
    supabase
      .from("block_categories")
      .select("*")
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

  // 2. Realtime listener on Supabase
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
      .subscribe();
  } catch (e) {
    console.warn("subscribeBlockCategories channel error:", e);
  }

  return () => {
    disposed = true;
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
