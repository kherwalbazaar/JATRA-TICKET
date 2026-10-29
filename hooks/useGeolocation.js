"use client";

import { useState, useCallback, useRef } from "react";
import { detectDeviceLocation, validateCoords } from "../lib/location/geolocation";
import { reverseGeocode, formatLocationName } from "../lib/location/reverseGeocode";

/**
 * Classify native error code into status string.
 */
function classifyErrorCode(code) {
  switch (code) {
    case 1: return "permission-denied";
    case 2: return "unavailable";
    case 3: return "timeout";
    default: return "error";
  }
}

const EMPTY_STATE = {
  latitude: null,
  longitude: null,
  accuracy: null,
  timestamp: null,

  locality: null,
  city: null,
  district: null,
  state: null,
  country: null,
  postalCode: null,
  formattedAddress: null,
  displayName: null,

  source: null,
  status: "idle",
  error: null,
};

/** Only a real GPS fix may be restored; IP-derived values are never trusted. */
function readLastGpsFix() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("jatra_detected_location");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.source !== "gps" || !validateCoords(parsed.latitude, parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * useGeolocation hook — centralized location state.
 * Detection is GPS / device-position only; no IP or hardcoded fallbacks.
 */
export function useGeolocation({ onError } = {}) {
  const [state, setState] = useState(() => {
    const lastFix = readLastGpsFix();
    return lastFix ? { ...EMPTY_STATE, ...lastFix, status: "success", error: null } : EMPTY_STATE;
  });

  const detectingRef = useRef(false);

  const detect = useCallback(() => {
    if (detectingRef.current) return;
    detectingRef.current = true;

    setState((prev) => ({
      ...prev,
      status: "detecting",
      error: null,
    }));

    detectDeviceLocation(
      async (gpsData) => {
        const { latitude, longitude, accuracy, source } = gpsData;

        if (!validateCoords(latitude, longitude)) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Received invalid GPS coordinates. Please try again.",
          }));
          detectingRef.current = false;
          return;
        }

        const rev = await reverseGeocode(latitude, longitude);
        const displayName = formatLocationName(rev) || rev?.displayName || (rev?.locality ? `${rev.locality}, ${rev.district || "Odisha"}` : "Odisha");

        const locationData = {
          latitude,
          longitude,
          accuracy: accuracy || 50,
          timestamp: Date.now(),
          locality: rev?.locality || null,
          city: rev?.city || null,
          district: rev?.district || null,
          state: rev?.state || null,
          country: rev?.country || "India",
          postalCode: rev?.postalCode || null,
          formattedAddress: rev?.formattedAddress || null,
          displayName,
          source: source || "gps",
          status: "success",
          error: null,
        };

        try {
          localStorage.setItem("jatra_detected_location", JSON.stringify(locationData));
          localStorage.setItem("jatra_selected_location", displayName);
          localStorage.setItem("jatra_detected_time", String(Date.now()));
        } catch {}

        setState((prev) => ({
          ...prev,
          ...locationData,
        }));

        detectingRef.current = false;
      },
      async (errorData) => {
        console.warn("Device geolocation failed:", errorData);
        setState((prev) => ({
          ...prev,
          status: classifyErrorCode(errorData?.code),
          error: errorData?.message || "Unable to get your current location.",
        }));
        detectingRef.current = false;
      }
    );
  }, []);

  const setManualLocation = useCallback((locationName) => {
    setState((prev) => ({
      ...prev,
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp: null,
      locality: locationName,
      city: null,
      district: null,
      state: null,
      country: null,
      postalCode: null,
      formattedAddress: null,
      source: "manual",
      status: "success",
      error: null,
    }));

    try {
      localStorage.setItem("jatra_selected_location", locationName);
    } catch {}
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY_STATE);
  }, []);

  const displayName = state.displayName || formatLocationName(state) || state.locality || null;

  return {
    ...state,
    displayName,
    detect,
    setManualLocation,
    reset,
    isDetecting: state.status === "detecting",
    isSuccess: state.status === "success",
    isIdle: state.status === "idle",
    isGps: state.source === "gps",
    isManual: state.source === "manual",
  };
}
