"use client";

import { formatAccuracy } from "../../../lib/location/reverseGeocode";

/**
 * LocationCard — displays detected location with source, coordinates, accuracy tiers.
 * Never shows IP-based fallback as real GPS.
 */
export default function LocationCard({ location, onDetect, onSelectManual }) {
  const {
    displayName,
    latitude,
    longitude,
    accuracy,
    status,
    error,
    source,
    isDetecting,
  } = location;

  const accuracyInfo = formatAccuracy(accuracy);

  return (
    <div className="bg-gradient-to-br from-[#12193b] via-[#1e2756] to-[#12193b] text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5" />
      <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/5" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <i className="fa-solid fa-location-dot text-amber-400 text-sm" />
          </div>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Your Location</span>
        </div>

        {/* Detecting state */}
        {status === "detecting" && (
          <div className="flex items-center gap-3 py-3">
            <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            <div>
              <p className="text-sm font-semibold text-white">Detecting your location...</p>
              <p className="text-[11px] text-slate-400">Getting your GPS position...</p>
            </div>
          </div>
        )}

        {/* Idle state — no location detected */}
        {status === "idle" && (
          <div className="py-3">
            <p className="text-sm font-medium text-slate-400">Location not detected</p>
            <p className="text-[11px] text-slate-500 mt-1">Tap below to detect your GPS position</p>
          </div>
        )}

        {/* Success with GPS coordinates */}
        {status === "success" && source === "gps" && (
          <div className="space-y-1.5 py-1">
            {/* Location name */}
            {displayName ? (
              <p className="text-base font-bold text-white">{displayName}</p>
            ) : (
              <p className="text-sm font-medium text-slate-400">Coordinates detected</p>
            )}

            {/* Raw coordinates — ALWAYS show for GPS */}
            {latitude != null && longitude != null && (
              <p className="text-[11px] font-mono text-slate-400">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </p>
            )}

            {/* Accuracy with tier indicator */}
            {accuracyInfo.text && (
              <div className="flex items-center gap-1.5">
                {accuracyInfo.tier === "high" && (
                  <i className="fa-solid fa-circle-check text-emerald-400 text-[9px]" />
                )}
                {accuracyInfo.tier === "medium" && (
                  <i className="fa-solid fa-circle-info text-amber-400 text-[9px]" />
                )}
                {accuracyInfo.tier === "low" && (
                  <i className="fa-solid fa-triangle-exclamation text-orange-400 text-[9px]" />
                )}
                <span className="text-[10px] text-slate-400">
                  {accuracyInfo.tier === "high" && "High GPS accuracy: "}
                  {accuracyInfo.tier === "medium" && "Location accuracy: "}
                  {accuracyInfo.tier === "low" && "Low GPS accuracy: "}
                  {accuracyInfo.text}
                </span>
              </div>
            )}

            {/* Source badge */}
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-check text-emerald-400 text-[9px]" />
              <span className="text-[10px] text-emerald-400 font-medium">Detected from your device</span>
            </div>
          </div>
        )}

        {/* Success with manual location */}
        {status === "success" && source === "manual" && (
          <div className="space-y-1.5 py-1">
            <p className="text-base font-bold text-white">{displayName || locality}</p>
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-hand-pointer text-amber-400 text-[9px]" />
              <span className="text-[10px] text-amber-400 font-medium">Manually selected</span>
            </div>
          </div>
        )}

        {/* Error display — specific for each error code */}
        {error && status !== "detecting" && (
          <div className="mt-3 space-y-2">
            {status === "permission-denied" && (
              <div className="flex items-start gap-2 bg-red-500/10 rounded-xl px-3 py-2.5">
                <i className="fa-solid fa-shield-halved text-red-400 text-xs mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-red-300">Location Permission Required</p>
                  <p className="text-[10px] text-red-300/70 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {status === "unavailable" && (
              <div className="flex items-start gap-2 bg-orange-500/10 rounded-xl px-3 py-2.5">
                <i className="fa-solid fa-satellite-dish text-orange-400 text-xs mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-orange-300">Location Unavailable</p>
                  <p className="text-[10px] text-orange-300/70 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {status === "timeout" && (
              <div className="flex items-start gap-2 bg-amber-500/10 rounded-xl px-3 py-2.5">
                <i className="fa-solid fa-clock text-amber-400 text-xs mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-amber-300">Detection Timed Out</p>
                  <p className="text-[10px] text-amber-300/70 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-start gap-2 bg-red-500/10 rounded-xl px-3 py-2.5">
                <i className="fa-solid fa-circle-exclamation text-red-400 text-xs mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-red-300">Unable to Detect Location</p>
                  <p className="text-[10px] text-red-300/70 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onDetect}
            disabled={isDetecting}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isDetecting
                ? "bg-white/5 text-slate-500 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95"
            }`}
          >
            {isDetecting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Detecting...
              </>
            ) : status === "success" || status === "permission-denied" || status === "unavailable" || status === "timeout" || status === "error" ? (
              <>
                <i className="fa-solid fa-rotate-right" />
                Detect Again
              </>
            ) : (
              <>
                <i className="fa-solid fa-crosshairs" />
                Detect Location
              </>
            )}
          </button>

          <button
            onClick={onSelectManual}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white active:scale-95 transition-all"
          >
            <i className="fa-solid fa-list mr-1" />
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
