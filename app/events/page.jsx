"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import BannerImage from "../components/BannerImage";
import { subscribeEvents, getEventExpiryInfo } from "../../lib/events";

const TABS = [
  { key: "past", label: "Past" },
  { key: "today", label: "Todays" },
  { key: "upcoming", label: "Upcoming" },
];

function EventsContent() {
  const searchParams = useSearchParams();
  const partyParam = searchParams.get("party") || "";
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
    if (partyParam) {
      const pUpper = partyParam.toUpperCase();
      const evParty = String(ev.partyName || ev.party_name || ev.name || ev.eventTitle || "").toUpperCase();
      if (!evParty.includes(pUpper) && !pUpper.includes(evParty)) return false;
    }
    const evDate = getEventDate(ev);
    evDate.setHours(0, 0, 0, 0);
    if (tab === "today") return evDate.getTime() === today.getTime();
    if (tab === "upcoming") return evDate >= tomorrow;
    if (tab === "past") return evDate < today;
    return true;
  });

  // `normalizeEvent()` (lib/events.js) guarantees a numeric day even when the
  // ADMIN payload stored a weekday name in `day`.
  const formatDate = (month, day, year) => {
    const date = new Date(`${month} ${day}, ${year}`);
    if (isNaN(date.getTime())) return "TBD";

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
          {partyParam && (
            <div className="flex items-center gap-2 mt-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 w-fit">
              <span className="text-[10px] text-indigo-700 font-bold">Party: {partyParam}</span>
              <button
                onClick={() => { window.location.href = "/events"; }}
                className="text-xs text-indigo-400 hover:text-indigo-700 cursor-pointer"
                aria-label="Clear party filter"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 pb-1 pt-1">
          <div className="relative flex items-center bg-slate-200/80 p-1 rounded-2xl text-xs font-bold select-none">
            {/* Smooth sliding background pill */}
            <div
              className="absolute top-1 bottom-1 rounded-xl bg-[#12193b] shadow-md transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none"
              style={{
                width: `calc((100% - 8px) / 3)`,
                left: "4px",
                transform: `translateX(${Math.max(0, TABS.findIndex((t) => t.key === tab)) * 100}%)`,
              }}
            />

            {TABS.map((t) => {
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative z-10 flex-1 py-2 rounded-xl text-center font-bold text-xs transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? "text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
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
                const expiryInfo = getEventExpiryInfo(ev);
                const committeeName = ev.organizationName || ev.committeeName || "ADIM LAHAH MANDAWA";
                return (
                  <div
                    key={ev.key || i}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(`event_${ev.key}`, JSON.stringify(ev));
                      } catch {}
                      window.location.href = `/event-details?id=${encodeURIComponent(ev.key)}`;
                    }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden active:scale-95 transition-transform cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <BannerImage
                      src={ev.banner || ev.img || "/jarpa.png"}
                      alt={committeeName}
                      className="w-full h-28 object-contain bg-slate-100"
                    />
                    <div className="p-2.5">
                      <h4 className="text-xs font-black text-slate-900 font-brand truncate">{committeeName}</h4>
                      <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mt-1">
                        <i className="fa-solid fa-user-group text-indigo-500 text-[8px] flex-shrink-0" />
                        <span className="truncate">{ev.partyName || "Party TBD"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mt-1">
                        <i className="fa-solid fa-location-dot text-rose-500 text-[8px] flex-shrink-0" />
                        <span className="truncate">{ev.committeeLocation || ev.location || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] mt-1.5">
                        <i className="fa-regular fa-calendar text-emerald-600 text-[9px] flex-shrink-0" />
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9px] border border-emerald-200/80">
                          {formattedDate}
                        </span>
                      </div>
                      {expiryInfo.isExpired && (
                        <div className="mt-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-1 rounded text-[8.5px] font-black flex items-center gap-1">
                          <i className="fa-solid fa-clock-rotate-left text-[8px] text-rose-500 shrink-0" />
                          <span className="truncate">This event is expired on date {expiryInfo.formattedDate}</span>
                        </div>
                      )}

                      {expiryInfo.isExpired ? (
                        <div className="mt-2 w-full bg-slate-100 border border-slate-200 text-slate-500 font-black text-[9.5px] py-1.5 rounded-lg flex items-center justify-center gap-1">
                          <i className="fa-solid fa-ban text-[8px] text-rose-500" />
                          <span>Expired • Details</span>
                        </div>
                      ) : (
                        <div className="mt-2.5 w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold text-[10px] py-1.5 rounded-lg shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1">
                          <i className="fa-solid fa-ticket -rotate-12 text-[9px]" />
                          View Details
                        </div>
                      )}
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

export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsContent />
    </Suspense>
  );
}
