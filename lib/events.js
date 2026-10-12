import {
  collection,
  getDocs,
  onSnapshot,
  query,
} from "firebase/firestore";
import { firestore } from "./firebase";
import { supabase, subscribeRealtimeEvents } from "./supabase";

const SHOWS_COL = "shows";
const EVENTS_COL = "events";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const DAY_LOOKUP = DAY_NAMES.reduce((acc, name, i) => {
  acc[name.toLowerCase()] = i;
  acc[name.slice(0, 3).toLowerCase()] = i;
  return acc;
}, {});

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

/**
 * The ADMIN writes events with `poster`, `additionalBanners`, `dayOfMonth`,
 * `day` (weekday name), `month`, `year`, `committeeName` … while the
 * customer app renders `banner` / `img`, `banners`, numeric `day`,
 * `organizationName`. Normalising here means every screen in this app reads
 * one consistent shape regardless of which app wrote the document.
 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return raw;

  const event = { ...raw };

  // ── date parts ───────────────────────────────────────────────
  // `day` is a weekday name in ADMIN payloads and a number in older data.
  const rawDay = String(firstDefined(raw.day, "")).trim();
  const numericDay =
    raw.dayOfMonth ||
    (/^\d{1,2}$/.test(rawDay) ? rawDay : "") ||
    (/^(\d{1,2})\s+\w+\s+\d{4}$/.test(String(raw.date || ""))
      ? String(raw.date).split(" ")[0]
      : "");

  const rawMonth = String(firstDefined(raw.month, "")).trim();
  const month =
    MONTHS.find((m) => m === rawMonth.toUpperCase().slice(0, 3)) ||
    MONTHS[new Date(`${rawMonth} 1, 2000`).getMonth()] ||
    "JAN";

  const year =
    String(firstDefined(raw.year, "")) ||
    (String(raw.date || "").match(/\d{4}/) || [""])[0] ||
    String(new Date().getFullYear());

  const dayNumber = /^\d{1,2}$/.test(numericDay) ? numericDay : "1";
  const monthIndex = MONTHS.indexOf(month);
  const weekdayName =
    rawDay && DAY_LOOKUP[rawDay.toLowerCase()] !== undefined
      ? DAY_NAMES[DAY_LOOKUP[rawDay.toLowerCase()]]
      : DAY_NAMES[new Date(Number(year) || 2000, monthIndex, Number(dayNumber)).getDay()];

  // ── imagery ──────────────────────────────────────────────────
  const poster = String(firstDefined(raw.poster, raw.banner, raw.img, "") || "");
  const extraBanners = [
    ...asArray(raw.banners).map(String),
    ...asArray(raw.additionalBanners).map(String),
  ];
  const banners = [...new Set([poster, ...extraBanners].filter(Boolean))];

  const actors = asArray(raw.actors).length ? raw.actors : asArray(raw.cast);

  return {
    ...event,

    // date
    month,
    day: dayNumber,
    dayOfMonth: dayNumber,
    dayName: weekdayName,
    year,
    weekday: weekdayName,

    // imagery — ADMIN stores `poster`, this app renders `banner` / `img`
    poster: poster || (banners[0] || ""),
    banner: poster || (banners[0] || ""),
    img: poster || (banners[0] || ""),
    banners,

    // naming — ADMIN's `eventTitle` is the show title (e.g. "PARBON PATA");
    // older/seeded docs only carry `name`, and `title` is the long story line.
    name: String(firstDefined(raw.eventTitle, raw.name, raw.title, "") || ""),
    eventTitle: String(firstDefined(raw.eventTitle, raw.title, "") || ""),
    title: String(firstDefined(raw.title, raw.eventTitle, "") || ""),
    partyName: String(firstDefined(raw.partyName, raw.organizer, "") || ""),
    organizationName: String(
      firstDefined(raw.organizationName, raw.committeeName, raw.organizer, "") || "",
    ),
    organizer: String(firstDefined(raw.organizer, raw.committeeName, "") || ""),

    // location — ADMIN stores `venue` (and `address`)
    location: String(firstDefined(raw.location, raw.venue, raw.address, "") || ""),
    venue: String(firstDefined(raw.venue, raw.address, "") || ""),

    // copy — seed data uses `about`, the ADMIN form uses `description`
    description: String(firstDefined(raw.description, raw.about, "") || ""),
    actors,

    // timing
    time: String(
      firstDefined(raw.time, raw.startTime, raw.entryTime, "TBD") || "TBD",
    ),
  };
}

function mapDocs(snap) {
  // The Firestore document id is authoritative — ensure showId and eventId are populated identically
  return snap.docs.map((d) => ({
    ...normalizeEvent(d.data()),
    key: d.id,
    id: d.id,
    showId: d.id,
    eventId: d.id,
  }));
}

export function normalizeSupabaseEvent(row) {
  if (!row || typeof row !== "object") return row;
  const rawDate = String(row.date || "");
  const parts = rawDate.split("-"); // YYYY-MM-DD
  let day = "1";
  let month = "JAN";
  let year = "2026";
  if (parts.length === 3) {
    year = parts[0];
    const mIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
    month = MONTHS[mIdx] || "JAN";
    day = String(Number(parts[2]) || 1);
  }
  const dateObj = new Date(row.date || Date.now());
  const weekdayName = DAY_NAMES[dateObj.getDay()] || "Sunday";

  const rawBanners = Array.isArray(row.additional_banners) ? row.additional_banners : [];
  const poster = row.poster || (rawBanners[0] || "");
  const banners = [...new Set([poster, ...rawBanners].filter(Boolean))];

  return {
    id: row.id,
    key: row.id,
    showId: row.id,
    eventId: row.id,
    name: row.event_title || row.title || "Jatra Show",
    eventTitle: row.event_title || row.title || "Jatra Show",
    title: row.title || row.event_title || "Jatra Show",
    partyName: row.party_name || "",
    organizationName: row.committee_name || row.party_name || "",
    organizer: row.organizer || row.committee_name || "",
    location: row.venue || row.committee_location || row.address || "",
    venue: row.venue || row.address || "",
    city: row.city || "",
    description: row.description || "",
    actors: Array.isArray(row.actors) ? row.actors : [],
    poster,
    banner: poster,
    img: poster,
    banners,
    date: row.date,
    day,
    dayOfMonth: day,
    dayName: weekdayName,
    weekday: weekdayName,
    month,
    year,
    time: row.start_time || row.time || row.entry_time || "11:00 PM",
    startTime: row.start_time || row.time || "",
    entryTime: row.entry_time || "",
    status: row.status || "upcoming",
    totalCapacity: Number(row.total_capacity) || 0,
    ticketsSold: Number(row.tickets_sold) || 0,
    totalRevenue: Number(row.total_revenue) || 0,
  };
}

export async function fetchEvents() {
  let sbList = [];
  try {
    const { data, error } = await supabase.from("events").select("*");
    if (!error && data && data.length) {
      sbList = data.map(normalizeSupabaseEvent);
    }
  } catch (err) {
    console.warn("fetchEvents Supabase read notice:", err?.message);
  }

  let fsList = [];
  try {
    const snap = await getDocs(collection(firestore, SHOWS_COL));
    if (!snap.empty) {
      fsList = mapDocs(snap);
    } else {
      const evSnap = await getDocs(collection(firestore, EVENTS_COL));
      if (!evSnap.empty) fsList = mapDocs(evSnap);
    }
  } catch (err) {
    console.warn("fetchEvents Firestore read notice:", err?.message);
  }

  const map = new Map();
  for (const item of fsList) map.set(item.id, item);
  for (const item of sbList) map.set(item.id, { ...(map.get(item.id) || {}), ...item });

  const merged = Array.from(map.values());
  return merged.length ? merged : fsList;
}

export function subscribeEvents(callback) {
  let fallbackUnsub = null;
  let disposed = false;
  let lastFsEvents = [];
  let lastSbEvents = [];

  const emit = () => {
    if (disposed) return;
    const map = new Map();
    for (const item of lastFsEvents) map.set(item.id, item);
    for (const item of lastSbEvents) map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    const merged = Array.from(map.values());
    callback(merged);
  };

  // 1. Initial Supabase fetch & Realtime subscription
  supabase
    .from("events")
    .select("*")
    .then(({ data, error }) => {
      if (!disposed && !error && data) {
        lastSbEvents = data.map(normalizeSupabaseEvent);
        emit();
      }
    })
    .catch((err) => console.warn("Supabase initial events warning:", err));

  const sbUnsub = subscribeRealtimeEvents(() => {
    supabase
      .from("events")
      .select("*")
      .then(({ data, error }) => {
        if (!disposed && !error && data) {
          lastSbEvents = data.map(normalizeSupabaseEvent);
          emit();
        }
      });
  });

  // 2. Firestore listener
  const unsubscribe = onSnapshot(
    collection(firestore, SHOWS_COL),
    (snap) => {
      if (disposed) return;
      if (!snap.empty) {
        if (fallbackUnsub) {
          fallbackUnsub();
          fallbackUnsub = null;
        }
        lastFsEvents = mapDocs(snap);
        emit();
      } else {
        if (!fallbackUnsub) {
          fallbackUnsub = onSnapshot(
            collection(firestore, EVENTS_COL),
            (evSnap) => {
              if (!disposed && snap.empty) {
                lastFsEvents = mapDocs(evSnap);
                emit();
              }
            },
            (error) => {
              console.error("subscribeEvents legacy events error:", error);
            }
          );
        }
      }
    },
    (error) => {
      console.warn("subscribeEvents shows error, falling back:", error);
      if (!fallbackUnsub) {
        fallbackUnsub = onSnapshot(
          collection(firestore, EVENTS_COL),
          (evSnap) => {
            lastFsEvents = mapDocs(evSnap);
            emit();
          },
          (err) => {
            console.error("subscribeEvents fallback error:", err);
          }
        );
      }
    }
  );

  return () => {
    disposed = true;
    unsubscribe();
    if (fallbackUnsub) fallbackUnsub();
    if (sbUnsub) sbUnsub();
  };
}
