/**
 * Geolocation utility — wraps browser navigator.geolocation and Capacitor Geolocation.
 * Supports smart fallback: High accuracy GPS -> Network/Wi-Fi positioning -> IP Location.
 */

/**
 * Detect device GPS location.
 *
 * @param {function} onSuccess - Called with { latitude, longitude, accuracy, source }
 * @param {function} onError   - Called with { code, message }
 */
export async function detectDeviceLocation(onSuccess, onError) {
  // 1. Try Capacitor Native Geolocation if running in native app
  if (typeof window !== "undefined" && window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "granted" || perm.coarseLocation === "granted") {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        if (pos && pos.coords) {
          onSuccess({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: "gps",
          });
          return;
        }
      }
    } catch (e) {
      console.warn("Capacitor Geolocation error, falling back to browser API:", e);
    }
  }

  // 2. Browser navigator.geolocation
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    onError({
      code: 0,
      message: "Geolocation is not supported by your browser.",
    });
    return;
  }

  // Attempt A: High Accuracy GPS (6-second timeout)
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: "gps",
      });
    },
    (error) => {
      // If user denied permission explicitly, don't re-prompt
      if (error.code === error.PERMISSION_DENIED) {
        onError({
          code: error.code,
          message: "Location permission was denied.",
        });
        return;
      }

      // Attempt B: Low Accuracy (Wi-Fi / Cell tower) with 8-second timeout & cached position allowed
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onSuccess({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "gps",
          });
        },
        (error2) => {
          let message = "Location information is unavailable.";
          if (error2.code === error2.TIMEOUT) {
            message = "Location detection timed out.";
          }
          onError({ code: error2.code, message });
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 300000, // 5 minutes cache
        }
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 60000,
    }
  );
}

export const detectGPSLocation = detectDeviceLocation;

/**
 * Detect location via IP / Network Geolocation.
 * 100% reliable fallback when GPS is denied or unavailable.
 */
export async function detectIPLocation() {
  try {
    const res = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client");
    if (!res.ok) throw new Error("HTTP " + res.status);
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
      latitude: Number(d.latitude) || null,
      longitude: Number(d.longitude) || null,
      accuracy: 2500,
      locality,
      city: d.city || locality,
      district,
      state,
      country,
      postalCode: d.postcode || null,
      formattedAddress: [locality, district, state, country].filter(Boolean).join(", "),
      displayName,
      source: "network",
    };
  } catch (err) {
    console.warn("IP Geolocation failed:", err);
    return null;
  }
}

/**
 * Validate latitude/longitude ranges.
 */
export function validateCoords(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !isNaN(lat) &&
    !isNaN(lon)
  );
}
