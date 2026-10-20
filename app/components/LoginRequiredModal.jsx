"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginRequiredModal({
  isOpen,
  onClose,
  redirectUrl = "",
  title = "Please Login First",
  message = "You can freely view events, stages, and browse all seat rows. However, you must log in to your account before you can select seats and book tickets.",
  actionText = "Log In / Register to Book",
}) {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState(redirectUrl);

  useEffect(() => {
    if (typeof window !== "undefined" && !redirectUrl) {
      setTargetUrl(window.location.pathname + window.location.search);
    } else if (redirectUrl) {
      setTargetUrl(redirectUrl);
    }
  }, [redirectUrl, isOpen]);

  if (!isOpen) return null;

  const handleLoginRedirect = () => {
    const dest = targetUrl
      ? `/profile?redirect=${encodeURIComponent(targetUrl)}`
      : "/profile";
    router.push(dest);
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-slate-800 antialiased animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Visual Badge */}
        <div className="bg-gradient-to-br from-purple-700 via-indigo-700 to-indigo-900 p-6 text-white text-center relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-purple-400/20 rounded-full blur-2xl" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white text-xs transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>

          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20">
            <i className="fa-solid fa-lock text-amber-300 text-2xl" />
          </div>

          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white font-brand">
            {title}
          </h3>
          <span className="inline-block mt-1 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            Account Required
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Explanatory Notice */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              {message}
            </p>
          </div>

          {/* Features Highlights */}
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-[11px]">
                <i className="fa-solid fa-check" />
              </div>
              <span>Instant seat reservation & real-time seat lock</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 text-[11px]">
                <i className="fa-solid fa-qrcode" />
              </div>
              <span>Digital QR tickets sent directly to your account</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-[11px]">
                <i className="fa-solid fa-eye" />
              </div>
              <span>You can continue viewing all seat rows freely anytime</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleLoginRedirect}
              className="w-full bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <i className="fa-solid fa-arrow-right-to-bracket text-xs" />
              <span>{actionText}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer"
            >
              Continue Browsing as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
