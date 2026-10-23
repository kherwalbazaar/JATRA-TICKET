import { supabase, subscribeRealtimeEvents } from "./supabase";

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
    partyName: String(firstDefined(raw.partyName, raw.party_name, "") || ""),
    organizationName: String(
      firstDefined(raw.organizationName, raw.committeeName, raw.committee_name, raw.organizer, "") || "",
    ),
    organizer: String(firstDefined(raw.organizer, raw.committeeName, raw.committee_name, "") || ""),

    // location — Committee location takes priority over party contact address
    committeeLocation: String(
      firstDefined(raw.committeeLocation, raw.committee_location, "") || "",
    ),
    location: String(
      firstDefined(
        raw.committeeLocation,
        raw.committee_location,
        raw.location,
        raw.venue,
        raw.address,
        "",
      ) || "",
    ),
    venue: String(
      firstDefined(
        raw.committeeLocation,
        raw.committee_location,
        raw.venue,
        raw.address,
        "",
      ) || "",
    ),
    address: String(firstDefined(raw.address, "") || ""),

    // copy — seed data uses `about`, the ADMIN form uses `description`
    description: String(firstDefined(raw.description, raw.about, "") || ""),
    actors,

    // timing
    time: String(
      firstDefined(raw.time, raw.startTime, raw.entryTime, "TBD") || "TBD",
    ),
    startTime: String(
      firstDefined(raw.startTime, raw.start_time, raw.time, "") || "",
    ),
    entryTime: String(firstDefined(raw.entryTime, raw.entry_time, "") || ""),
  };
}

function sortByDate(list) {
  return [...list].sort((a, b) => {
    const toTime = (ev) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(ev.date || ""))) {
        const t = Date.parse(`${ev.date}T00:00:00`);
        if (!Number.isNaN(t)) return t;
      }
      const mIdx = MONTHS.indexOf(String(ev.month || "").toUpperCase().slice(0, 3));
      const y = Number(ev.year) || 9999;
      const d = Number(ev.day || ev.dayOfMonth) || 1;
      return new Date(y, mIdx >= 0 ? mIdx : 0, d).getTime();
    };
    return toTime(a) - toTime(b);
  });
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
    ...row,
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
    committeeLocation: row.committee_location || row.committeeLocation || "",
    location: row.committee_location || row.committeeLocation || row.venue || row.address || "",
    venue: row.committee_location || row.committeeLocation || row.venue || row.address || "",
    address: row.address || "",
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
    happyVisitors: Number(row.happy_visitors) || 0,
    totalRevenue: Number(row.total_revenue) || 0,
    writer: row.writer || "",
    director: row.director || "",
    singer: row.singer || "",
    phone: row.phone || "",
    trailerUrl: row.trailer_url || "",
    trailer: row.trailer_url || "",
    credits: row.credits || {
      writer: row.writer || "",
      director: row.director || "",
      singer: row.singer || "",
      music: row.music_director || "",
    },
  };
}

function mergeEventRecords(base = {}, override = {}) {
  const result = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      if (Array.isArray(val) && val.length === 0 && Array.isArray(base[key]) && base[key].length > 0) {
        continue;
      }
      result[key] = val;
    }
  }
  return result;
}

export async function fetchEvents() {
  try {
    const { data, error } = await supabase.from("events").select("*");
    if (!error && data && data.length) {
      const sbList = data.map(normalizeSupabaseEvent);
      return sortByDate(sbList);
    }
  } catch (err) {
    console.warn("fetchEvents Supabase read notice:", err?.message);
  }
  return [];
}

export function subscribeEvents(callback) {
  let disposed = false;

  const loadAndEmit = async () => {
    try {
      const { data, error } = await supabase.from("events").select("*");
      if (!disposed && !error && data) {
        const events = sortByDate(data.map(normalizeSupabaseEvent));
        callback(events);
      }
    } catch (err) {
      console.warn("subscribeEvents fetch warning:", err);
    }
  };

  // 1. Initial fetch
  loadAndEmit();

  // 2. Realtime subscription to events table
  let sbUnsub = () => {};
  try {
    sbUnsub = subscribeRealtimeEvents(() => {
      loadAndEmit();
    });
  } catch (err) {
    console.warn("subscribeRealtimeEvents warning:", err);
  }

  return () => {
    disposed = true;
    if (sbUnsub) sbUnsub();
  };
}

export function formatEventDateDots(ev) {
  if (!ev) return "";
  const rawDate = String(ev.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split("-");
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  if (ev.year && ev.month && ev.day) {
    const mIdx = MONTHS.indexOf(String(ev.month).toUpperCase().slice(0, 3));
    const mNum = mIdx >= 0 ? mIdx + 1 : 1;
    const dNum = Number(ev.day || ev.dayOfMonth || 1);
    const yNum = Number(ev.year || 2026);
    return `${String(dNum).padStart(2, "0")}.${String(mNum).padStart(2, "0")}.${yNum}`;
  }
  const parsed = Date.parse(rawDate.replace(/sept/gi, "sep"));
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
  return rawDate || "xx.xx.xxxx";
}

export function getEventExpiryInfo(ev) {
  if (!ev) return { isExpired: false, formattedDate: "", message: "" };

  const formattedDate = formatEventDateDots(ev);
  const rawStatus = String(ev.status || "").toLowerCase();
  let isExpired = rawStatus === "expired" || rawStatus === "ended" || rawStatus === "past" || rawStatus === "completed";

  if (!isExpired) {
    let d = null;
    const rawDate = String(ev.date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const parts = rawDate.split("-");
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else if (ev.year && ev.month && ev.day) {
      const mIdx = MONTHS.indexOf(String(ev.month).toUpperCase().slice(0, 3));
      const dayNum = Number(ev.day || ev.dayOfMonth || 1);
      const yNum = Number(ev.year || new Date().getFullYear());
      d = new Date(yNum, mIdx >= 0 ? mIdx : 0, dayNum);
    } else if (rawDate) {
      const parsed = Date.parse(rawDate.replace(/sept/gi, "sep"));
      if (!isNaN(parsed)) d = new Date(parsed);
    }

    if (d && !isNaN(d.getTime())) {
      const timeStr = String(ev.time || ev.startTime || ev.showTime || "").trim();
      const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const mins = match[2] ? parseInt(match[2], 10) : 0;
        const meridiem = (match[3] || "").toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        d.setHours(hours, mins, 0, 0);
        if (hours >= 18) {
          d.setDate(d.getDate() + 1);
          d.setHours(6, 0, 0, 0);
        }
        isExpired = d.getTime() < Date.now();
      } else {
        d.setHours(23, 59, 59, 999);
        isExpired = d.getTime() < Date.now();
      }
    }
  }

  return {
    isExpired,
    formattedDate,
    message: isExpired ? `This event is expired on date ${formattedDate}` : "",
  };
}
