import {
  collection,
  getDocs,
  onSnapshot,
  query,
} from "firebase/firestore";
import { firestore } from "./firebase";

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
  // The Firestore document id is authoritative — some admin payloads store a
  // stale `id` field (e.g. `EVT-1234`) that does not match the document.
  return snap.docs.map((d) => ({ ...normalizeEvent(d.data()), key: d.id, id: d.id }));
}

export async function fetchEvents() {
  try {
    const q = query(collection(firestore, EVENTS_COL));
    const snap = await getDocs(q);
    return mapDocs(snap);
  } catch (error) {
    console.error("fetchEvents failed:", error?.code, error?.message);
    throw error;
  }
}

export function subscribeEvents(callback) {
  try {
    const q = query(collection(firestore, EVENTS_COL));
    const unsubscribe = onSnapshot(
      q,
      (snap) => callback(mapDocs(snap)),
      (error) => {
        console.error("subscribeEvents error:", error);
        callback([]);
      },
    );
    return unsubscribe;
  } catch (error) {
    console.error("subscribeEvents setup failed:", error);
    return () => {};
  }
}
