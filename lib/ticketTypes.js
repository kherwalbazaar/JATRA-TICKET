import { getCatalog, subscribeCatalog, refreshCatalog } from "./catalogStore";

function normalizeSbTicketType(row) {
  if (!row) return null;
  return {
    key: row.id,
    id: row.id,
    name: row.name,
    eventId: row.event_id,
    committeeName: row.committee_name || "",
    price: Number(row.price) || 0,
    totalQuota: row.total_quota || 0,
    sold: row.sold || 0,
    badgeText: row.badge_text || "",
    color: row.color || "#4f39f6",
    bgColor: row.bg_color || "#eef2ff",
    textColor: row.text_color || "#312e81",
    blocks: row.blocks || [],
    rows: row.rows || [],
    gateAccess: row.gate_access || [],
    perks: row.perks || [],
    gate: row.gate || "",
    displayOrder: row.display_order ?? 0,
    description: row.description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Standard admin row price fallback based on ticket types:
 * - Star (A, B, C, D, E) = ₹200
 * - VIP (F, G, H, I, J, K) = ₹150
 * - Special (L, M, N, O, P, Q, R) = ₹120
 * - 3rd Class (S - Z) = ₹100
 */
export function getPriceForRow(rowId, ticketTypes = []) {
  if (!rowId) return 100;
  const cleanRow = String(rowId).trim().toUpperCase();
  if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
    const matched = ticketTypes.find(
      (tt) => Array.isArray(tt.rows) && tt.rows.map((r) => String(r).toUpperCase()).includes(cleanRow)
    );
    if (matched && Number(matched.price) > 0) {
      return Number(matched.price);
    }
  }
  if (["A", "B", "C", "D", "E"].includes(cleanRow)) return 200;
  if (["F", "G", "H", "I", "J", "K"].includes(cleanRow)) return 150;
  if (["L", "M", "N", "O", "P", "Q", "R"].includes(cleanRow)) return 120;
  return 100;
}

/**
 * Ticket types (tier name + price) are authored in JATRA BAZAAR.
 * Reads from the local catalog cache, scoped to a single event when given.
 */
export async function fetchTicketTypes(eventId = "") {
  try {
    const rows = await getCatalog("ticket_types");
    const list = (rows || []).map(normalizeSbTicketType).filter(Boolean);
    return eventId ? list.filter((t) => t.eventId === eventId) : list;
  } catch (err) {
    console.warn("fetchTicketTypes catalog error:", err?.message);
  }
  return [];
}

export function subscribeTicketTypes(callback, eventId = "") {
  if (typeof callback !== "function") return () => {};

  let lastJson = null;
  const emit = (rows) => {
    const list = (rows || [])
      .map(normalizeSbTicketType)
      .filter(Boolean)
      .filter((t) => !eventId || t.eventId === eventId);
    const json = JSON.stringify(list);
    if (json === lastJson) return;
    lastJson = json;
    callback(list);
  };

  const unsub = subscribeCatalog("ticket_types", emit);
  refreshCatalog("ticket_types");
  return unsub;
}
