/**
 * Geolocation utility — wraps browser navigator.geolocation.
 * Simple, proven pattern. No overcomplication.
 *
 * NEVER fabricates coordinates.
 * NEVER returns hardcoded location.
 */

/**
 * Detect device GPS location.
 *
 * @param {function} onSuccess - Called with { latitude, longitude, accuracy }
 * @param {function} onError   - Called with { code, message }
 *
 * Error codes (native GeolocationPositionError):
 *   error.PERMISSION_DENIED   = 1
 *   error.POSITION_UNAVAILABLE = 2
 *   error.TIMEOUT             = 3
 */
export function detectDeviceLocation(onSuccess, onError) {
  if (!("geolocation" in navigator)) {
    onError({
      code: 0,
      message: "Geolocation is not supported by your browser.",
    });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      console.log("GPS DETECTED:");
      console.log("  Latitude:", latitude);
      console.log("  Longitude:", longitude);
      console.log("  Accuracy:", accuracy, "meters");

      onSuccess({ latitude, longitude, accuracy });
    },
    (error) => {
      let message;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = "User denied the request for Geolocation.";
          break;
        case error.POSITION_UNAVAILABLE:
          message = "Location information is unavailable.";
          break;
        case error.TIMEOUT:
          message = "The request to get user location timed out.";
          break;
        default:
          message = "An unknown error occurred.";
          break;
      }

      console.error("GPS ERROR:", error.code, message);

      onError({ code: error.code, message });
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
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
