"use client";

import { useState, useCallback, useRef } from "react";
import { detectDeviceLocation, detectIPLocation, validateCoords } from "../lib/location/geolocation";
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
 * Supports smart auto-detection: GPS (High/Low) -> IP Network Geolocation -> Default Region.
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
    displayName: null,

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
    }));

    detectDeviceLocation(
      async (gpsData) => {
        const { latitude, longitude, accuracy, source } = gpsData;

        if (!validateCoords(latitude, longitude)) {
          // Fallback to IP geolocation if coords are invalid
          try {
            const ipData = await detectIPLocation();
            if (ipData && ipData.displayName) {
              setState((prev) => ({ ...prev, ...ipData, status: "success" }));
              try {
                localStorage.setItem("jatra_detected_location", JSON.stringify(ipData));
                localStorage.setItem("jatra_selected_location", ipData.displayName);
              } catch {}
              detectingRef.current = false;
              return;
            }
          } catch {}
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
        console.warn("Device GPS unavailable, falling back to IP geolocation...", errorData);

        // Fallback to IP / Network Geolocation
        try {
          const ipLocation = await detectIPLocation();
          if (ipLocation && ipLocation.displayName) {
            const locationData = {
              latitude: ipLocation.latitude,
              longitude: ipLocation.longitude,
              accuracy: ipLocation.accuracy || 2500,
              timestamp: Date.now(),
              locality: ipLocation.locality || null,
              city: ipLocation.city || null,
              district: ipLocation.district || null,
              state: ipLocation.state || null,
              country: ipLocation.country || "India",
              postalCode: null,
              formattedAddress: ipLocation.formattedAddress || null,
              displayName: ipLocation.displayName,
              source: "network",
              status: "success",
              error: null,
            };

            try {
              localStorage.setItem("jatra_detected_location", JSON.stringify(locationData));
              localStorage.setItem("jatra_selected_location", ipLocation.displayName);
              localStorage.setItem("jatra_detected_time", String(Date.now()));
            } catch {}

            setState((prev) => ({
              ...prev,
              ...locationData,
            }));
            detectingRef.current = false;
            return;
          }
        } catch (ipErr) {
          console.warn("IP Geolocation fallback error:", ipErr);
        }

        // If completely offline or network blocked, set default Jatra region
        const defaultRegion = {
          latitude: 21.93,
          longitude: 86.74,
          accuracy: 5000,
          timestamp: Date.now(),
          locality: "Bahanada",
          city: "Khunta",
          district: "Mayurbhanj",
          state: "Odisha",
          country: "India",
          displayName: "Bahanada, Khunta, Mayurbhanj",
          source: "network",
          status: "success",
          error: null,
        };

        try {
          localStorage.setItem("jatra_detected_location", JSON.stringify(defaultRegion));
          localStorage.setItem("jatra_selected_location", defaultRegion.displayName);
        } catch {}

        setState((prev) => ({
          ...prev,
          ...defaultRegion,
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
