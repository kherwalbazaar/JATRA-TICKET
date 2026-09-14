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

/**
 * useGeolocation hook — centralized location state.
 * Calls detectDeviceLocation from geolocation.js.
 *
 * source: "gps" | "manual" | null
 * status: "idle" | "detecting" | "success" | "permission-denied" | "unavailable" | "timeout" | "error"
 */
export function useGeolocation({ onError } = {}) {
  const [state, setState] = useState({
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

    source: null,
    status: "idle",
    error: null,
  });

  const detectingRef = useRef(false);

  const detect = useCallback(() => {
    if (detectingRef.current) return;
    detectingRef.current = true;

    setState((prev) => ({
      ...prev,
      status: "detecting",
      error: null,
      source: null,
    }));

    detectDeviceLocation(
      async (gpsData) => {
        const { latitude, longitude, accuracy } = gpsData;

        if (!validateCoords(latitude, longitude)) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Invalid coordinates received. Please try again.",
            source: null,
          }));
          detectingRef.current = false;
          if (onError) onError("Invalid coordinates received.");
          return;
        }

        setState((prev) => ({
          ...prev,
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now(),
          source: "gps",
          status: "detecting",
          error: null,
        }));

        const location = await reverseGeocode(latitude, longitude);

        const locationData = {
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now(),
          locality: location?.locality || null,
          city: location?.city || null,
          district: location?.district || null,
          state: location?.state || null,
          country: location?.country || null,
          postalCode: location?.postalCode || null,
          formattedAddress: location?.formattedAddress || null,
        };

        try {
          localStorage.setItem("jatra_detected_location", JSON.stringify(locationData));
        } catch {}

        let errorMsg = null;
        if (accuracy > 1000) {
          errorMsg = "GPS accuracy is low. Please select your area manually for best results.";
        }

        setState((prev) => ({
          ...prev,
          ...locationData,
          source: "gps",
          status: "success",
          error: errorMsg,
        }));

        detectingRef.current = false;
      },
      (errorData) => {
        const { code, message } = errorData;
        const status = classifyErrorCode(code);

        setState((prev) => ({
          ...prev,
          status,
          error: message,
          source: null,
        }));

        detectingRef.current = false;
        if (onError) onError(message);
      }
    );
  }, [onError]);

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
    setState({
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
      source: null,
      status: "idle",
      error: null,
    });
  }, []);

  const displayName = formatLocationName(state);

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
