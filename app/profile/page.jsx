"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import {
  signInWithGoogle,
  quickDemoGoogleLogin,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  getCustomerProfile,
  saveCustomerProfile,
  updateCustomerProfile,
  logoutCustomer,
  getSavedCustomerProfile,
  sbFetchBookingsByPhone,
  recordCustomerVisit,
  supabase,
} from "../../lib/supabase";

const menuItems = [
  { icon: "fa-ticket-simple", title: "My Tickets", desc: "View all your booked tickets", color: "text-indigo-600 bg-indigo-50 border-indigo-100", href: "/tickets" },
  { icon: "fa-clock-rotate-left", title: "Booking History", desc: "Past bookings & receipts", color: "text-amber-600 bg-amber-50 border-amber-100", href: "/tickets" },
  { icon: "fa-wallet", title: "Payment Methods", desc: "UPI, cards & cash preferences", color: "text-emerald-600 bg-emerald-50 border-emerald-100", href: "#" },
  { icon: "fa-bell", title: "Notifications", desc: "Booking alerts & event updates", color: "text-rose-500 bg-rose-50 border-rose-100", href: "#" },
  { icon: "fa-language", title: "Language", desc: "English • ଓଡ଼ିଆ • Santali", color: "text-purple-600 bg-purple-50 border-purple-100", href: "#" },
  { icon: "fa-shield-halved", title: "Privacy & Security", desc: "Account security & data", color: "text-sky-600 bg-sky-50 border-sky-100", href: "#" },
];

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "";

  // Authentication & Profile States
  const [step, setStep] = useState("SIGN_IN"); // SIGN_IN | COMPLETE_PROFILE | VIEW_PROFILE
  const [authUserId, setAuthUserId] = useState(null);
  const [profile, setProfile] = useState(null);

  // Form inputs
  const [fullNameInput, setFullNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [photoInput, setPhotoInput] = useState("");
  const [mobileInput, setMobileInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Manual Email & Password Login States
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [manualEmail, setManualEmail] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [manualFullName, setManualFullName] = useState("");
  const [manualMobile, setManualMobile] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & stats
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Customer dynamic activity stats
  const [userStats, setUserStats] = useState({
    ticketCount: 0,
    totalSpent: 0,
    eventCount: 0,
  });

  const loadCustomerStats = async (phone) => {
    if (!phone) return;
    try {
      const bookings = await sbFetchBookingsByPhone(phone);
      if (Array.isArray(bookings)) {
        let totalTix = 0;
        let totalAmt = 0;
        const events = new Set();

        bookings.forEach((b) => {
          totalTix += Number(b.quantity || b.seat_count || (Array.isArray(b.seats) ? b.seats.length : 1)) || 1;
          totalAmt += Number(b.amount || b.final_customer_amount || 0);
          if (b.event_id) events.add(b.event_id);
          else if (b.event_name) events.add(b.event_name);
        });

        setUserStats({
          ticketCount: totalTix,
          totalSpent: Math.round(totalAmt),
          eventCount: events.size,
        });
      }
    } catch (e) {
      /* ignore */
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  // Helper to process an authenticated user
  const handleAuthenticatedUser = async (user) => {
    if (!user) return;
    const userId = user.id;
    setAuthUserId(userId);

    const googleName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.displayName ||
      "";
    const googleEmail = user.email || user.user_metadata?.email || "";
    const googlePhoto =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      "";

    const userMobile =
      user.user_metadata?.mobile ||
      user.user_metadata?.phone ||
      user.phone ||
      "";

    // Try fetching existing customer profile
    let existingProfile = await getCustomerProfile(userId);

    if (existingProfile) {
      if (!existingProfile.mobile && userMobile) {
        existingProfile.mobile = userMobile;
        try {
          await saveCustomerProfile({
            id: userId,
            mobile: userMobile,
            full_name: existingProfile.full_name || googleName,
            email: existingProfile.email || googleEmail,
            profile_photo: existingProfile.profile_photo || googlePhoto,
          });
        } catch (e) {}
      }

      setProfile(existingProfile);
      setFullNameInput(existingProfile.full_name || googleName);
      setEmailInput(existingProfile.email || googleEmail);
      setPhotoInput(existingProfile.profile_photo || googlePhoto);
      setMobileInput(existingProfile.mobile || userMobile || "");
      setStep("VIEW_PROFILE");
      if (existingProfile.mobile) {
        try {
          window.localStorage.setItem("jatra:customer_mobile", String(existingProfile.mobile).replace(/\D/g, "").slice(-10));
        } catch (e) {}
      }
      recordCustomerVisit();
      if (existingProfile.mobile || userMobile) {
        loadCustomerStats(existingProfile.mobile || userMobile);
      }

      // If user came from a booking flow, redirect back immediately
      if (redirectUrl && (existingProfile.full_name || existingProfile.email)) {
        router.replace(redirectUrl);
        return;
      }
    } else {
      // First-time Google / OAuth customer: auto-complete profile
      const effectiveName = (googleName || (googleEmail ? googleEmail.split("@")[0] : "Google Customer")).trim();
      const cleanMobile = userMobile ? userMobile.replace(/\D/g, "").slice(-10) : "";
      setFullNameInput(effectiveName);
      setEmailInput(googleEmail);
      setPhotoInput(googlePhoto);
      setMobileInput(cleanMobile || "");

      try {
        const saved = await saveCustomerProfile({
          id: userId,
          mobile: cleanMobile || null,
          full_name: effectiveName,
          email: googleEmail || null,
          profile_photo: googlePhoto || null,
        });
        setProfile(saved);
        setStep("VIEW_PROFILE");
        if (cleanMobile) loadCustomerStats(cleanMobile);
        if (redirectUrl) {
          router.replace(redirectUrl);
          return;
        }
      } catch (e) {
        console.warn("Auto-save Google profile notice:", e);
      }

      setStep("COMPLETE_PROFILE");
    }
  };

  // Check active session & listen for Google OAuth redirects
  useEffect(() => {
    let authListener = null;

    async function initSession() {
      try {
        setInitialLoading(true);

        // 1. Check active Supabase Auth user
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user) {
          await handleAuthenticatedUser(user);
        } else {
          // 2. Check cached profile fallback
          const cached = getSavedCustomerProfile();
          if (cached && cached.id) {
            setProfile(cached);
            setFullNameInput(cached.full_name || "");
            setEmailInput(cached.email || "");
            setPhotoInput(cached.profile_photo || "");
            setMobileInput(cached.mobile || "");
            setStep("VIEW_PROFILE");
            if (cached.mobile) {
              loadCustomerStats(cached.mobile);
            }
            recordCustomerVisit();
          } else {
            setStep("SIGN_IN");
          }
        }
      } catch (err) {
        console.warn("Session check notice:", err);
        setStep("SIGN_IN");
      } finally {
        setInitialLoading(false);
      }
    }

    initSession();

    // 2. Listen to Supabase OAuth events
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
        await handleAuthenticatedUser(session.user);
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
        setStep("SIGN_IN");
      }
    });
    authListener = sub?.subscription;

    return () => {
      if (authListener) authListener.unsubscribe();
    };
  }, [redirectUrl, router]);

  // Manual Email & Password authentication handler
  const handleManualAuth = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = manualEmail.trim();
    if (!cleanEmail) {
      setErrorMsg("Please enter your email or Gmail address.");
      return;
    }

    if (authMode === "forgot") {
      setLoading(true);
      try {
        await resetPassword(cleanEmail);
        setSuccessMsg("Password reset email sent! Please check your inbox.");
        setAuthMode("signin");
      } catch (err) {
        setErrorMsg(err.message || "Failed to send reset link.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!manualPassword || manualPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (authMode === "signup") {
        if (!manualFullName.trim()) {
          setErrorMsg("Please enter your full name.");
          setLoading(false);
          return;
        }

        const cleanMobile = manualMobile.replace(/\D/g, "").slice(-10);
        if (cleanMobile.length !== 10) {
          setErrorMsg("Please enter a valid 10-digit mobile number.");
          setLoading(false);
          return;
        }

        const data = await signUpWithEmail(cleanEmail, manualPassword, manualFullName, cleanMobile);
        if (data?.session?.user) {
          await handleAuthenticatedUser(data.session.user);
        } else if (data?.user && !data?.session) {
          setSuccessMsg("Account created! Please check your email to confirm your account, then sign in.");
          setAuthMode("signin");
        } else if (data?.user) {
          await handleAuthenticatedUser(data.user);
        }
      } else {
        // Sign In
        const data = await signInWithEmail(cleanEmail, manualPassword);
        if (data?.user) {
          await handleAuthenticatedUser(data.user);
        }
      }
    } catch (err) {
      let msg = err.message || "Authentication failed.";
      if (msg.includes("Invalid login credentials")) {
        msg = "Incorrect email or password. Please try again.";
      } else if (msg.includes("User already registered")) {
        msg = "An account with this email already exists. Switched to Sign In.";
        setAuthMode("signin");
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign In trigger
  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const target = redirectUrl
        ? `/profile?redirect=${encodeURIComponent(redirectUrl)}`
        : "/profile";
      await signInWithGoogle(target);
    } catch (err) {
      setErrorMsg(err.message || "Failed to initialize Google Sign In.");
      setLoading(false);
    }
  };

  // Instant 1-Click Demo Google Login for rapid testing
  const handleQuickDemoLogin = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const demo = await quickDemoGoogleLogin();
      setProfile(demo);
      setFullNameInput(demo.full_name);
      setEmailInput(demo.email);
      setMobileInput(demo.mobile);
      setStep("VIEW_PROFILE");
      if (redirectUrl) {
        router.replace(redirectUrl);
      }
    } catch (err) {
      setErrorMsg("Quick login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Complete Profile (adding mobile number for ticket notifications)
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanMobile = mobileInput.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number for ticket confirmations.");
      return;
    }

    if (!fullNameInput.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    setLoading(true);
    try {
      const saved = await saveCustomerProfile({
        id: authUserId,
        mobile: cleanMobile,
        full_name: fullNameInput.trim(),
        email: emailInput.trim() || null,
        profile_photo: photoInput.trim() || null,
      });

      setProfile(saved);
      setMobileInput(cleanMobile);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("jatra:customer_profile", JSON.stringify(saved));
        window.localStorage.setItem("jatra:customer_mobile", cleanMobile);
        window.localStorage.setItem("jatra:customer_auth_id", authUserId);
      }

      setSuccessMsg("Welcome to Jatra Bazaar! Your profile is ready.");
      setStep("VIEW_PROFILE");
      loadCustomerStats(cleanMobile);

      if (redirectUrl) {
        router.replace(redirectUrl);
        return;
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!fullNameInput.trim()) {
      setErrorMsg("Full name cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateCustomerProfile(authUserId || profile.id, {
        full_name: fullNameInput.trim(),
        email: emailInput.trim() || null,
        profile_photo: photoInput.trim() || null,
        mobile: mobileInput.trim() || null,
      });

      setProfile(updated);
      setIsEditing(false);
      setSuccessMsg("Profile updated successfully!");
      if (mobileInput) {
        loadCustomerStats(mobileInput);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      await logoutCustomer();
      setProfile(null);
      setAuthUserId(null);
      setFullNameInput("");
      setEmailInput("");
      setPhotoInput("");
      setMobileInput("");
      setStep("SIGN_IN");
      setSuccessMsg("Signed out successfully.");
    } catch (e) {
      setErrorMsg("Failed to sign out.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none pb-20">
      {/* Top Header */}
      <Header />

      <div className="flex-1 max-w-md w-full mx-auto p-4 sm:p-5 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Page Title */}
          {step === "VIEW_PROFILE" && (
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-brand">My Profile</h2>
              <p className="text-xs text-slate-500 font-medium">Manage your account & booked tickets</p>
            </div>
          )}

          {/* Booking Flow In-Progress Banner */}
          {redirectUrl && (
            <div className="bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200/90 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                <i className="fa-solid fa-ticket -rotate-12" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">Step 1 of Booking: Sign In</p>
                <p className="text-[10px] text-slate-500 font-medium">Sign in to complete your ticket reservation</p>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3 flex items-center gap-2 animate-in fade-in text-left">
              <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0" />
              <span className="flex-1 leading-snug">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2 animate-in fade-in text-left">
              <i className="fa-solid fa-circle-check text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Initial Loading Skeleton */}
          {initialLoading && (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md flex flex-col items-center justify-center space-y-3 my-12">
              <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-500">Checking account session...</p>
            </div>
          )}

          {/* ============================================================== */}
          {/* FLOW STEP 1: REDESIGNED GOOGLE SIGN-IN UI                     */}
          {/* ============================================================== */}
          {!initialLoading && step === "SIGN_IN" && (
            <div className="flex items-center justify-center py-4 sm:py-8">
              <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-5 text-center">
                {/* Brand Logo Icon */}
                <div className="space-y-2.5">
                  <div className="w-20 h-20 rounded-3xl bg-white p-2 mx-auto shadow-xl shadow-slate-200/70 ring-8 ring-indigo-50/80 border border-slate-100 flex items-center justify-center transition-transform hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icon.png"
                      alt="Jatra Bazaar Logo"
                      className="w-full h-full object-contain rounded-2xl"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 font-brand tracking-tight">
                      Welcome to Jatra Bazaar
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                      Sign in to reserve tickets, view bookings & digital entry passes.
                    </p>
                  </div>
                </div>

                {/* Auth Mode Switcher (Sign In vs Create Account) */}
                <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      setErrorMsg("");
                    }}
                    className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                      authMode === "signin"
                        ? "bg-white text-indigo-700 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setErrorMsg("");
                    }}
                    className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                      authMode === "signup"
                        ? "bg-white text-indigo-700 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Manual Email & Password Form */}
                <form onSubmit={handleManualAuth} className="space-y-3.5 text-left">
                  {/* Full Name (Sign Up only) */}
                  {authMode === "signup" && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <i className="fa-solid fa-user absolute left-3.5 text-slate-400 text-xs" />
                        <input
                          type="text"
                          required
                          value={manualFullName}
                          onChange={(e) => setManualFullName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 rounded-xl text-xs font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mobile Number (Sign Up only) */}
                  {authMode === "signup" && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-bold text-slate-500 select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={manualMobile}
                          onChange={(e) => setManualMobile(e.target.value.replace(/\D/g, ""))}
                          placeholder="10-digit mobile number"
                          className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 rounded-xl text-xs font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 font-mono tracking-wider"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email / Gmail Address */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Email or Gmail <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <i className="fa-solid fa-envelope absolute left-3.5 text-slate-400 text-xs" />
                      <input
                        type="email"
                        required
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 rounded-xl text-xs font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  {authMode !== "forgot" && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase">
                          Password <span className="text-rose-500">*</span>
                        </label>
                        {authMode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("forgot");
                              setErrorMsg("");
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <i className="fa-solid fa-lock absolute left-3.5 text-slate-400 text-xs" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={manualPassword}
                          onChange={(e) => setManualPassword(e.target.value)}
                          placeholder="•••••••• (min 6 chars)"
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 rounded-xl text-xs font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 font-mono tracking-wider"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                          tabIndex={-1}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                        </button>
                      </div>
                    </div>
                  )}

                  {authMode === "forgot" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setAuthMode("signin")}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !manualEmail.trim() ||
                      (authMode === "signup" && (manualMobile.length !== 10 || !manualFullName.trim())) ||
                      (authMode !== "forgot" && manualPassword.length < 6)
                    }
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] text-white font-black text-xs py-3 px-4 rounded-xl shadow-md hover:shadow-indigo-200/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <i className="fa-solid fa-spinner animate-spin text-sm" />
                    ) : (
                      <i className={`fa-solid ${authMode === "signup" ? "fa-user-plus" : authMode === "forgot" ? "fa-paper-plane" : "fa-right-to-bracket"}`} />
                    )}
                    <span>
                      {loading
                        ? "Please wait..."
                        : authMode === "signup"
                        ? "Create Account & Sign In"
                        : authMode === "forgot"
                        ? "Send Password Reset Link"
                        : "Sign In"}
                    </span>
                  </button>
                </form>

                {/* Divider: OR CONTINUE WITH */}
                <div className="relative flex items-center justify-center pt-1">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                    Or Continue With
                  </span>
                  <div className="border-t border-slate-200 w-full" />
                </div>

                {/* Below: Continue with Google Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-extrabold text-xs py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
                  >
                    {loading ? (
                      <i className="fa-solid fa-spinner animate-spin text-indigo-600 text-sm" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                    <span className="text-slate-800 text-xs font-black tracking-tight">
                      {loading ? "Connecting to Google..." : "Continue with Google"}
                    </span>
                  </button>

                  {/* Fast 1-Click Demo Google Account for Instant Testing */}
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-bolt text-amber-300" />
                    <span>Instant 1-Click Test Login (Google Demo)</span>
                  </button>
                </div>

                {/* Benefits List */}
                <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3 text-left space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                    <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[10px]">
                      <i className="fa-solid fa-bolt" />
                    </div>
                    <span>Fast 1-Click Access or Email Sign In</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                    <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-[10px]">
                      <i className="fa-solid fa-ticket" />
                    </div>
                    <span>Digital tickets & QR passes saved to your account</span>
                  </div>
                </div>

                {/* Privacy & Trust footer */}
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  By signing in, you agree to Jatra Bazaar Terms of Service. Your personal information is encrypted & secured.
                </p>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* FLOW STEP 2: COMPLETE PROFILE (ADD MOBILE NUMBER)             */}
          {/* ============================================================== */}
          {!initialLoading && step === "COMPLETE_PROFILE" && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl space-y-5 animate-in fade-in">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-indigo-100 mx-auto bg-slate-100 flex items-center justify-center shadow-md">
                  {photoInput ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoInput} alt="Google Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-indigo-600">
                      {(fullNameInput || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-brand">Almost Done!</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Add your phone number for ticket passes & WhatsApp notifications.
                  </p>
                </div>

                {/* Google Verified Banner */}
                {emailInput && (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-extrabold px-3 py-1 rounded-full">
                    <i className="fa-brands fa-google text-emerald-600 text-xs" />
                    <span className="truncate max-w-[220px]">{emailInput}</span>
                    <i className="fa-solid fa-circle-check text-emerald-600 text-xs" />
                  </div>
                )}
              </div>

              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mobile Number for Tickets <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 rounded-xl transition-all overflow-hidden">
                    <span className="pl-3 pr-1 text-sm font-black text-slate-500 select-none">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="98765 43210"
                      className="flex-1 bg-transparent py-2.5 pr-3 text-sm font-black text-slate-900 tracking-wider placeholder:text-slate-300 placeholder:font-bold focus:outline-none"
                      autoFocus
                    />
                    {mobileInput.length === 10 && (
                      <span className="pr-3 text-emerald-500 text-sm">
                        <i className="fa-solid fa-circle-check" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Used strictly to send booked ticket receipts and gate entry QR codes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || mobileInput.length < 10 || !fullNameInput.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-arrow-right" />}
                  <span>{loading ? "Saving Profile..." : "Complete & Start Booking"}</span>
                </button>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* FLOW STEP 3: VIEW / EDIT PROFILE                              */}
          {/* ============================================================== */}
          {!initialLoading && step === "VIEW_PROFILE" && profile && (
            <>
              {/* Profile Hero Card */}
              <div className="bg-gradient-to-br from-[#12193b] via-[#1e2756] to-[#12193b] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-indigo-500/10 blur-xl" />
                <div className="absolute -left-8 -bottom-10 w-36 h-36 rounded-full bg-purple-500/10 blur-xl" />

                <div className="relative flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-amber-400 flex-shrink-0 bg-slate-700 flex items-center justify-center shadow-md">
                    {profile.profile_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.profile_photo}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-black text-amber-300">
                        {(profile.full_name || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black font-brand truncate">
                      {profile.full_name || "Customer User"}
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium truncate">
                      {profile.email || "Google Account"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-amber-400/30">
                        <i className="fa-solid fa-crown text-[8px]" /> Verified
                      </span>
                      {profile.email && (
                        <span className="inline-flex items-center gap-1 bg-blue-400/20 text-sky-300 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-blue-400/30">
                          <i className="fa-brands fa-google text-[8px]" /> Google
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-slate-200 text-sm hover:bg-white/20 transition-colors shrink-0"
                    title="Edit Profile"
                  >
                    <i className={`fa-solid ${isEditing ? "fa-xmark" : "fa-pen"}`} />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/15 bg-white/10 border border-white/15 rounded-2xl p-2.5 text-center">
                  <div>
                    <span className="text-base font-black text-white leading-tight block">
                      {userStats.ticketCount}
                    </span>
                    <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Tickets</span>
                  </div>
                  <div>
                    <span className="text-base font-black text-amber-400 leading-tight block">
                      ₹{userStats.totalSpent}
                    </span>
                    <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Spent</span>
                  </div>
                  <div>
                    <span className="text-base font-black text-white leading-tight block">
                      {userStats.eventCount}
                    </span>
                    <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Events</span>
                  </div>
                </div>
              </div>

              {/* Inline Edit Form */}
              {isEditing && (
                <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-md space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-black text-indigo-900 uppercase">Edit Profile Details</h4>
                  <form onSubmit={handleUpdateProfile} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                      <input
                        type="text"
                        value={fullNameInput}
                        onChange={(e) => setFullNameInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="10-digit mobile"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-slate-100 text-slate-600 font-bold text-xs py-2 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-indigo-600 text-white font-extrabold text-xs py-2 rounded-xl shadow-md"
                      >
                        {loading ? "Updating..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Contact Details Card */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs space-y-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-regular fa-circle-user text-indigo-600" /> Account Details
                </h3>

                {[
                  { icon: "fa-solid fa-user", label: "Full Name", value: profile.full_name || "Not provided" },
                  {
                    icon: "fa-solid fa-phone",
                    label: "Mobile Number",
                    value: profile.mobile ? `+91 ${profile.mobile}` : "Not added yet (Tap Edit above)",
                  },
                  { icon: "fa-solid fa-envelope", label: "Email Address", value: profile.email || "Not added yet" },
                  { icon: "fa-brands fa-google", label: "Sign In Method", value: "Google Authentication" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-indigo-700 flex items-center justify-center text-sm flex-shrink-0">
                      <i className={row.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{row.label}</p>
                      <p className="text-xs font-extrabold text-slate-900 truncate">{row.value}</p>
                    </div>
                    <button
                      onClick={() => copy(row.value)}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                      title="Copy"
                    >
                      <i className={`${copied ? "fa-solid fa-check text-emerald-600" : "fa-regular fa-copy"} text-xs`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Preferences */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs space-y-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-sliders text-purple-600" /> Preferences
                </h3>

                <div className="flex items-center justify-between bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-rose-500 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-bell" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">Push Notifications</p>
                      <p className="text-[9px] text-slate-400 font-medium">Booking alerts & ticket updates</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifications(!notifications)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifications ? "bg-indigo-600" : "bg-slate-300"}`}
                    aria-label="Toggle notifications"
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifications ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Menu */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-bars-staggered text-emerald-600" /> Account
                </h3>
                <div className="space-y-2">
                  {menuItems.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-slate-100 shadow-xs hover:border-indigo-200 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm ${item.color}`}>
                        <i className={`fa-solid ${item.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-slate-900">{item.title}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{item.desc}</p>
                      </div>
                      <i className="fa-solid fa-chevron-right text-[10px] text-slate-300" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full bg-white border border-rose-200 text-rose-600 font-extrabold text-xs py-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 hover:bg-rose-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                <i className="fa-solid fa-right-from-bracket" />
                Sign Out from Google Account
              </button>

              <p className="text-center text-[10px] text-slate-400 font-medium pb-2">Jatra Bazaar Customer v1.0.0</p>
            </>
          )}
        </div>

        {/* Fixed Bottom Navigation Bar */}
        <BottomNav active="profile" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  );
}