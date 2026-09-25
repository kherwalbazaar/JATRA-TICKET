"use client";

import { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import BannerImage from "../components/BannerImage";
import { subscribeEvents } from "../../lib/events";

const TABS = [
  { key: "today", label: "Today's" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    try {
      const unsub = subscribeEvents((data) => {
        setEvents(data || []);
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      setLoading(false);
      return () => {};
    }
  }, []);

  const getEventDate = (ev) => {
    return new Date(`${ev.month || "OCT"} ${ev.day || "22"}, ${ev.year || "2026"}`);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filteredEvents = events.filter((ev) => {
    const evDate = getEventDate(ev);
    evDate.setHours(0, 0, 0, 0);
    if (tab === "today") return evDate.getTime() === today.getTime();
    if (tab === "upcoming") return evDate >= tomorrow;
    if (tab === "past") return evDate < today;
    return true;
  });

  const formatDate = (month, day, year) => {
    // Check if day is a day name (like "Sunday") vs numeric day (like "22")
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const isDayName = dayNames.includes(day);
    
    if (isDayName) {
      // Data issue: day contains day name instead of numeric day
      const monthShort = new Date(`${month} 1, ${year}`).toLocaleString("en-US", { month: "short" });
      return `${monthShort} ${day}, ${year}`; // Shows "OCT Sunday, 2026" to indicate data issue
    }
    
    // Normal case: day is numeric
    const date = new Date(`${month} ${day}, ${year}`);
    if (isNaN(date.getTime())) {
      return "TBD";
    }
    
    const monthShort = date.toLocaleString("en-US", { month: "short" });
    return `${date.getDate()} ${monthShort} ${date.getFullYear()}`;
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        <Header />

        <div className="p-4 pb-2">
          <h2 className="text-2xl font-black text-slate-900 font-brand">Events</h2>
          <p className="text-xs text-slate-500 font-medium">Explore upcoming jatra shows & book your tickets</p>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-1 pt-1">
          <div className="flex items-center bg-slate-200/70 p-1 rounded-2xl text-xs font-bold gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-xl transition-all text-center ${
                  tab === t.key
                    ? "bg-[#12193b] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        <div className="px-4 flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading events...</p>
            </div>
          )}

          {!loading && filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">No {tab} events</p>
              <p className="text-xs text-slate-400">Check back soon for new jatra shows!</p>
            </div>
          )}

          {!loading && filteredEvents.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {filteredEvents.map((ev, i) => {
                const formattedDate = formatDate(ev.month || "OCT", ev.day || "22", ev.year || "2026");
                return (
                  <div
                    key={ev.key || i}
                    onClick={() => { window.location.href = `/events/${ev.key}`; }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden active:scale-95 transition-transform cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <BannerImage
                      src={ev.banner || ev.img || "/jarpa.png"}
                      alt={ev.name}
                      className="w-full h-28 object-contain bg-slate-100"
                    />
                    <div className="p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="bg-rose-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded">{formattedDate}</span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 font-brand truncate">{ev.name || "Event"}</h4>
                      <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mt-0.5">
                        <i className="fa-solid fa-user-group text-indigo-500 text-[8px]" />
                        <span className="truncate">{ev.partyName || ev.organizationName || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mt-0.5">
                        <i className="fa-solid fa-location-dot text-rose-500 text-[8px]" />
                        <span className="truncate">{ev.location || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-indigo-800 font-bold mt-0.5">
                        <i className="fa-regular fa-clock text-indigo-500 text-[8px]" />
                        <span>{ev.entryTime || "TBD"}</span>
                      </div>
                      <div className="mt-2 w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold text-[10px] py-1.5 rounded-lg shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1">
                        <i className="fa-solid fa-ticket -rotate-12 text-[9px]" />
                        View Details
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <BottomNav active="events" />
      </div>
    </div>
  );
}
