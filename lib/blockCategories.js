import { readCatalog, subscribeCatalog, refreshCatalog } from "./catalogStore";

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
 * Catalog-cache subscription to block categories.
 *
 * Emits the locally cached list immediately (or built-in defaults on first
 * run), then revalidates from Supabase in the background. Seat availability
 * itself still streams directly from Supabase.
 */
export function subscribeBlockCategories(callback) {
  if (typeof callback !== "function") return () => {};

  let lastJson = null;
  const emit = (rows) => {
    const list = rows && rows.length ? normalizeSbCategories(rows) : defaultBlockCategories();
    const json = JSON.stringify(list);
    if (json === lastJson) return;
    lastJson = json;
    callback(list);
  };

  emit(readCatalog("block_categories") || []);
  const unsub = subscribeCatalog("block_categories", emit);
  refreshCatalog("block_categories");
  return unsub;
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
