"use client";

import { useState, useRef, useEffect } from "react";

const PHONE_TEL = "+919583252256";
const WHATSAPP_URL =
  "https://wa.me/919583252256?text=Hi%20Jatra%20Bazaar%2C%20I%20need%20help%20with%20booking%20seats";

export default function StageContactFab({ className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click or touch
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
      className={`fixed bottom-24 right-4 sm:right-6 flex flex-col items-center z-[9999] select-none ${className}`}
    >
      {/* Speed Dial Options (Show in top, pure Call and WhatsApp icons without number) */}
      <div
        className={`flex flex-col items-center gap-3 mb-3 transition-all duration-300 ease-out origin-bottom ${
          isOpen
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-4 scale-75 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        {/* WhatsApp Icon Button */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={isOpen ? 0 : -1}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 border border-emerald-300/40 transition-all duration-200 hover:scale-110 active:scale-95"
          title="WhatsApp"
          aria-label="Chat on WhatsApp"
        >
          <svg
            className="w-6 h-6 fill-current text-white"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.35C9.34 7.35 9.04 7.42 8.78 7.7C8.52 7.98 7.79 8.66 7.79 10.05C7.79 11.44 8.8 12.78 8.94 12.96C9.08 13.15 10.89 16.09 13.75 17.21C16.13 18.14 16.61 17.96 17.13 17.91C17.65 17.86 18.82 17.21 19.06 16.53C19.3 15.85 19.3 15.26 19.23 15.14C19.16 15.02 18.97 14.95 18.68 14.81C18.39 14.67 17.02 14 16.76 13.9C16.5 13.81 16.32 13.77 16.13 14.05C15.94 14.33 15.41 14.95 15.25 15.14C15.09 15.33 14.93 15.35 14.64 15.21C14.35 15.07 13.43 14.77 12.33 13.79C11.47 13.02 10.89 12.07 10.73 11.79C10.57 11.51 10.71 11.36 10.86 11.21C10.99 11.08 11.15 10.87 11.3 10.7C11.45 10.53 11.5 10.4 11.6 10.21C11.7 10.02 11.65 9.86 11.58 9.72C11.51 9.58 10.95 8.19 10.71 7.62C10.48 7.07 10.25 7.15 10.07 7.14C9.9 7.13 9.71 7.35 9.53 7.35Z" />
          </svg>
        </a>

        {/* Call Icon Button */}
        <a
          href={`tel:${PHONE_TEL}`}
          tabIndex={isOpen ? 0 : -1}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-400 hover:from-sky-500 hover:to-cyan-300 text-white flex items-center justify-center shadow-xl shadow-sky-500/40 border border-sky-300/40 transition-all duration-200 hover:scale-110 active:scale-95"
          title="Direct Call"
          aria-label="Direct Call"
        >
          <svg
            className="w-5 h-5 fill-current text-white"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M6.62 10.79C8.06 13.62 10.38 15.94 13.21 17.38L15.41 15.18C15.69 14.9 16.08 14.82 16.43 14.93C17.55 15.3 18.75 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z" />
          </svg>
        </a>
      </div>

      {/* Main Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative group w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 focus:outline-hidden ${
          isOpen
            ? "bg-slate-800 text-rose-400 border border-slate-600 shadow-2xl shadow-black/70 rotate-90"
            : "bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-500 text-white shadow-2xl shadow-emerald-500/45 hover:shadow-emerald-500/65 hover:scale-105"
        }`}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close options" : "Contact options"}
      >
        {/* Subtle Ambient Pulse Ring when closed */}
        {!isOpen && (
          <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
        )}

        {/* Icon: switches between phone and close */}
        {isOpen ? (
          <svg
            className="w-5 h-5 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 fill-current text-white group-hover:scale-110 transition-transform"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M6.62 10.79C8.06 13.62 10.38 15.94 13.21 17.38L15.41 15.18C15.69 14.9 16.08 14.82 16.43 14.93C17.55 15.3 18.75 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
