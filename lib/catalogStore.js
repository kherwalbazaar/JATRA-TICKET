import { supabase } from "./supabase";

/**
 * Local catalog cache.
 *
 * Show catalog data (events, parties, ticket types, banners, block categories)
 * is fetched once from Supabase and persisted in localStorage. Screens read the
 * cached copy instantly and a background revalidation keeps it fresh. Live
 * seat availability / holds / bookings stay on their direct Supabase channels.
 */

const PREFIX = "jatra_catalog_v1:";
const CATALOG_TTL_MS = 5 * 60 * 1000;
const CATALOG_KEYS = [
  "events",
  "parties",
  "ticket_types",
  "banners",
  "block_categories",
];

const memory = new Map();
const subscribers = new Map();
const inflight = new Map();
let lastWarmAt = 0;

function storageAvailable() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readRecord(key) {
  if (memory.has(key)) return memory.get(key);
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function notify(key, data) {
  const set = subscribers.get(key);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(data);
    } catch (err) {
      console.warn(`catalogStore(${key}) subscriber error:`, err?.message || err);
    }
  }
}

function writeRecord(key, data) {
  const record = { at: Date.now(), data: Array.isArray(data) ? data : [] };
  memory.set(key, record);
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(record));
    } catch (err) {
      console.warn(`catalogStore(${key}) write failed:`, err?.message || err);
    }
  }
  notify(key, record.data);
  return record.data;
}

const loaders = {
  events: () => supabase.from("events").select("*"),
  ticket_types: () => supabase.from("ticket_types").select("*"),
  block_categories: () =>
    supabase.from("block_categories").select("*").order("display_order", { ascending: true }),
  banners: () =>
    supabase.from("banners").select("*").order("display_order", { ascending: true }),
  parties: () => supabase.from("settings").select("*").eq("id", "parties"),
};

async function loadFromDb(key) {
  const loader = loaders[key];
  if (!loader) return [];
  const res = await loader();
  if (res?.error) throw res.error;
  const rows = res?.data;
  if (key === "parties") {
    const payload = Array.isArray(rows) && rows[0] ? rows[0].data : null;
    if (Array.isArray(payload?.parties)) return payload.parties;
    if (Array.isArray(payload)) return payload;
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}

export function readCatalog(key) {
  const record = readRecord(key);
  return record ? record.data : null;
}

export function subscribeCatalog(key, callback) {
  if (typeof callback !== "function") return () => {};
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(callback);

  const cached = readCatalog(key);
  if (cached) callback(cached);

  return () => {
    set.delete(callback);
    if (set.size === 0) subscribers.delete(key);
  };
}

export async function refreshCatalog(key, { force = false } = {}) {
  const record = readRecord(key);
  if (!force && record && Date.now() - record.at < CATALOG_TTL_MS) {
    return record.data;
  }
  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    try {
      const rows = await loadFromDb(key);
      return writeRecord(key, rows);
    } catch (err) {
      console.warn(`catalogStore(${key}) refresh failed:`, err?.message || err);
      return record ? record.data : [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

export async function getCatalog(key) {
  const record = readRecord(key);
  if (record && Date.now() - record.at < CATALOG_TTL_MS) return record.data;
  return refreshCatalog(key);
}

export function warmCatalog() {
  if (typeof window === "undefined") return Promise.resolve();
  if (Date.now() - lastWarmAt < 30000) return Promise.resolve();
  lastWarmAt = Date.now();
  return Promise.all(CATALOG_KEYS.map((key) => refreshCatalog(key, { force: true })));
}

export function refreshStaleCatalog() {
  if (typeof window === "undefined") return Promise.resolve();
  return Promise.all(CATALOG_KEYS.map((key) => refreshCatalog(key)));
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(PREFIX)) return;
    const key = event.key.slice(PREFIX.length);
    memory.delete(key);
    const rows = readCatalog(key);
    if (rows) notify(key, rows);
  });
}
