import { supabase } from "./supabase";

function normalizeSbTicketType(row) {
  if (!row) return null;
  return {
    key: row.id,
    id: row.id,
    name: row.name,
    eventId: row.event_id,
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
    createdAt: row.created_at,
  };
}

/**
 * Ticket types (tier name + price) are authored in JATRA BAZAAR.
 * Fetches directly from Supabase public.ticket_types.
 */
export async function fetchTicketTypes(eventId = "") {
  try {
    let sbQuery = supabase.from("ticket_types").select("*");
    if (eventId) sbQuery = sbQuery.eq("event_id", eventId);
    const { data, error } = await sbQuery;
    if (!error && Array.isArray(data)) {
      return data.map(normalizeSbTicketType).filter(Boolean);
    }
  } catch (err) {
    console.warn("fetchTicketTypes Supabase error:", err?.message);
  }
  return [];
}

export function subscribeTicketTypes(callback, eventId = "") {
  let disposed = false;

  const loadAndEmit = async () => {
    try {
      let sbQuery = supabase.from("ticket_types").select("*");
      if (eventId) sbQuery = sbQuery.eq("event_id", eventId);
      const { data, error } = await sbQuery;
      if (!disposed && !error && Array.isArray(data)) {
        callback(data.map(normalizeSbTicketType).filter(Boolean));
      }
    } catch (e) {
      console.warn("subscribeTicketTypes load error:", e?.message);
    }
  };

  loadAndEmit();

  // Realtime subscription to Supabase ticket_types
  let sbChannel = null;
  try {
    sbChannel = supabase
      .channel(`sb-ticket-types-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_types" },
        () => {
          if (!disposed) loadAndEmit();
        }
      )
      .subscribe();
  } catch (e) {
    console.warn("subscribeTicketTypes channel error:", e?.message);
  }

  return () => {
    disposed = true;
    if (sbChannel) supabase.removeChannel(sbChannel);
  };
}
