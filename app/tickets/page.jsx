"use client";

import { useState } from "react";
import Link from "next/link";

const upcomingTickets = [
  { id: "NJ-TKT-501", name: "Balakram Tudu", isYou: true },
  { id: "NJ-TKT-502", name: "Rakesh Murmu" },
  { id: "NJ-TKT-503", name: "Sanjay Hansda" },
  { id: "NJ-TKT-504", name: "Gita Tudu" },
];

const usedTickets = [
  { id: "NJ-TKT-318", name: "Bikash Soren", category: "General", gate: "Gate A", date: "12 Aug 2026" },
  { id: "NJ-TKT-327", name: "Mamita Bhatta", category: "General", gate: "Gate A", date: "12 Aug 2026" },
  { id: "NJ-TKT-402", name: "Kunal Nayak", category: "Premium", gate: "Gate B", date: "13 Aug 2026" },
];

const cancelledTickets = [
  { id: "NJ-TKT-415", name: "Priya Marandi", category: "VIP", gate: "Gate C", date: "14 Aug 2026", refunded: "Refund issued" },
];

const STATUS_TAB = [
  { key: "upcoming", label: "Upcoming", count: upcomingTickets.length },
  { key: "used", label: "Used", count: usedTickets.length },
  { key: "cancelled", label: "Cancelled", count: cancelledTickets.length },
];

const cardGradients = [
  "bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500",
  "bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-700",
  "bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600",
  "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
  "bg-gradient-to-br from-lime-500 via-emerald-500 to-teal-600",
  "bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600",
];

export default function TicketsPage() {
  const [tab, setTab] = useState("upcoming");
  const [copied, setCopied] = useState(false);

  const copyBookingId = async () => {
    try {
      await navigator.clipboard.writeText("NJ26-00125");
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
<header className="bg-[#12193b] px-4 pt-3.5 pb-4 text-white flex items-center justify-center sticky top-0 z-50 shadow-md relative">
          <h1 className="text-lg font-black tracking-wide font-brand flex items-center gap-1.5 uppercase">
            <span className="font-black">ADIM</span>
            <span className="text-amber-400 font-black">LAHAH</span>
            <span className="text-red-500 font-black">MANDAWA</span>
          </h1>

          <div className="absolute right-4 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-slate-200 text-sm">
              <i className="fa-solid fa-bell" />
            </div>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[#12193b]">3</span>
          </div>
        </header>

        {/* Page Title & Tabs */}
        <div className="p-4 pb-0 space-y-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-brand">My Tickets</h2>
            <p className="text-xs text-slate-500 font-medium">View and manage all your tickets</p>
          </div>

          <div className="flex items-center bg-slate-200/70 p-1 rounded-2xl text-xs font-bold gap-1">
            {STATUS_TAB.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-xl transition-all text-center ${
                  tab === t.key
                    ? "bg-[#12193b] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label} <span className={tab === t.key ? "text-amber-400 text-[10px]" : "text-[10px] opacity-70"}>({t.count})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3.5 flex-1">
          {tab === "upcoming" ? (
            <>
              {/* Event Hero Summary Card */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 space-y-3">
                <div className="flex gap-3 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80"
                    alt="Event Banner"
                    className="w-20 h-20 rounded-xl object-cover ring-1 ring-slate-100 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md uppercase">Booking ID</span>
                      <button onClick={copyBookingId} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900">
                        <span>{copied ? "Copied" : "NJ26-00125"}</span>
                        <i className={`${copied ? "fa-solid fa-check text-emerald-600" : "fa-regular fa-copy"} text-xs`} />
                      </button>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 font-brand truncate uppercase tracking-tight">ADIM LAHAH MANDAWA 2026</h3>

                    <div className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <i className="fa-regular fa-calendar text-rose-500 text-[11px]" />
                        <span>22 Oct 2026 (Thu)</span>
                        <span className="text-slate-300">•</span>
                        <i className="fa-regular fa-clock text-indigo-600 text-[11px]" />
                        <span>8:00 PM Onwards</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <i className="fa-solid fa-location-dot text-rose-500 text-[11px]" />
                        <span className="truncate">Balanada</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50/80 rounded-xl p-2 text-center border border-slate-100">
                  <div>
                    <span className="text-sm font-black text-slate-900 leading-tight block">4</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Tickets</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-purple-900 leading-tight block">VIP</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Category</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-indigo-900 leading-tight block">Gate C</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Entry Gate</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-emerald-600 leading-tight block">₹800</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Total Amount</span>
                  </div>
                </div>
              </div>

              {/* Ticket Items List */}
              <div className="space-y-2.5">
                {upcomingTickets.map((ticket, index) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className={`relative rounded-2xl p-3 shadow-md border border-white/20 flex items-center justify-between gap-3 overflow-hidden text-white bg-gradient-to-br ${cardGradients[index % cardGradients.length]} transition-transform active:scale-[0.98]`}
                  >
                    {/* Decorative Gradient Highlights */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />
                    <div className="absolute right-14 bottom-1 opacity-20">
                      <i className="fa-solid fa-ticket-simple text-5xl -rotate-12" />
                    </div>

                    <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-white/25 backdrop-blur text-white font-black text-xs flex items-center justify-center flex-shrink-0 ring-1 ring-white/30">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-regular fa-circle-user text-white/80 text-sm" />
                          <h4 className="text-xs font-black text-white truncate drop-shadow">{ticket.name}</h4>
                          {ticket.isYou && (
                            <span className="bg-white/25 text-white text-[9px] font-extrabold px-1.5 rounded-md backdrop-blur ring-1 ring-white/30">You</span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-white/80 mt-0.5">VIP <span className="text-white/40">•</span> Gate C</p>
                        <p className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow">Ticket ID: {ticket.id}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white mt-1 bg-white/20 backdrop-blur px-1.5 py-0.5 rounded-md ring-1 ring-white/30">
                          <i className="fa-solid fa-circle-check text-xs" />
                          <span>ACTIVE <span className="font-semibold text-white/75 text-[9px]">- Ready for entry</span></span>
                        </span>
                      </div>
                    </div>

                    <div className="relative w-16 h-16 p-1 bg-white/90 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ring-2 ring-white/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.id}`} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText("ADIM LAHAH MANDAWA 2026 | NJ26-00125 | 4 x VIP | Gate C | 22 Oct 2026, Balanada");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="flex-1 bg-white border border-indigo-200 hover:bg-slate-50 text-indigo-900 font-extrabold text-xs py-3 px-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <i className="fa-solid fa-share-nodes text-sm" />
                  <span>{copied ? "Copied!" : "Share All Tickets"}</span>
                </button>
                <button className="flex-1 bg-[#12193b] hover:bg-[#1a2350] text-white font-extrabold text-xs py-3 px-3 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform">
                  <i className="fa-solid fa-download text-sm" />
                  <span>Download All</span>
                </button>
              </div>
            </>
          ) : (
            <TicketStatusList tab={tab} />
          )}
        </div>

        {/* Fixed Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <Link href="/" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5"><i className="fa-solid fa-house" /></div>
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          <span className="flex flex-col items-center flex-1 text-indigo-600">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5"><i className="fa-solid fa-ticket-simple" /></div>
            <span className="text-[10px] font-bold">My Tickets</span>
            <span className="w-6 h-1 bg-indigo-600 rounded-full mt-0.5" />
          </span>

          <a href="#" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5"><i className="fa-regular fa-calendar-days" /></div>
            <span className="text-[10px] font-medium">Events</span>
          </a>

          <a href="#" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5"><i className="fa-solid fa-headset" /></div>
            <span className="text-[10px] font-medium">Support</span>
          </a>

          <a href="#" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5"><i className="fa-regular fa-circle-user" /></div>
            <span className="text-[10px] font-medium">Profile</span>
          </a>
        </nav>
      </div>
    </div>
  );
}

function TicketStatusList({ tab }) {
  const list = tab === "used" ? usedTickets : cancelledTickets;
  const statusConfig = {
    used: {
      label: "USED",
      textClass: "text-white",
      borderClass: "border-white/30",
      badge: "border-emerald-600 bg-white/95 text-emerald-700",
      note: "Entry Completed",
      gradient: "bg-gradient-to-br from-emerald-500 via-teal-500 to-teal-700",
    },
    cancelled: {
      label: "CANCELLED",
      textClass: "text-white",
      borderClass: "border-white/20",
      badge: "border-red-600 bg-white/95 text-red-600",
      note: "This ticket is cancelled",
      gradient: "bg-gradient-to-br from-slate-600 to-slate-800",
    },
  }[tab];

  return (
    <div className="space-y-2.5">
      {list.map((ticket) => (
        <div
          key={ticket.id}
          className={`relative rounded-2xl p-3 shadow-md border border-white/20 flex items-center justify-between gap-3 overflow-hidden text-white bg-gradient-to-br ${statusConfig.gradient} ${tab === "cancelled" ? "opacity-90" : ""}`}
        >
          {/* Decorative Gradient Highlights */}
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

          <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-6 h-6 rounded-full bg-white/25 backdrop-blur text-white font-black text-xs flex items-center justify-center flex-shrink-0 ring-1 ring-white/30">
              <i className="fa-solid fa-user text-[10px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <i className="fa-regular fa-circle-user text-white/80 text-sm" />
                <h4 className="text-xs font-black text-white truncate drop-shadow">{ticket.name}</h4>
              </div>
              <p className="text-[11px] font-bold text-white/80 mt-0.5">
                {ticket.category} <span className="text-white/40">•</span> {ticket.gate} <span className="text-white/40">•</span> {ticket.date}
              </p>
              <p className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow">Ticket ID: {ticket.id}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold text-white mt-1 bg-white/20 backdrop-blur px-1.5 py-0.5 rounded-md ring-1 ring-white/30`}>
                <i className="fa-solid fa-circle-check text-xs" />
                <span>{statusConfig.label}</span>
                {ticket.refunded && <span className="font-semibold text-white/75 text-[9px]">- {ticket.refunded}</span>}
              </span>
            </div>
          </div>

          <div className={`relative w-16 h-16 p-1 bg-white/90 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ring-2 ring-white/40`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.id}`} alt="QR Code" className={`w-full h-full object-contain ${tab === "cancelled" ? "grayscale" : ""}`} />
            <span className={`absolute inset-0 m-auto w-fit h-fit border-2 ${statusConfig.badge} text-[8px] font-black px-1 rounded -rotate-12 uppercase`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-slate-400 font-medium pt-1">{statusConfig.note}</p>
    </div>
  );
}