"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import {
  requestCustomerOtp,
  verifyCustomerOtp,
  getCustomerProfile,
  saveCustomerProfile,
  updateCustomerProfile,
  logoutCustomer,
  sbFetchBookingsByPhone,
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

export default function ProfilePage() {
  // Authentication & Profile States
  const [step, setStep] = useState("ENTER_MOBILE"); // ENTER_MOBILE | VERIFY_OTP | COMPLETE_PROFILE | VIEW_PROFILE
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [authUserId, setAuthUserId] = useState(null);
  const [profile, setProfile] = useState(null);

  // Form inputs
  const [fullNameInput, setFullNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [photoInput, setPhotoInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

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

  // Load existing session on mount
  useEffect(() => {
    async function initSession() {
      try {
        setInitialLoading(true);

        // Check active Supabase Auth user
        const { data: authData } = await supabase.auth.getUser();
        let user = authData?.user;

        // Fallback to local storage
        let savedMobile = "";
        let savedId = "";
        if (typeof window !== "undefined") {
          savedMobile = window.localStorage.getItem("jatra:customer_mobile") || "";
          savedId = window.localStorage.getItem("jatra:customer_auth_id") || "";
        }

        const effectiveId = user?.id || savedId;
        const effectiveMobile = user?.user_metadata?.mobile || savedMobile;

        if (effectiveId) {
          setAuthUserId(effectiveId);
          if (effectiveMobile) setMobile(effectiveMobile);

          const existingProfile = await getCustomerProfile(effectiveId);
          if (existingProfile) {
            setProfile(existingProfile);
            setFullNameInput(existingProfile.full_name || "");
            setEmailInput(existingProfile.email || "");
            setPhotoInput(existingProfile.profile_photo || "");
            setStep("VIEW_PROFILE");
            loadCustomerStats(existingProfile.mobile || effectiveMobile);
          } else if (effectiveMobile) {
            setStep("COMPLETE_PROFILE");
          }
        }
      } catch (err) {
        console.warn("Session check notice:", err);
      } finally {
        setInitialLoading(false);
      }
    }

    initSession();
  }, []);

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

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const clean = mobile.replace(/\D/g, "").slice(-10);
    if (clean.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestCustomerOtp(clean);
      setMobile(clean);
      setSuccessMsg(res.message || "OTP sent successfully.");
      setStep("VERIFY_OTP");
    } catch (err) {
      setErrorMsg(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Fake OTP (123456)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!otp.trim()) {
      setErrorMsg("Please enter the verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyCustomerOtp(mobile, otp.trim());
      if (!res.success) throw new Error(res.message || "Verification failed.");

      setAuthUserId(res.user.id);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("jatra:customer_mobile", mobile);
        window.localStorage.setItem("jatra:customer_auth_id", res.user.id);
      }

      if (res.profile) {
        setProfile(res.profile);
        setFullNameInput(res.profile.full_name || "");
        setEmailInput(res.profile.email || "");
        setPhotoInput(res.profile.profile_photo || "");
        setSuccessMsg("Welcome back! Your profile was loaded successfully.");
        setStep("VIEW_PROFILE");
        loadCustomerStats(mobile);
      } else {
        setSuccessMsg("Mobile verified! Please enter your name to complete your profile.");
        setStep("COMPLETE_PROFILE");
      }
    } catch (err) {
      setErrorMsg(err.message || "Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete or Create Profile
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!fullNameInput.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    setLoading(true);
    try {
      const saved = await saveCustomerProfile({
        id: authUserId,
        mobile,
        full_name: fullNameInput.trim(),
        email: emailInput.trim() || null,
        profile_photo: photoInput.trim() || null,
      });

      setProfile(saved);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("jatra:customer_profile", JSON.stringify(saved));
      }
      setSuccessMsg("Profile created successfully!");
      setStep("VIEW_PROFILE");
      loadCustomerStats(mobile);
    } catch (err) {
      setErrorMsg(err.message || "Failed to create profile.");
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
      });

      setProfile(updated);
      setIsEditing(false);
      setSuccessMsg("Profile updated successfully!");
    } catch (err) {
      setErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutCustomer();
    setProfile(null);
    setAuthUserId(null);
    setMobile("");
    setOtp("");
    setFullNameInput("");
    setEmailInput("");
    setPhotoInput("");
    setStep("ENTER_MOBILE");
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        {/* Top App Header */}
        <Header />

        <div className="flex-1 p-4 space-y-4">
          {/* Page Title */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-brand">My Profile</h2>
            <p className="text-xs text-slate-500 font-medium">Manage your account & preferences</p>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3 flex items-center gap-2 animate-in fade-in">
              <i className="fa-solid fa-circle-exclamation text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2 animate-in fade-in">
              <i className="fa-solid fa-circle-check text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Initial Loading Skeleton */}
          {initialLoading && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-500">Checking profile session...</p>
            </div>
          )}

          {/* FLOW STEP 1: ENTER MOBILE */}
          {!initialLoading && step === "ENTER_MOBILE" && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-md space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xl mx-auto mb-2">
                  <i className="fa-solid fa-mobile-screen" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-brand">Login or Create Profile</h3>
                <p className="text-xs text-slate-500">Enter your 10-digit mobile number to verify with OTP</p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mobile Number</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-extrabold text-slate-500">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                      placeholder="98765 43210"
                      className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                  <i className="fa-solid fa-shield-halved text-amber-600 mt-0.5" />
                  <span>Development mode active: Enter any 10-digit number. Fixed testing OTP is <strong>123456</strong>.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading || mobile.length < 10}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-arrow-right" />}
                  <span>{loading ? "Sending OTP..." : "Get OTP Verification Code"}</span>
                </button>
              </form>
            </div>
          )}

          {/* FLOW STEP 2: VERIFY OTP */}
          {!initialLoading && step === "VERIFY_OTP" && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-md space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-2">
                  <i className="fa-solid fa-key" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-brand">Verify OTP Code</h3>
                <p className="text-xs text-slate-500">
                  Code sent to <span className="font-extrabold text-slate-800">+91 {mobile}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] text-lg font-black py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-800 flex items-center justify-between">
                  <span>Development OTP Code:</span>
                  <button
                    type="button"
                    onClick={() => setOtp("123456")}
                    className="bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-md hover:bg-emerald-700"
                  >
                    Auto-fill 123456
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("ENTER_MOBILE")}
                    className="flex-1 bg-slate-100 text-slate-700 font-bold text-xs py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Change Number
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="flex-2 bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-50 text-white font-extrabold text-sm py-2.5 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-check" />}
                    <span>{loading ? "Verifying..." : "Verify & Continue"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* FLOW STEP 3: COMPLETE PROFILE */}
          {!initialLoading && step === "COMPLETE_PROFILE" && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-md space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xl mx-auto mb-2">
                  <i className="fa-solid fa-user-plus" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-brand">Complete Your Profile</h3>
                <p className="text-xs text-slate-500">Welcome to Jatra Bazaar! Set up your customer profile details.</p>
              </div>

              <form onSubmit={handleCompleteProfile} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="e.g. Ramesh Hansda"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Verified Mobile Number
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-700">
                    <i className="fa-solid fa-circle-check text-emerald-600" />
                    <span>+91 {mobile}</span>
                    <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">Verified</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Profile Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !fullNameInput.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-floppy-disk" />}
                  <span>{loading ? "Saving Profile..." : "Save & Open Profile"}</span>
                </button>
              </form>
            </div>
          )}

          {/* FLOW STEP 4: VIEW / EDIT PROFILE */}
          {!initialLoading && step === "VIEW_PROFILE" && profile && (
            <>
              {/* Profile Hero Card */}
              <div className="bg-gradient-to-br from-[#12193b] via-[#1e2756] to-[#12193b] text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

                <div className="relative flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-amber-400 flex-shrink-0 bg-slate-700 flex items-center justify-center">
                    {profile.profile_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.profile_photo}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-amber-300">
                        {(profile.full_name || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black font-brand truncate">
                      {profile.full_name || "Customer User"}
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium">
                      Member since {new Date(profile.created_at || Date.now()).getFullYear()}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 bg-amber-400/20 text-amber-300 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-amber-400/30">
                      <i className="fa-solid fa-crown text-[8px]" /> Verified Customer
                    </span>
                  </div>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-slate-200 text-sm hover:bg-white/20 transition-colors"
                    title="Edit Profile"
                  >
                    <i className={`fa-solid ${isEditing ? "fa-xmark" : "fa-pen"}`} />
                  </button>
                </div>

                {/* Quick Stats — Dynamically computed from customer bookings */}
                <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/15 bg-white/10 border border-white/15 rounded-xl p-2 text-center">
                  <div>
                    <span className="text-sm font-black text-white leading-tight block">
                      {userStats.ticketCount}
                    </span>
                    <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Tickets</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-amber-400 leading-tight block">
                      ₹{userStats.totalSpent}
                    </span>
                    <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Spent</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-white leading-tight block">
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
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Photo URL</label>
                      <input
                        type="url"
                        value={photoInput}
                        onChange={(e) => setPhotoInput(e.target.value)}
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

              {/* Contact Details */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs space-y-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-regular fa-circle-user text-indigo-600" /> Contact Details
                </h3>

                {[
                  { icon: "fa-solid fa-user", label: "Full Name", value: profile.full_name || "Not provided" },
                  { icon: "fa-solid fa-phone", label: "Mobile Number", value: `+91 ${profile.mobile}` },
                  { icon: "fa-solid fa-envelope", label: "Email Address", value: profile.email || "Not added yet" },
                  { icon: "fa-solid fa-shield-halved", label: "Role & Access", value: "Verified Customer" },
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
                      <p className="text-[9px] text-slate-400 font-medium">Booking alerts & offers</p>
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

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full bg-white border border-rose-200 text-rose-600 font-extrabold text-xs py-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 hover:bg-rose-50 active:scale-[0.98] transition-all"
              >
                <i className="fa-solid fa-right-from-bracket" />
                Logout (Switch Account)
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