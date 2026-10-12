"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "../components/Header";
import BannerImage from "../components/BannerImage";
import { subscribeEvents } from "../../lib/events";

const TABS = [
  { key: "today", label: "Today's" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

const fallbackShows = [
  {
    key: "1",
    name: "ADIM OWAR JARPA OPERA",
    partyName: "Adim Opera Group",
    month: "Sept",
    day: "14",
    year: "2026",
    location: "Bahanada, Khunta, Mayurbhanj",
    banner: "/jarpa.png",
    time: "10:00 PM",
    type: "today",
  },
  {
    key: "2",
    name: "RAMRAJ GAYAN MOHAL",
    partyName: "Ramraj Opera",
    month: "Oct",
    day: "23",
    year: "2026",
    location: "Bahanada, Khunta, Mayurbhanj",
    banner: "/ramraj.png",
    time: "10:00 PM",
    type: "upcoming",
  },
  {
    key: "3",
    name: "PELA DADA - Ele Ele Ginj Bujhaw",
    partyName: "Adim Owat Jarpa Opera",
    month: "Aug",
    day: "15",
    year: "2026",
    location: "Suliapada, Mayurbhanj",
    banner: "/pela-dada.png",
    time: "10:00 PM",
    type: "past",
  },
];

export default function TodaysShowPage() {
  const [tab, setTab] = useState("today");
  const [liveShows, setLiveShows] = useState([]);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const tomorrowDate = new Date(todayDate);
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);

          const mapped = list.map((ev) => {
            const evDate = new Date(`${ev.month || "OCT"} ${ev.day || "22"}, ${ev.year || "2026"}`);
            evDate.setHours(0, 0, 0, 0);

            let evType = "upcoming";
            if (!isNaN(evDate.getTime())) {
              if (evDate.getTime() === todayDate.getTime()) evType = "today";
              else if (evDate < todayDate) evType = "past";
            }

            return {
              key: ev.key || ev.id,
              name: ev.name || ev.eventTitle || "Jatra Show",
              partyName: ev.partyName || ev.organizationName || "Adim Opera Group",
              month: ev.month || "OCT",
              day: ev.day || "22",
              year: ev.year || "2026",
              location: ev.location || "Mayurbhanj, Odisha",
              banner: ev.banner || "/jarpa.png",
              time: ev.time || ev.startTime || "10:00 PM",
              type: evType,
            };
          });
          setLiveShows(mapped);
        }
      });
      return () => unsub();
    } catch (e) {
      /* ignore */
    }
  }, []);

  const shows = liveShows.length > 0 ? liveShows : fallbackShows;
  const filteredShows = shows.filter((s) => s.type === tab);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
        {/* Header with back button */}
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3">
          <Link href="/" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </Link>
          <h2 className="text-lg font-black font-brand">Todays Show</h2>
        </div>

        <p className="px-4 text-xs text-slate-500 font-medium pt-2">All jatra shows today</p>

        {/* Tabs */}
        <div className="px-4 py-3">
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

        {/* Shows Grid */}
        <div className="px-4 flex-1">
          {filteredShows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">No {tab} shows</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {filteredShows.map((show) => (
              <Link key={show.key} href={`/todays-show/${show.key}`} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden active:scale-95 transition-transform">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <BannerImage
                  src={show.banner}
                  alt={show.name}
                  className="w-full h-28 object-cover"
                />
                <div className="p-2">
                  <h4 className="text-[10px] font-black text-slate-900 font-brand truncate leading-tight">{show.name}</h4>
                  <div className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold mt-0.5">
                    <i className="fa-solid fa-users text-indigo-500 text-[7px]" />
                    <span className="truncate">{show.partyName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-red-500 font-bold mt-0.5">
                    <i className="fa-regular fa-calendar text-[7px]" />
                    <span>{show.day} {show.month}</span>
                    <span className="text-slate-300">|</span>
                    <i className="fa-regular fa-clock text-[7px]" />
                    <span>{show.time}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold mt-0.5">
                    <i className="fa-solid fa-location-dot text-rose-500 text-[7px]" />
                    <span className="truncate">{show.location}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
