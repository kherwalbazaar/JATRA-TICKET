import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "./firebase";
import { supabase } from "./supabase";

const FIRESTORE_TICKET_TYPES = "ticketTypes";

function mapDocs(snap) {
  return snap.docs.map((d) => ({ key: d.id, id: d.id, ...d.data() }));
}

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
 * Ticket types (tier name + price) are authored in JATRA BAZAAR ADMIN.
 * Fetches from both Firestore and Supabase, merging them seamlessly.
 */
export async function fetchTicketTypes(eventId = "") {
  const list = [];
  try {
    const q = eventId
      ? query(
          collection(firestore, FIRESTORE_TICKET_TYPES),
          where("eventId", "==", eventId),
        )
      : query(collection(firestore, FIRESTORE_TICKET_TYPES));
    const snap = await getDocs(q);
    list.push(...mapDocs(snap));
  } catch (error) {
    console.error("fetchTicketTypes firestore failed:", error?.code, error?.message);
  }

  try {
    let sbQuery = supabase.from("ticket_types").select("*");
    if (eventId) sbQuery = sbQuery.eq("event_id", eventId);
    const { data: sbTypes } = await sbQuery;
    if (Array.isArray(sbTypes)) {
      const existingNames = new Set(list.map((t) => String(t.name || "").toUpperCase()));
      sbTypes.forEach((st) => {
        const norm = normalizeSbTicketType(st);
        if (norm && !existingNames.has(String(norm.name).toUpperCase())) {
          list.push(norm);
        }
      });
    }
  } catch (e) {
    /* ignore */
  }

  return list;
}

export function subscribeTicketTypes(callback, eventId = "") {
  let disposed = false;
  let lastFs = [];
  let lastSb = [];

  const emit = () => {
    if (disposed) return;
    const combined = [...lastFs];
    const existingNames = new Set(combined.map((t) => String(t.name || "").toUpperCase()));
    lastSb.forEach((st) => {
      if (st && !existingNames.has(String(st.name || "").toUpperCase())) {
        combined.push(st);
      }
    });
    callback(combined);
  };

  // Fetch initial Supabase ticket types
  (async () => {
    try {
      let sbQuery = supabase.from("ticket_types").select("*");
      if (eventId) sbQuery = sbQuery.eq("event_id", eventId);
      const { data } = await sbQuery;
      if (Array.isArray(data) && !disposed) {
        lastSb = data.map(normalizeSbTicketType).filter(Boolean);
        emit();
      }
    } catch (e) {
      /* ignore */
    }
  })();

  // Realtime subscription to Supabase ticket_types
  let sbChannel = null;
  try {
    sbChannel = supabase
      .channel(`sb-ticket-types-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_types" },
        async () => {
          if (disposed) return;
          try {
            let sbQuery = supabase.from("ticket_types").select("*");
            if (eventId) sbQuery = sbQuery.eq("event_id", eventId);
            const { data } = await sbQuery;
            if (Array.isArray(data) && !disposed) {
              lastSb = data.map(normalizeSbTicketType).filter(Boolean);
              emit();
            }
          } catch (e) {}
        }
      )
      .subscribe();
  } catch (e) {}

  let fsUnsub = () => {};
  try {
    const q = eventId
      ? query(
          collection(firestore, FIRESTORE_TICKET_TYPES),
          where("eventId", "==", eventId),
        )
      : query(collection(firestore, FIRESTORE_TICKET_TYPES));
    fsUnsub = onSnapshot(
      q,
      (snap) => {
        lastFs = mapDocs(snap);
        emit();
      },
      (error) => {
        console.error("subscribeTicketTypes firestore error:", error);
      },
    );
  } catch (error) {
    console.error("subscribeTicketTypes setup failed:", error);
  }

  return () => {
    disposed = true;
    fsUnsub();
    if (sbChannel) supabase.removeChannel(sbChannel);
  };
}
