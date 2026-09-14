/**
 * Reverse geocoding — client-side, free APIs only (no keys needed).
 * Nominatim (OpenStreetMap) + BigDataCloud (free tier).
 */

/**
 * Reverse geocode coordinates using multiple free providers in parallel.
 * Returns normalized location object or null.
 * Always uses the EXACT coordinates passed in — never substitutes.
 */
export async function reverseGeocode(latitude, longitude) {
  console.log("REVERSE GEOCODING:");
  console.log("  lat:", latitude);
  console.log("  lon:", longitude);

  const services = [
    // Nominatim (OpenStreetMap) — free, no key
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "JatraBazaarApp/1.0 (jatrabazaar@contact.com)" } }
    ).then(async (r) => {
      if (!r.ok) throw 0;
      const d = await r.json();
      const a = d.address || {};
      return {
        locality: a.village || a.hamlet || a.suburb || a.neighbourhood || null,
        city: a.town || a.city || null,
        district: a.district || a.county || a.state_district || null,
        state: a.state || null,
        country: a.country || null,
        postalCode: a.postcode || null,
      };
    }),

    // BigDataCloud — free, no key
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    ).then(async (r) => {
      if (!r.ok) throw 0;
      const d = await r.json();
      return {
        locality: d.locality || null,
        city: d.city || null,
        district: d.principalSubdivision || null,
        state: d.principalSubdivision || null,
        country: d.countryName || null,
        postalCode: d.postcode || null,
      };
    }),
  ];

  const results = await Promise.allSettled(services);
  const valid = results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);

  if (valid.length === 0) {
    console.warn("All geocoding services failed");
    return null;
  }

  // Merge: prefer Nominatim for locality (village-level), BigDataCloud for district
  const merged = {
    locality: valid.find((r) => r.locality)?.locality || null,
    city: valid.find((r) => r.city)?.city || null,
    district: valid.find((r) => r.district)?.district || null,
    state: valid.find((r) => r.state)?.state || null,
    country: valid.find((r) => r.country)?.country || null,
    postalCode: valid.find((r) => r.postalCode)?.postalCode || null,
  };

  merged.formattedAddress = buildFormattedAddress(merged);

  console.log("GEOCODE RESULT:", merged);
  return merged;
}

function buildFormattedAddress(parts) {
  const filtered = [parts.locality, parts.district, parts.state, parts.country].filter(Boolean);
  return filtered.join(", ") || null;
}

/**
 * Format location for display.
 * Priority: Village/Town, District, State
 */
export function formatLocationName(location) {
  if (!location) return null;

  const parts = [];
  if (location.locality) parts.push(location.locality);
  if (location.district) parts.push(location.district);
  if (location.state) parts.push(location.state);

  if (parts.length > 0) return parts.join(", ");
  if (location.city) return location.city;
  if (location.formattedAddress) return location.formattedAddress;
  return null;
}

/**
 * Format accuracy for display with tiers.
 * Returns { text, tier } where tier is "high" | "medium" | "low"
 */
export function formatAccuracy(meters) {
  if (!meters && meters !== 0) return { text: null, tier: null };

  let text;
  if (meters < 1000) {
    text = `\u00b1${Math.round(meters)} m`;
  } else {
    text = `\u00b1${(meters / 1000).toFixed(1)} km`;
  }

  let tier;
  if (meters <= 100) tier = "high";
  else if (meters <= 1000) tier = "medium";
  else tier = "low";

  return { text, tier };
}
