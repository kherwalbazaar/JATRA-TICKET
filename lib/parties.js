import { subscribeEvents } from "./events";

export function isCommitteeName(name) {
  if (!name) return true;
  const upper = String(name).trim().toUpperCase();
  return (
    upper.includes("MANDAWA") ||
    upper.includes("COMMITTEE") ||
    upper.includes("SAMITI") ||
    upper.includes("ANUSTHAN") ||
    upper.includes("PARBON PATA") ||
    upper === "ADIM LAHAH MANDAWA"
  );
}

const DUMMY_NAMES = new Set([
  "DHARAM GADIA OPERA",
  "KHERWAL BIR DILGAR OPERA",
  "SANTALI RANGAMOHAL",
  "SARNA DILGAR OPERA",
  "ADIM LAHAH MANDAWA",
]);

// Real Opera Parties configured in Jatra Bazaar Events Directory
export const DEFAULT_PARTIES = [
  {
    id: "party-adim-owar-jarpa",
    name: "ADIM OWAR JARPA OPERA",
    shortName: "Jarpa Opera",
    logo: "https://ik.imagekit.io/kherwalbazaar/MANDAWA/JARPA%202026.jpg?updatedAt=1789577829940",
    genre: "Santali Cultural Opera",
    location: "Polasdiha, Baghda, Suliapada",
    director: "Dasarath Singh",
    phone: "0123456789",
    activeShows: 1,
    color: "from-amber-500 to-rose-600",
  },
  {
    id: "party-ramraj-gayan-mohal",
    name: "RAMRAJ GAYAN MOHAL",
    shortName: "Ramraj Opera",
    logo: "https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg",
    genre: "Santali Cultural Opera",
    location: "Basipitha, Khunta, Mayurbhanj, Odisha - 757035",
    director: "Dasarath Sing",
    phone: "+91 6372859599",
    activeShows: 1,
    color: "from-indigo-500 to-purple-600",
  },
];

const STORAGE_KEY = "jatra_custom_parties";

export function getLocalParties() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Scrub out dummy parties and committee names
    const filtered = list.filter(
      (p) =>
        p &&
        p.id !== "party-adim-lahah-mandawa" &&
        !isCommitteeName(p.name) &&
        !DUMMY_NAMES.has(String(p.name || "").trim().toUpperCase())
    );
    if (filtered.length !== list.length) {
      saveLocalParties(filtered);
    }
    return filtered;
  } catch {
    return [];
  }
}

export function saveLocalParties(list) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Extracts real opera parties directly from live events in Jatra Bazaar Events Directory.
 */
export function extractPartiesFromEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const map = new Map();

  events.forEach((ev) => {
    const rawParty = String(ev.partyName || ev.party_name || "").trim();
    if (!rawParty || isCommitteeName(rawParty)) return;
    const key = rawParty.toUpperCase();

    const poster = ev.poster || ev.banner || ev.img || "";
    const location = ev.venue || ev.address || ev.location || ev.city || "Mayurbhanj, Odisha";
    const phone = ev.phone || "";
    const director = ev.director || "";
    const language = ev.language || "Santali";

    if (map.has(key)) {
      const existing = map.get(key);
      existing.activeShows = (existing.activeShows || 0) + 1;
      if (!existing.logo && poster) existing.logo = poster;
      if (!existing.location && location) existing.location = location;
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.director && director) existing.director = director;
    } else {
      map.set(key, {
        id: `party-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: rawParty,
        shortName: rawParty.split(/\s+/).slice(0, 2).join(" "),
        logo: poster,
        genre: `${language} Cultural Opera`,
        location,
        director,
        phone,
        activeShows: 1,
        color: key.includes("RAMRAJ")
          ? "from-indigo-500 to-purple-600"
          : "from-amber-500 to-rose-600",
      });
    }
  });

  return Array.from(map.values());
}

/**
 * Subscribes to real opera parties derived directly from live events in Jatra Bazaar Events Directory.
 */
export function subscribeParties(callback) {
  // Emit initial real parties immediately
  callback(DEFAULT_PARTIES);

  // Subscribe to real events from database
  try {
    const unsub = subscribeEvents((events) => {
      if (Array.isArray(events) && events.length > 0) {
        const realParties = extractPartiesFromEvents(events);
        if (realParties.length > 0) {
          callback(realParties);
          return;
        }
      }
      callback(DEFAULT_PARTIES);
    });

    return unsub;
  } catch (err) {
    console.warn("subscribeParties error:", err);
    return () => {};
  }
}
