"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import { subscribeEvents } from "../../lib/events";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeEvents((data) => {
      setEvents(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const formatDate = (month, day, year) => {
    const date = new Date(`${month} ${day}, ${year}`);
    const monthShort = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
    return { month: monthShort, day: String(date.getDate()), year: String(date.getFullYear()) };
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        <Header />

        <div className="p-4 pb-2">
          <h2 className="text-2xl font-black text-slate-900 font-brand">Events</h2>
          <p className="text-xs text-slate-500 font-medium">Explore upcoming jatra shows & book your tickets</p>
        </div>

        <div className="p-4 space-y-4 flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading events...</p>
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">No upcoming events</p>
              <p className="text-xs text-slate-400">Check back soon for new jatra shows!</p>
            </div>
          )}

          {!loading && events.map((ev, i) => {
            const { month, day, year } = formatDate(ev.month || "OCT", ev.day || "22", ev.year || "2026");
            return (
              <div key={ev.key || i} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-3 translate-y-2">
                  <i className="fa-solid fa-users text-8xl text-indigo-900" />
                </div>

                <div className="flex items-center gap-3 relative">
                  <div className="flex-shrink-0 w-20 bg-rose-50 border border-rose-200 rounded-xl overflow-hidden text-center shadow-xs">
                    <div className="bg-rose-600 text-white font-extrabold text-[11px] py-0.5 uppercase tracking-wider">{month}</div>
                    <div className="text-2xl font-black text-slate-900 leading-none py-1">{day}</div>
                    <div className="text-[11px] font-bold text-slate-600 pb-1">{year}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-base font-black text-slate-900 truncate font-brand flex items-center gap-1">
                        {ev.name || "Event"} <span>{ev.emoji || "🎭"}</span>
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-1">
                      <i className="fa-solid fa-location-dot text-rose-500 text-xs flex-shrink-0" />
                      <span className="truncate">{ev.location || "Location TBD"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-900 font-bold">
                      <i className="fa-regular fa-clock text-indigo-600 text-xs flex-shrink-0" />
                      <span>
                        Entry {ev.entryTime || "TBD"} <span className="text-slate-300 font-normal mx-0.5">|</span> Jatra Start {ev.startTime || "TBD"}
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
            );
          })}
        </div>

        <BottomNav active="events" />
      </div>
    </div>
  );
}
