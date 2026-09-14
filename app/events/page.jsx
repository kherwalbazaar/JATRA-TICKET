"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import { subscribeEvents } from "../../lib/events";

const defaultEvents = [
  {
    month: "OCT",
    day: "22",
    year: "2026",
    name: "ADIM OWAR JARPA OPERA",
    emoji: "🔥",
    location: "Bahanada, Khunta, Mayurbhanj",
    entryTime: "10:00 PM",
    startTime: "11:00 PM",
  },
  {
    month: "OCT",
    day: "23",
    year: "2026",
    name: "RAMRAJ GAYAN MOHAL",
    emoji: "🔥",
    location: "Bahanada, Khunta, Mayurbhanj",
    entryTime: "10:00 PM",
    startTime: "11:00 PM",
  },
];

export default function EventsPage() {
  const [events, setEvents] = useState(defaultEvents);

  useEffect(() => {
    const unsub = subscribeEvents((data) => {
      if (data && data.length > 0) setEvents(data);
    });
    return () => unsub();
  }, []);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        {/* Top App Header */}
        <Header />

        {/* Page Title */}
        <div className="p-4 pb-2">
          <h2 className="text-2xl font-black text-slate-900 font-brand">Events</h2>
          <p className="text-xs text-slate-500 font-medium">Explore upcoming jatra shows & book your tickets</p>
        </div>

        {/* Event List */}
        <div className="p-4 space-y-4 flex-1">
          {events.length === 0 && (
            <p className="text-center text-xs text-slate-400 font-medium py-10">No events yet.</p>
          )}

          {events.map((ev, i) => (
            <div key={i} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-3 translate-y-2">
                <i className="fa-solid fa-users text-8xl text-indigo-900" />
              </div>

              <div className="flex items-center gap-3 relative">
                <div className="flex-shrink-0 w-20 bg-rose-50 border border-rose-200 rounded-xl overflow-hidden text-center shadow-xs">
                  <div className="bg-rose-600 text-white font-extrabold text-[11px] py-0.5 uppercase tracking-wider">{ev.month}</div>
                  <div className="text-2xl font-black text-slate-900 leading-none py-1">{ev.day}</div>
                  <div className="text-[11px] font-bold text-slate-600 pb-1">{ev.year}</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-base font-black text-slate-900 truncate font-brand flex items-center gap-1">
                      {ev.name} <span>{ev.emoji}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-1">
                    <i className="fa-solid fa-location-dot text-rose-500 text-xs flex-shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-900 font-bold">
                    <i className="fa-regular fa-clock text-indigo-600 text-xs flex-shrink-0" />
                    <span>
                      Entry {ev.entryTime} <span className="text-slate-300 font-normal mx-0.5">|</span> Jatra Start {ev.startTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 relative">
                <Link
                  href="/book"
                  className="flex-1 bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-ticket -rotate-12 text-xs" />
                  <span>Book Tickets</span>
                </Link>
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap blink-live">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  Live Booking
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Bottom Navigation Bar */}
        <BottomNav active="events" />
      </div>
    </div>
  );
}