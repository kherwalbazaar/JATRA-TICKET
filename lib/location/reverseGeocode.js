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
  console.log("REVERSE GEOCODING:", latitude, longitude);

  // 1. BigDataCloud (free, fast, reliable, CORS enabled)
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (res.ok) {
      const d = await res.json();
      const adminList = Array.isArray(d.localityInfo?.administrative) ? d.localityInfo.administrative : [];
      const districtEntry = adminList.find(
        (a) => /district/i.test(a.description || a.name || "") || a.adminLevel === 5
      );
      const district = districtEntry
        ? districtEntry.name.replace(/\s+district/i, "").trim()
        : (d.city || null);
      const locality = d.locality || d.city || (adminList.find((a) => a.adminLevel === 6 || a.adminLevel === 7)?.name) || null;
      const state = d.principalSubdivision || null;
      const country = d.countryName || "India";

      let displayName = null;
      if (locality && district && locality.toLowerCase() !== district.toLowerCase()) {
        displayName = `${locality}, ${district}`;
      } else if (locality && state) {
        displayName = `${locality}, ${state}`;
      } else if (district && state) {
        displayName = `${district}, ${state}`;
      } else {
        displayName = locality || district || state || "Odisha";
      }

      return {
        locality,
        city: d.city || locality,
        district,
        state,
        country,
        postalCode: d.postcode || null,
        formattedAddress: [locality, district, state, country].filter(Boolean).join(", "),
        displayName,
      };
    }
  } catch (err) {
    console.warn("BigDataCloud reverse geocode error:", err);
  }

  // 2. OpenStreetMap Nominatim fallback (without forbidden User-Agent header)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`
    );
    if (res.ok) {
      const d = await res.json();
      const a = d.address || {};
      const locality = a.village || a.hamlet || a.suburb || a.town || a.city || a.neighbourhood || null;
      const district = a.district || a.county || a.state_district || null;
      const state = a.state || null;
      const country = a.country || null;

      let displayName = null;
      if (locality && district && locality.toLowerCase() !== district.toLowerCase()) {
        displayName = `${locality}, ${district}`;
      } else {
        displayName = locality || district || state || d.display_name || "Odisha";
      }

      return {
        locality,
        city: a.town || a.city || locality,
        district,
        state,
        country,
        postalCode: a.postcode || null,
        formattedAddress: d.display_name,
        displayName,
      };
    }
  } catch (err) {
    console.warn("Nominatim reverse geocode error:", err);
  }

  return null;
}

/**
 * Format location for display.
 * Priority: displayName > Locality, District > Locality, State > fallback
 */
export function formatLocationName(location) {
  if (!location) return null;
  if (location.displayName) return location.displayName;

  const parts = [];
  if (location.locality) parts.push(location.locality);
  if (location.district && location.district !== location.locality) {
    parts.push(location.district);
  } else if (location.city && location.city !== location.locality) {
    parts.push(location.city);
  }

  if (parts.length > 0) return parts.join(", ");
  if (location.formattedAddress) return location.formattedAddress;
  if (location.state) return location.state;
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
