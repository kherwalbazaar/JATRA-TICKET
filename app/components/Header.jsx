"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGeolocation } from "../../hooks/useGeolocation";
import { LocationCard, LocationSelector } from "./location";

const STORAGE_KEY = "jatra_selected_location";

export default function Header({ showBack, showShare, onShare, title }) {
  const location = useGeolocation({
    onError: () => {
      setDropdownOpen(true);
      setShowManual(true);
    },
  });
  const [savedLocation, setSavedLocation] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const dropdownRef = useRef(null);

  // Load saved location on mount, then auto-detect GPS
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSavedLocation(saved);
      // Has saved location — check if stale (>1 hour), re-detect if so
      const lastDetect = localStorage.getItem("jatra_detected_time");
      const isStale = !lastDetect || Date.now() - Number(lastDetect) > 3600000;
      if (isStale) {
        location.detect();
      }
    } else {
      // No saved location — auto-detect GPS on first load
      location.detect();
    }

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setShowManual(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update header when GPS detects a location
  useEffect(() => {
    if (location.isSuccess && location.isGps && location.displayName) {
      setSavedLocation(location.displayName);
      try {
        localStorage.setItem(STORAGE_KEY, location.displayName);
        localStorage.setItem("jatra_detected_time", String(Date.now()));
      } catch {}
      setDropdownOpen(false);
    }
  }, [location.isSuccess, location.isGps, location.displayName]);

  // If GPS fails and no saved location, open manual picker
  useEffect(() => {
    if (location.status && location.status !== "idle" && location.status !== "detecting" && location.status !== "success" && !savedLocation) {
      setDropdownOpen(true);
      setShowManual(true);
    }
  }, [location.status, savedLocation]);

  const handleSelectManual = useCallback((loc) => {
    setSavedLocation(loc);
    localStorage.setItem(STORAGE_KEY, loc);
    location.setManualLocation(loc);
    setDropdownOpen(false);
    setShowManual(false);
  }, [location]);

  // Header display: GPS detected > manually selected > "Select Location"
  const displayText = savedLocation || "Select Location";

  return (
    <header className="bg-[#12193b] px-4 pt-3.5 pb-4 text-white flex items-center sticky top-0 z-50 shadow-md relative">
      {showBack ? (
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white text-base active:scale-95 transition-transform"
        >
          <i className="fa-solid fa-arrow-left" />
        </button>
      ) : (
        <div className="w-9 h-9" aria-hidden="true" />
      )}

      <div className="flex-1 flex justify-center">
        {title ? (
          <h2 className="text-base font-black font-brand tracking-wide">{title}</h2>
        ) : (
          <h1 className="text-lg font-black tracking-wide font-brand flex items-center gap-1.5 uppercase">
            <span className="text-amber-400 font-black">JATRA</span>
            <span className="font-black">BAZAAR</span>
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showShare ? (
          <button
            onClick={onShare}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white text-base active:scale-95 transition-transform"
          >
            <i className="fa-solid fa-share-nodes" />
          </button>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setDropdownOpen((prev) => !prev); setShowManual(false); }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 active:scale-95 transition-transform ${
                location.isDetecting ? "bg-emerald-500/20 border border-emerald-400/40" :
                savedLocation ? "bg-white/10" : "bg-amber-500/20 border border-amber-400/40"
              }`}
            >
              {location.isDetecting ? (
                <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <i className={`fa-solid fa-location-dot text-xs ${savedLocation ? "text-amber-400" : "text-amber-300 animate-pulse"}`} />
              )}
              <span className={`text-[10px] font-semibold max-w-[90px] truncate ${
                location.isDetecting ? "text-emerald-300" :
                savedLocation ? "text-slate-200" : "text-amber-300"
              }`}>
                {location.isDetecting ? "Detecting..." : displayText}
              </span>
              <i className={`fa-solid fa-chevron-down text-[8px] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""} ${savedLocation ? "text-slate-400" : "text-amber-400"}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-[80vh] bg-[#1a2347] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 flex flex-col">
                {/* Location Card — real GPS detection */}
                <div className="p-3 border-b border-white/10 flex-shrink-0">
                  <LocationCard
                    location={location}
                    onDetect={location.detect}
                    onSelectManual={() => setShowManual(true)}
                  />
                </div>

                {/* Manual selector */}
                {showManual ? (
                  <div className="flex-1 overflow-hidden">
                    <LocationSelector
                      currentLocation={savedLocation}
                      onSelect={handleSelectManual}
                      onClose={() => setShowManual(false)}
                    />
                  </div>
                ) : (
                  <div className="p-3 flex-shrink-0">
                    <button
                      onClick={() => setShowManual(true)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-list text-amber-400 text-sm" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Choose Manually</p>
                        <p className="text-[10px] text-slate-400">Select your district &amp; area</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Close */}
                {!showManual && (
                  <div className="p-2 border-t border-white/10 flex-shrink-0">
                    <button
                      onClick={() => { setDropdownOpen(false); setShowManual(false); }}
                      className="w-full text-center text-[10px] font-bold text-slate-400 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
