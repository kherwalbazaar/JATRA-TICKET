"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";

const menuItems = [
  { icon: "fa-ticket-simple", title: "My Tickets", desc: "View all your booked tickets", color: "text-indigo-600 bg-indigo-50 border-indigo-100", href: "/tickets" },
  { icon: "fa-clock-rotate-left", title: "Booking History", desc: "Past bookings & receipts", color: "text-amber-600 bg-amber-50 border-amber-100", href: "#" },
  { icon: "fa-wallet", title: "Payment Methods", desc: "UPI, cards & cash preferences", color: "text-emerald-600 bg-emerald-50 border-emerald-100", href: "#" },
  { icon: "fa-bell", title: "Notifications", desc: "Booking alerts & event updates", color: "text-rose-500 bg-rose-50 border-rose-100", href: "#" },
  { icon: "fa-language", title: "Language", desc: "English • ଓଡ଼ିଆ", color: "text-purple-600 bg-purple-50 border-purple-100", href: "#" },
  { icon: "fa-shield-halved", title: "Privacy & Security", desc: "Account security & data", color: "text-sky-600 bg-sky-50 border-sky-100", href: "#" },
];

export default function ProfilePage() {
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
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

          {/* Profile Hero Card */}
          <div className="bg-gradient-to-br from-[#12193b] via-[#1e2756] to-[#12193b] text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

            <div className="relative flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-amber-400 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black font-brand truncate">Balakram Tudu</h3>
                <p className="text-[11px] text-slate-300 font-medium">Member since 2026</p>
                <span className="inline-flex items-center gap-1 mt-1 bg-amber-400/20 text-amber-300 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-amber-400/30">
                  <i className="fa-solid fa-crown text-[8px]" /> VIP Member
                </span>
              </div>
              <button className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-slate-200 text-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-pen" />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/15 bg-white/10 border border-white/15 rounded-xl p-2 text-center">
              <div>
                <span className="text-sm font-black text-white leading-tight block">4</span>
                <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Tickets</span>
              </div>
              <div>
                <span className="text-sm font-black text-amber-400 leading-tight block">₹800</span>
                <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Spent</span>
              </div>
              <div>
                <span className="text-sm font-black text-white leading-tight block">2</span>
                <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wide">Events</span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-regular fa-circle-user text-indigo-600" /> Contact Details
            </h3>

            {[
              { icon: "fa-solid fa-user", label: "Full Name", value: "Balakram Tudu" },
              { icon: "fa-solid fa-phone", label: "Mobile Number", value: "+91 98765 43210" },
              { icon: "fa-solid fa-envelope", label: "Email Address", value: "balakramtudu@gmail.com" },
              { icon: "fa-solid fa-location-dot", label: "Location", value: "Khunta, Mayurbhanj, Odisha" },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-indigo-700 flex items-center justify-center text-sm flex-shrink-0">
                  <i className={row.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{row.label}</p>
                  <p className="text-xs font-extrabold text-slate-900 truncate">{row.value}</p>
                </div>
                <button onClick={() => copy(row.value)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-center transition-colors">
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
          <button className="w-full bg-white border border-rose-200 text-rose-600 font-extrabold text-xs py-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 hover:bg-rose-50 active:scale-[0.98] transition-all">
            <i className="fa-solid fa-right-from-bracket" />
            Logout
          </button>

          <p className="text-center text-[10px] text-slate-400 font-medium pb-2">Adim Lahah Mandawa v1.0.0</p>
        </div>

        {/* Fixed Bottom Navigation Bar */}
        <BottomNav active="profile" />
      </div>
    </div>
  );
}