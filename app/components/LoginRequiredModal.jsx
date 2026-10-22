"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, quickDemoGoogleLogin } from "../../lib/supabase";

export default function LoginRequiredModal({
  isOpen,
  onClose,
  redirectUrl = "",
  title = "Please Login First",
  message = "You can freely view events, stages, and browse all seat rows. However, you must log in to your account before you can select seats and book tickets.",
  actionText = "Log In with Mobile / Email",
  onLoginSuccess = null,
}) {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState(redirectUrl);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !redirectUrl) {
      setTargetUrl(window.location.pathname + window.location.search);
    } else if (redirectUrl) {
      setTargetUrl(redirectUrl);
    }
  }, [redirectUrl, isOpen]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setGoogleLoading(true);
    try {
      const dest = targetUrl || "/profile";
      await signInWithGoogle(dest);
    } catch (err) {
      console.error("Google sign in error:", err);
      setErrorMsg(err.message || "Failed to initialize Google Sign In.");
      setGoogleLoading(false);
    }
  };

  const handleInstantDemoLogin = async () => {
    setErrorMsg("");
    setDemoLoading(true);
    try {
      const demo = await quickDemoGoogleLogin();
      if (onLoginSuccess) {
        onLoginSuccess(demo);
      }
      onClose();
      // If we are on seats or payment page, refresh state or redirect
      if (targetUrl && typeof window !== "undefined") {
        router.push(targetUrl);
      }
    } catch (err) {
      setErrorMsg("Demo login failed. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

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
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center space-y-1.5">
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {message}
            </p>
          </div>

          {errorMsg && (
            <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
              {errorMsg}
            </p>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Continue with Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || demoLoading}
              className="w-full bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-extrabold text-sm py-3.5 px-4 rounded-2xl border-2 border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {googleLoading ? (
                <i className="fa-solid fa-spinner animate-spin text-indigo-600 text-sm" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span className="text-slate-900 font-black">
                {googleLoading ? "Connecting to Google..." : "Continue with Google"}
              </span>
            </button>

            {/* 2. Instant 1-Click Demo Google Account */}
            <button
              type="button"
              onClick={handleInstantDemoLogin}
              disabled={googleLoading || demoLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              {demoLoading ? (
                <i className="fa-solid fa-spinner animate-spin text-sm" />
              ) : (
                <i className="fa-solid fa-bolt text-amber-300" />
              )}
              <span>Instant 1-Click Test Login (Google Demo)</span>
            </button>

            {/* 3. Mobile / Email Login Alternative */}
            <button
              type="button"
              onClick={handleLoginRedirect}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-envelope text-slate-400" />
              <span>{actionText}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-slate-400 hover:text-slate-600 font-semibold text-[11px] py-1.5 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
