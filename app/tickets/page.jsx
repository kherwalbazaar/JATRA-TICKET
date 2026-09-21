"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import { fetchBookings } from "../../lib/bookings";

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
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookings() {
      try {
        const data = await fetchBookings();
        setBookings(data);
      } catch (err) {
        console.error("Failed to load bookings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);

  const upcomingTickets = bookings.filter((b) => b.status === "Confirmed" || b.status === "active");
  const usedTickets = bookings.filter((b) => b.status === "used");
  const cancelledTickets = bookings.filter((b) => b.status === "cancelled" || b.status === "expired");

  const STATUS_TAB = [
    { key: "upcoming", label: "Upcoming", count: upcomingTickets.length },
    { key: "used", label: "Used", count: usedTickets.length },
    { key: "cancelled", label: "Cancelled", count: cancelledTickets.length },
  ];

  const currentList = tab === "upcoming" ? upcomingTickets : tab === "used" ? usedTickets : cancelledTickets;

  const latestBooking = upcomingTickets[0];

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        <Header />

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
          {loading ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">Loading tickets...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-ticket text-4xl text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No {tab} tickets</p>
            </div>
          ) : tab === "upcoming" ? (
            <>
              {latestBooking && (
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
                        <button onClick={async () => { try { await navigator.clipboard.writeText(latestBooking.ticketNumber); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900">
                          <span>{copied ? "Copied" : latestBooking.ticketNumber}</span>
                          <i className={`${copied ? "fa-solid fa-check text-emerald-600" : "fa-regular fa-copy"} text-xs`} />
                        </button>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 font-brand truncate uppercase tracking-tight">Event Booking</h3>
                      <div className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-600">
                        <div className="flex items-center gap-1.5 truncate">
                          <i className="fa-regular fa-calendar text-rose-500 text-[11px]" />
                          <span>{latestBooking.date}</span>
                          <span className="text-slate-300">•</span>
                          <i className="fa-regular fa-clock text-indigo-600 text-[11px]" />
                          <span>{latestBooking.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <i className="fa-solid fa-location-dot text-rose-500 text-[11px]" />
                          <span className="truncate">{latestBooking.assignedGate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50/80 rounded-xl p-2 text-center border border-slate-100">
                    <div>
                      <span className="text-sm font-black text-slate-900 leading-tight block">{upcomingTickets.length}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Tickets</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-purple-900 leading-tight block">{latestBooking.ticketTypeName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Category</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-indigo-900 leading-tight block">{latestBooking.assignedGate}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Entry Gate</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-emerald-600 leading-tight block">₹{latestBooking.amount}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Total Amount</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {upcomingTickets.map((ticket, index) => (
                  <Link
                    key={ticket.key || ticket.ticketNumber}
                    href={`/tickets/${ticket.ticketNumber}`}
                    className={`relative rounded-2xl p-3 shadow-md border border-white/20 flex items-center justify-between gap-3 overflow-hidden text-white bg-gradient-to-br ${cardGradients[index % cardGradients.length]} transition-transform active:scale-[0.98]`}
                  >
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
                          <h4 className="text-xs font-black text-white truncate drop-shadow">Ticket Holder</h4>
                        </div>
                        <p className="text-[11px] font-bold text-white/80 mt-0.5">{ticket.ticketTypeName} <span className="text-white/40">•</span> {ticket.assignedGate}</p>
                        <p className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow">Ticket ID: {ticket.ticketNumber}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white mt-1 bg-white/20 backdrop-blur px-1.5 py-0.5 rounded-md ring-1 ring-white/30">
                          <i className="fa-solid fa-circle-check text-xs" />
                          <span>ACTIVE <span className="font-semibold text-white/75 text-[9px]">- Ready for entry</span></span>
                        </span>
                      </div>
                    </div>

                    <div className="relative w-16 h-16 p-1 bg-white/90 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ring-2 ring-white/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.ticketNumber}`} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <TicketStatusList list={currentList} tab={tab} />
          )}
        </div>

        <BottomNav active="tickets" />
      </div>
    </div>
  );
}

function TicketStatusList({ list, tab }) {
  const statusConfig = {
    used: {
      label: "USED",
      textClass: "text-red-500",
      badge: "border-red-500 bg-white/95 text-red-500",
      note: "Entry Completed",
      gradient: "bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300",
    },
    cancelled: {
      label: "CANCELLED",
      textClass: "text-white",
      badge: "border-red-600 bg-white/95 text-red-600",
      note: "This ticket is cancelled",
      gradient: "bg-gradient-to-br from-slate-600 to-slate-800",
    },
  }[tab];

  return (
    <div className="space-y-2.5">
      {list.map((ticket) => (
        <div
          key={ticket.key || ticket.ticketNumber}
          className={`relative rounded-2xl p-3 shadow-md border border-white/20 flex items-center justify-between gap-3 overflow-hidden text-white bg-gradient-to-br ${statusConfig.gradient} ${tab === "cancelled" ? "opacity-90" : ""}`}
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

          <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
            <span className={`w-6 h-6 rounded-full bg-white/50 backdrop-blur ${tab === "used" ? "text-slate-600" : "text-white"} font-black text-xs flex items-center justify-center flex-shrink-0 ring-1 ring-white/30`}>
              <i className="fa-solid fa-user text-[10px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <i className={`fa-regular fa-circle-user ${tab === "used" ? "text-slate-500" : "text-white/80"} text-sm`} />
                <h4 className={`text-xs font-black ${tab === "used" ? "text-slate-700" : "text-white"} truncate drop-shadow`}>Ticket Holder</h4>
              </div>
              <p className={`text-[11px] font-bold ${tab === "used" ? "text-slate-500" : "text-white/80"} mt-0.5`}>
                {ticket.ticketTypeName} <span className={tab === "used" ? "text-slate-300" : "text-white/40"}>•</span> {ticket.assignedGate} <span className={tab === "used" ? "text-slate-300" : "text-white/40"}>•</span> {ticket.date}
              </p>
              <p className={`text-[11px] font-extrabold ${tab === "used" ? "text-slate-600" : "text-white"} mt-0.5 drop-shadow`}>Ticket ID: {ticket.ticketNumber}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-md ring-1 ${tab === "used" ? "text-red-500 bg-red-50 ring-red-200" : "text-white bg-white/20 backdrop-blur ring-white/30"}`}>
                <i className="fa-solid fa-circle-check text-xs" />
                <span>{statusConfig.label}</span>
              </span>
            </div>
          </div>

          <div className={`relative w-16 h-16 p-1 bg-white/90 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ring-2 ${tab === "used" ? "ring-slate-200" : "ring-white/40"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.ticketNumber}`} alt="QR Code" className={`w-full h-full object-contain ${tab === "cancelled" ? "grayscale" : ""}`} />
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
