// Seat reservation grouping + server-validated expiry.
//
// A payment reservation links every held seat of one checkout through the
// `reserved_by` column of the Supabase `seats` row, so no new column is needed:
//
//   "<sessionId>"                          -> selection hold (10 minute TTL)
//   "<sessionId>|r:<reservationId>|e:<ms>" -> payment hold (expires at <ms>)
//
// The deadline lives in the database row, never only in browser memory, so a
// refresh or an app restart cannot extend or reset it.

export const SELECTION_HOLD_MS = 10 * 60 * 1000;
export const PAYMENT_WINDOW_MS = 60 * 1000;

const HOLD_SEP = "|";
const RES_TAG = `${HOLD_SEP}r:`;
const EXP_TAG = `${HOLD_SEP}e:`;

export function newReservationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `res_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  }
  return `res_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPaymentHold(sessionId, reservationId, expiresAtMs) {
  return `${sessionId}${RES_TAG}${reservationId}${EXP_TAG}${Number(expiresAtMs)}`;
}

/** Split a `reserved_by` value into its owner session, reservation and deadline. */
export function parseHold(raw) {
  const value = String(raw || "");
  const resAt = value.indexOf(RES_TAG);
  if (resAt === -1) {
    return { sessionId: value, reservationId: null, expiresAt: null };
  }
  const expAt = value.indexOf(EXP_TAG, resAt);
  const reservationId = value.slice(resAt + RES_TAG.length, expAt === -1 ? undefined : expAt);
  const expiresAt = expAt === -1 ? null : Number(value.slice(expAt + EXP_TAG.length));
  return {
    sessionId: value.slice(0, resAt),
    reservationId: reservationId || null,
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null,
  };
}

/** Owner session of a hold, ignoring the payment tags. Use instead of `=== sessionId`. */
export function holdSessionId(raw) {
  return parseHold(raw).sessionId;
}

export function isPaymentHold(raw) {
  const p = parseHold(raw);
  return Boolean(p.reservationId);
}

/**
 * True while the hold still blocks the seat for someone else.
 * A payment hold is governed by its embedded deadline; a selection hold by TTL.
 */
export function isHoldFreshValue(reservedBy, reservedAt, now = Date.now()) {
  const { reservationId, expiresAt } = parseHold(reservedBy);
  if (reservationId) {
    return expiresAt ? now < expiresAt : false;
  }
  const at = Date.parse(reservedAt || "");
  if (Number.isNaN(at)) return false;
  return now - at < SELECTION_HOLD_MS;
}

export function holdRemainingMs(reservedBy, reservedAt, now = Date.now()) {
  const { reservationId, expiresAt } = parseHold(reservedBy);
  if (reservationId && expiresAt) return Math.max(0, expiresAt - now);
  const at = Date.parse(reservedAt || "");
  if (Number.isNaN(at)) return 0;
  return Math.max(0, SELECTION_HOLD_MS - (now - at));
}

/**
 * Compare-and-swap style ownership filter: the update only lands when the seat
 * is still in the exact state we read it in.
 */
export function applyOwnershipFilter(query, reservedBy, reservedAt) {
  const q =
    reservedBy == null ? query.is("reserved_by", null) : query.eq("reserved_by", reservedBy);
  return reservedAt == null ? q.is("reserved_at", null) : q.eq("reserved_at", reservedAt);
}

export function seatMatchesKey(seat, key) {
  const clean = String(key || "").trim();
  if (!clean) return false;
  return (
    seat.id === clean ||
    seat.seat_id === clean ||
    seat.seat_label === clean ||
    (seat.row && seat.seat_number && `${seat.row}-${seat.seat_number}` === clean) ||
    (seat.row && seat.seat_number && `${seat.row}${seat.seat_number}` === clean) ||
    (seat.row_id && seat.seat_number && `${seat.row_id}-${seat.seat_number}` === clean)
  );
}

// ── Client-side reservation calls ──────────────────────────────────────────

export async function createReservation({ eventId, block, seats, sessionId }) {
  const res = await fetch("/api/reservation/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, block, seats, sessionId }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, ...(data || {}) };
}

export async function fetchReservationStatus({ eventId, reservationId, sessionId, seats = "" }) {
  const params = new URLSearchParams({
    eventId: String(eventId || ""),
    reservationId: String(reservationId || ""),
  });
  if (sessionId) params.set("sessionId", String(sessionId));
  if (seats) params.set("seats", String(seats));
  const res = await fetch(`/api/reservation/status?${params.toString()}`);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, ...(data || {}) };
}

export async function cancelReservation({ eventId, reservationId, sessionId, reason = "customer_cancelled" }) {
  const res = await fetch("/api/reservation/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, reservationId, sessionId, reason }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, ...(data || {}) };
}

/** Persist the active reservation so a reload/restart resumes the same countdown. */
const RES_KEY = "jatra:activeReservation";

export function saveActiveReservation(info) {
  try {
    if (!info) {
      window.localStorage.removeItem(RES_KEY);
      return;
    }
    window.localStorage.setItem(RES_KEY, JSON.stringify(info));
  } catch (e) {}
}

export function readActiveReservation() {
  try {
    const raw = window.localStorage.getItem(RES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export const PAYMENT_EXPIRED_MESSAGE =
  "Payment Time Expired! Your selected seats have been released. Please select your seats again.";
