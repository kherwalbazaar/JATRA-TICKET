import { supabase } from "./supabase.js";
import { subscribeCatalog, refreshCatalog } from "./catalogStore.js";

/**
 * Admin-confirmed party bookings (Supabase `party_bookings`).
 * Customers are read-only: RLS exposes only status = 'Confirmed' rows.
 * Cached through the shared catalog store like "parties"/"events".
 */

const KEY = "party_bookings";

export function normalizeBookingDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

export function bookingsForParty(bookings, party) {
  if (!party || !Array.isArray(bookings)) return [];
  const nameUpper = String(party.name || "").trim().toUpperCase();
  const idUpper = String(party.id || "").trim().toUpperCase();
  return bookings.filter((b) => {
    if (!b || String(b.status) !== "Confirmed") return false;
    const bParty = String(b.party_name || "").trim().toUpperCase();
    const bId = String(b.party_id || "").trim().toUpperCase();
    return (idUpper && bId === idUpper) || (nameUpper && bParty === nameUpper);
  });
}

export function subscribePartyBookings(callback) {
  if (typeof callback !== "function") return () => {};
  let disposed = false;

  const unsubCatalog = subscribeCatalog(KEY, (rows) => {
    if (!disposed) callback(Array.isArray(rows) ? rows : []);
  });

  refreshCatalog(KEY);

  const channel = supabase
    .channel(`party-bookings-live-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "party_bookings" },
      () => {
        if (!disposed) refreshCatalog(KEY, { force: true });
      }
    )
    .subscribe();

  return () => {
    disposed = true;
    unsubCatalog();
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}
