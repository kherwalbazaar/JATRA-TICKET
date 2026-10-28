import { supabase } from "./supabase";
import { firestore } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { subscribeEvents, isLogoUrl, getPartyKnownBanner, getPartyKnownLogo } from "./events";

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
    logo: "https://ik.imagekit.io/kherwalbazaar/JARPA%20Opera.png",
    banner: "https://ik.imagekit.io/kherwalbazaar/MANDAWA/JARPA%202026.jpg?updatedAt=1789577829940",
    genre: "Santali Cultural Opera",
    location: "Polasdiha, Baghda, Suliapada",
    director: "Dasarath Singh",
    writer: "Kanhu Marndi",
    phone: "0123456789",
    phone2: "9876543210",
    activeShows: 1,
    color: "from-amber-500 to-rose-600",
    status: "active",
  },
  {
    id: "party-ramraj-gayan-mohal",
    name: "RAMRAJ GAYAN MOHAL",
    shortName: "Ramraj Opera",
    logo: "https://ik.imagekit.io/kherwalbazaar/Ramraj%20Gayan%20Mahal.png?updatedAt=1792327416537",
    banner: "https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg",
    genre: "Santali Cultural Opera",
    location: "Basipitha, Khunta, Mayurbhanj, Odisha - 757035",
    director: "Dasarath Sing",
    writer: "Maheswar Soren",
    phone: "+91 6372859599",
    phone2: "+91 9437123456",
    activeShows: 1,
    color: "from-indigo-500 to-purple-600",
    status: "active",
  },
  {
    id: "party-nahah-opera",
    name: "NAHAH OPERA",
    shortName: "Nahah Opera",
    logo: "https://ik.imagekit.io/kherwalbazaar/Nahah%20Opera%20Logo.png",
    banner: "https://ik.imagekit.io/kherwalbazaar/Nahah%20Opera.jpeg",
    genre: "Santali Cultural Opera",
    location: "Mayurbhanj, Odisha",
    director: "Radhanath",
    writer: "",
    phone: "",
    phone2: "",
    activeShows: 1,
    color: "from-purple-500 to-pink-600",
    status: "active",
  },
  {
    id: "party-jatra-baba-munirushi",
    name: "JATRA BABA MUNIRUSHI OPERA",
    shortName: "Munirushi Opera",
    logo: "",
    banner: "",
    genre: "Santali Cultural Opera",
    location: "Sankhabhanga, Baripada, Mayurbhanj, Odisha",
    director: "Makar Majhi",
    writer: "Sundar Mohan Kisku",
    phone: "7684091944",
    phone2: "9938388530",
    activeShows: 0,
    color: "from-emerald-500 to-teal-600",
    status: "active",
  },
  {
    id: "party-baba-gajeswar-gayan-bakhul",
    name: "BABA GAJESWAR GAYAN BAKHUL",
    shortName: "Gajeswar Bakhul",
    logo: "",
    banner: "",
    genre: "Santali Cultural Opera",
    location: "Mayurbhanj, Odisha",
    director: "",
    writer: "Subash Chandra Hansdah",
    phone: "8260971836",
    phone2: "9583252256",
    activeShows: 0,
    color: "from-amber-500 to-orange-600",
    status: "active",
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
 * Fetches configured custom parties from Supabase settings table (id = 'parties')
 * or Firestore settings/parties fallback.
 */
export async function fetchRemoteParties() {
  // 1. Try Supabase settings table first
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("id", "parties");

    if (!error && Array.isArray(data) && data.length > 0) {
      const partiesData = data[0]?.data?.parties || (Array.isArray(data[0]?.data) ? data[0].data : null);
      if (Array.isArray(partiesData) && partiesData.length > 0) {
        const valid = partiesData.filter(
          (p) => p && p.name && !isCommitteeName(p.name) && !DUMMY_NAMES.has(String(p.name).trim().toUpperCase())
        );
        if (valid.length > 0) {
          saveLocalParties(valid);
          return valid;
        }
      }
    }
  } catch (err) {
    console.warn("fetchRemoteParties Supabase error:", err?.message);
  }

  // 2. Try Firestore settings/parties fallback
  try {
    if (firestore) {
      const snap = await getDoc(doc(firestore, "settings", "parties"));
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d?.parties) && d.parties.length > 0) {
          const valid = d.parties.filter(
            (p) => p && p.name && !isCommitteeName(p.name) && !DUMMY_NAMES.has(String(p.name).trim().toUpperCase())
          );
          if (valid.length > 0) {
            saveLocalParties(valid);
            return valid;
          }
        }
      }
    }
  } catch (err) {
    console.warn("fetchRemoteParties Firestore error:", err?.message);
  }

  return getLocalParties();
}

/**
 * Computes unified parties list by merging:
 * 1. DEFAULT_PARTIES
 * 2. Custom parties configured in Opera Parties Directory (from Supabase/Firestore/localStorage)
 * 3. Live events in database (computing activeShows and filling missing metadata)
 */
export function computeParties(events = [], customParties = []) {
  const map = new Map();

  // 1. Baseline DEFAULT_PARTIES
  DEFAULT_PARTIES.forEach((p) => {
    const key = String(p.name || "").trim().toUpperCase();
    if (!key) return;
    map.set(key, { ...p, activeShows: 0 });
  });

  // 2. Custom parties from Opera Parties Directory (Supabase / Firestore / localStorage)
  const sourceParties =
    Array.isArray(customParties) && customParties.length > 0
      ? customParties
      : getLocalParties();

  sourceParties.forEach((p) => {
    if (!p || !p.name || isCommitteeName(p.name) || DUMMY_NAMES.has(String(p.name).trim().toUpperCase())) return;
    const key = String(p.name).trim().toUpperCase();
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        ...p,
        logo: p.logo || existing.logo,
        director: p.director || existing.director,
        writer: p.writer || existing.writer,
        phone: p.phone || existing.phone,
        phone2: p.phone2 || existing.phone2,
        location: p.location || existing.location,
        activeShows: existing.activeShows || 0,
      });
    } else {
      map.set(key, {
        id: p.id || `party-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        ...p,
        activeShows: 0,
      });
    }
  });

  // 3. Overlay and calculate active shows from real events in database
  if (Array.isArray(events) && events.length > 0) {
    events.forEach((ev) => {
      const rawParty = String(ev.partyName || ev.party_name || "").trim();
      if (!rawParty || isCommitteeName(rawParty) || DUMMY_NAMES.has(rawParty.toUpperCase())) return;
      const key = rawParty.toUpperCase();

      const knownLogo = getPartyKnownLogo(rawParty);
      const knownBanner = getPartyKnownBanner(rawParty);
      const poster = ev.poster || ev.banner || ev.img || "";
      const partyLogo = ev.logo || (isLogoUrl(poster) ? poster : "") || knownLogo || "";
      const partyBanner = (!isLogoUrl(ev.banner) ? ev.banner : "") || (!isLogoUrl(poster) ? poster : "") || knownBanner || "";
      const location = ev.venue || ev.address || ev.location || ev.city || "Mayurbhanj, Odisha";
      let phone = ev.phone || "";
      let phone2 = ev.phone2 || "";
      if (!phone2 && (phone.includes(",") || phone.includes("/"))) {
        const parts = phone.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
        phone = parts[0] || "";
        phone2 = parts.slice(1).join(" / ") || "";
      }
      const director = ev.director || "";
      const writer = ev.writer || "";
      const language = ev.language || "Santali";

      if (map.has(key)) {
        const existing = map.get(key);
        existing.activeShows = (existing.activeShows || 0) + 1;
        if ((!existing.logo || isLogoUrl(existing.banner)) && partyLogo) existing.logo = partyLogo;
        if (!existing.banner && partyBanner) existing.banner = partyBanner;
        if (!existing.location && location) existing.location = location;
        if (!existing.phone && phone) existing.phone = phone;
        if (!existing.phone2 && phone2) existing.phone2 = phone2;
        if (!existing.director && director) existing.director = director;
        if (!existing.writer && writer) existing.writer = writer;
      } else {
        map.set(key, {
          id: `party-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: rawParty,
          shortName: rawParty.split(/\s+/).slice(0, 2).join(" "),
          logo: partyLogo,
          banner: partyBanner,
          genre: `${language} Cultural Opera`,
          location,
          director,
          writer,
          phone,
          phone2,
          activeShows: 1,
          color: key.includes("RAMRAJ")
            ? "from-indigo-500 to-purple-600"
            : "from-amber-500 to-rose-600",
          status: "active",
        });
      }
    });
  }

  return Array.from(map.values());
}

/**
 * Extracts real opera parties directly from live events in Jatra Bazaar Events Directory.
 * (Preserved for backwards compatibility)
 */
export function extractPartiesFromEvents(events) {
  return computeParties(events, []);
}

/**
 * Resolves a party from DEFAULT_PARTIES, custom local parties, or by name/id matching.
 */
export function findParty(identifier) {
  if (!identifier) return null;
  const str = String(identifier).trim().toUpperCase();
  if (!str) return null;

  const all = [...DEFAULT_PARTIES, ...getLocalParties()];

  // 1. Exact ID or Name match
  let matched = all.find(
    (p) =>
      p &&
      (String(p.id).toUpperCase() === str ||
        String(p.name || "").trim().toUpperCase() === str ||
        String(p.shortName || "").trim().toUpperCase() === str)
  );

  if (matched) return matched;

  // 2. Substring / fuzzy match
  matched = all.find((p) => {
    if (!p || !p.name) return false;
    const pName = String(p.name).trim().toUpperCase();
    const pShort = String(p.shortName || "").trim().toUpperCase();
    return (
      str.includes(pName) ||
      pName.includes(str) ||
      (pShort && (str.includes(pShort) || pShort.includes(str)))
    );
  });

  return matched || null;
}

/**
 * Finds the corresponding Opera Party for a given event object.
 */
export function findPartyForEvent(event) {
  if (!event || typeof event !== "object") return null;

  return (
    findParty(event.partyId) ||
    findParty(event.party_id) ||
    findParty(event.partyName) ||
    findParty(event.party_name) ||
    findParty(event.name) ||
    findParty(event.eventTitle) ||
    findParty(event.title) ||
    findParty(event.organizer) ||
    findParty(event.organizationName) ||
    findParty(event.committee) ||
    findParty(event.key) ||
    findParty(event.id)
  );
}

/**
 * Live subscription to real opera parties:
 * Listens to:
 * 1. Supabase settings table (id = 'parties')
 * 2. Live events database updates
 * Combines them seamlessly so parties created in Admin Directory appear in real-time.
 */
export function subscribeParties(callback) {
  if (typeof callback !== "function") return () => {};

  let disposed = false;
  let currentEvents = [];
  let currentCustomParties = getLocalParties();

  const emit = () => {
    if (disposed) return;
    const list = computeParties(currentEvents, currentCustomParties);
    callback(list);
  };

  // 1. Emit immediately with cached/default data
  emit();

  // 2. Fetch latest custom parties from Supabase/Firestore
  fetchRemoteParties().then((remote) => {
    if (disposed) return;
    if (Array.isArray(remote) && remote.length > 0) {
      currentCustomParties = remote;
      emit();
    }
  });

  // 3. Realtime subscription to Supabase settings table for instant admin sync
  let sbChannel = null;
  try {
    sbChannel = supabase
      .channel(`parties-settings-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settings",
          filter: "id=eq.parties",
        },
        async () => {
          if (disposed) return;
          const updated = await fetchRemoteParties();
          if (!disposed && Array.isArray(updated)) {
            currentCustomParties = updated;
            emit();
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("subscribeParties Supabase channel error:", err?.message);
  }

  // 4. Subscribe to events updates
  let unsubEvents = () => {};
  try {
    unsubEvents = subscribeEvents((events) => {
      if (disposed) return;
      currentEvents = Array.isArray(events) ? events : [];
      emit();
    });
  } catch (err) {
    console.warn("subscribeParties subscribeEvents error:", err);
  }

  return () => {
    disposed = true;
    if (sbChannel) {
      try {
        supabase.removeChannel(sbChannel);
      } catch {}
    }
    try {
      unsubEvents();
    } catch {}
  };
}
