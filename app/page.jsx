"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookTicketsModal from "./components/BookTicketsModal";
import BottomNav from "./components/BottomNav";
import Header from "./components/Header";
import { saveBooking } from "../lib/bookings";
import { subscribeEvents } from "../lib/events";
import { subscribeBanners } from "../lib/banners";

export default function Home() {
  const [booking, setBooking] = useState(null);
  const [countdown, setCountdown] = useState({ d: "00", h: "00", m: "00", s: "00" });

  useEffect(() => {
    const TARGET = new Date("2026-10-22T23:00:00");
    const tick = () => {
      const diff = Math.max(0, TARGET.getTime() - Date.now());
      const pad = (n) => String(Math.floor(n)).padStart(2, "0");
      setCountdown({
        d: pad(diff / 86400000),
        h: pad((diff / 3600000) % 24),
        m: pad((diff / 60000) % 60),
        s: pad((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      {/* Full Screen Container */}
      <div className="bg-[#f8faff] min-h-screen relative pb-28 shadow-2xl flex flex-col overflow-x-hidden">
        {/* ==============================================
            1. TOP HEADER & APP BAR
        ============================================== */}
        <Header />

        {/* ==============================================
            2. HERO BANNER (AUTO SLIDER) - Full width, no padding
        ============================================== */}
        <HeroCarousel />

        <main className="p-3.5 space-y-3.5">

          {/* ==============================================
            TODAY'S SHOW SECTION
          ============================================== */}
          <TodaysShow />

          {/* ==============================================
            3. EVENT SCHEDULE & LOCATION CARDS (SLIDER)
          ============================================== */}
          <EventCarousel />

          {/* ==============================================
            4. COUNTDOWN TIMER COMPONENT
          ============================================== */}
          <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 rounded-2xl p-3 border border-pink-200/70 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center text-base shadow-sm">
                <i className="fa-solid fa-bullhorn -rotate-12" />
              </div>
              <span className="text-xs font-bold text-slate-900 font-brand">Show Starts In</span>
            </div>

            <div className="flex items-center gap-1.5 text-center">
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-slate-900 leading-tight">{countdown.d}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Days</div>
              </div>
              <span className="font-bold text-pink-400">:</span>
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-indigo-950 leading-tight">{countdown.h}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Hours</div>
              </div>
              <span className="font-bold text-pink-400">:</span>
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-indigo-950 leading-tight">{countdown.m}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Minutes</div>
              </div>
              <span className="font-bold text-pink-400">:</span>
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-rose-600 leading-tight">{countdown.s}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Seconds</div>
              </div>
            </div>
          </div>

          {/* ==============================================
            5. TICKET TIERS SELECTION (PRICING CARDS)
          ============================================== */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🎟️</span>
                <h3 className="text-base font-black text-slate-900 font-brand tracking-tight">Book Your Ticket</h3>
              </div>
              <a href="#" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                View Seat & Gate Info <i className="fa-solid fa-arrow-right text-[10px]" />
              </a>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1">
              {/* STANDING - Orange */}
              <div className="min-w-[160px] flex-1 bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1">
                <div className="relative bg-gradient-to-r from-[#ff5500] via-[#ff7700] to-[#ffaa00] h-24 pt-4 text-center overflow-hidden">
                  <div className="absolute inset-0 pattern-dots opacity-80 pointer-events-none"></div>
                  <h4 className="relative z-10 text-base font-black text-white tracking-wider font-brand uppercase drop-shadow-sm">STANDING</h4>
                  <span className="relative z-10 inline-block mt-1 bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-md border border-white/30">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate A
                  </span>
                </div>

                <div className="relative -mt-7 flex justify-center z-20">
                  <div className="relative z-10 w-16 h-16 rounded-full p-1.5 bg-white shadow-xl flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#ff8c00] to-[#ff4900] shadow-[inset_0_4px_8px_rgba(0,0,0,0.35)] flex items-center justify-center text-white">
                      <span className="text-2xl font-black font-brand tracking-tight drop-shadow">50</span>
                    </div>
                  </div>
                </div>

                <div className="px-3 pt-3 pb-2 flex-1">
                  <ul className="space-y-2 text-[10px] leading-relaxed text-slate-500 font-medium">
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Normal Entry</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Free Seating</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-xmark text-slate-400 text-xs mt-0.5" />
                      <span>Fast Track Entry</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-xmark text-slate-400 text-xs mt-0.5" />
                      <span>Best View Zone</span>
                    </li>
                  </ul>
                </div>

                <div className="h-1.5 w-full bg-gradient-to-r from-[#ff5500] to-[#ffaa00]" />

                <div className="bg-[#242426] p-3 flex items-center justify-center">
                  <button onClick={() => setBooking({ tierId: "standing" })} className="w-32 py-2 px-4 rounded-full bg-gradient-to-r from-[#ff5500] to-[#ff8c00] text-white font-extrabold text-xs uppercase tracking-wider font-brand shadow-md active:scale-95 transition-transform hover:brightness-110">
                    <i className="fa-solid fa-bolt text-[10px] mr-1" /> Book Now
                  </button>
                </div>
              </div>

              {/* SPECIAL - Green/Cyan/Blue */}
              <div className="min-w-[160px] flex-1 bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1">
                <div className="relative bg-gradient-to-r from-[#00c978] via-[#00a6c9] to-[#0077ff] h-24 pt-4 text-center overflow-hidden">
                  <div className="absolute inset-0 pattern-dots opacity-80 pointer-events-none"></div>
                  <h4 className="relative z-10 text-base font-black text-white tracking-wider font-brand uppercase drop-shadow-sm">SPECIAL</h4>
                  <span className="relative z-10 inline-block mt-1 bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-md border border-white/30">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate B
                  </span>
                </div>

                <div className="relative -mt-7 flex justify-center z-20">
                  <div className="relative z-10 w-16 h-16 rounded-full p-1.5 bg-white shadow-xl flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#00c978] to-[#0077ff] shadow-[inset_0_4px_8px_rgba(0,0,0,0.35)] flex items-center justify-center text-white">
                      <span className="text-2xl font-black font-brand tracking-tight drop-shadow">100</span>
                    </div>
                  </div>
                </div>

                <div className="px-3 pt-3 pb-2 flex-1">
                  <ul className="space-y-2 text-[10px] leading-relaxed text-slate-500 font-medium">
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Fast Entry</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Better View</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Covered Seating</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-xmark text-slate-400 text-xs mt-0.5" />
                      <span>Priority Entry</span>
                    </li>
                  </ul>
                </div>

                <div className="h-1.5 w-full bg-gradient-to-r from-[#00c978] to-[#0077ff]" />

                <div className="bg-[#242426] p-3 flex items-center justify-center">
                  <button onClick={() => setBooking({ tierId: "special" })} className="w-32 py-2 px-4 rounded-full bg-gradient-to-r from-[#00c978] to-[#009fd9] text-white font-extrabold text-xs uppercase tracking-wider font-brand shadow-md active:scale-95 transition-transform hover:brightness-110">
                    <i className="fa-solid fa-bolt text-[10px] mr-1" /> Book Now
                  </button>
                </div>
              </div>

              {/* VIP - Violet/Purple (Popular) */}
              <div className="min-w-[160px] flex-1 bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 relative">
                <div className="absolute top-3 -right-7 bg-red-500 text-white text-[9px] font-extrabold uppercase py-0.5 px-7 rotate-45 shadow-sm z-30">
                  Popular
                </div>

                <div className="relative bg-gradient-to-r from-[#702bf9] via-[#5b24e6] to-[#3a1eb8] h-24 pt-4 text-center overflow-hidden">
                  <div className="absolute inset-0 pattern-dots opacity-80 pointer-events-none"></div>
                  <h4 className="relative z-10 text-base font-black text-white tracking-wider font-brand uppercase drop-shadow-sm">VIP</h4>
                  <span className="relative z-10 inline-block mt-1 bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-md border border-white/30">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate C
                  </span>
                </div>

                <div className="relative -mt-7 flex justify-center z-20">
                  <div className="relative z-10 w-16 h-16 rounded-full p-1.5 bg-white shadow-xl flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#8033ff] to-[#3a1eb8] shadow-[inset_0_4px_8px_rgba(0,0,0,0.35)] flex items-center justify-center text-white">
                      <span className="text-2xl font-black font-brand tracking-tight drop-shadow">200</span>
                    </div>
                  </div>
                </div>

                <div className="px-3 pt-3 pb-2 flex-1">
                  <ul className="space-y-2 text-[10px] leading-relaxed text-slate-500 font-medium">
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Priority Entry</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Best View Zone</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Reserved Seating</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-xmark text-slate-400 text-xs mt-0.5" />
                      <span>Exclusive Lounge</span>
                    </li>
                  </ul>
                </div>

                <div className="h-1.5 w-full bg-gradient-to-r from-[#702bf9] to-[#3a1eb8]" />

                <div className="bg-[#242426] p-3 flex items-center justify-center">
                  <button onClick={() => setBooking({ tierId: "vip" })} className="w-32 py-2 px-4 rounded-full bg-gradient-to-r from-[#702bf9] to-[#5b24e6] text-white font-extrabold text-xs uppercase tracking-wider font-brand shadow-md active:scale-95 transition-transform hover:brightness-110">
                    <i className="fa-solid fa-bolt text-[10px] mr-1" /> Book Now
                  </button>
                </div>
              </div>

              {/* STAR - Dark/Gold */}
              <div className="min-w-[160px] flex-1 bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1">
                <div className="relative bg-gradient-to-r from-[#161a29] via-[#1f2437] to-[#0f1424] h-24 pt-4 text-center overflow-hidden">
                  <div className="absolute inset-0 pattern-dots opacity-60 pointer-events-none"></div>
                  <h4 className="relative z-10 text-base font-black text-amber-400 tracking-wider font-brand uppercase drop-shadow-sm">STAR</h4>
                  <span className="relative z-10 inline-block mt-1 bg-amber-400/20 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-amber-400/30">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate D
                  </span>
                </div>

                <div className="relative -mt-7 flex justify-center z-20">
                  <div className="relative z-10 w-16 h-16 rounded-full p-1.5 bg-white shadow-xl flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#d4a017] to-[#8a6500] shadow-[inset_0_4px_8px_rgba(0,0,0,0.35)] flex items-center justify-center text-white">
                      <span className="text-2xl font-black font-brand tracking-tight drop-shadow">500</span>
                    </div>
                  </div>
                </div>

                <div className="px-3 pt-3 pb-2 flex-1">
                  <ul className="space-y-2 text-[10px] leading-relaxed text-slate-500 font-medium">
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Exclusive Entry</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Special Sitting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Priority Entry</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <i className="fa-solid fa-check text-emerald-500 text-xs mt-0.5" />
                      <span>Best View Zone</span>
                    </li>
                  </ul>
                </div>

                <div className="h-1.5 w-full bg-gradient-to-r from-[#b8860b] to-[#e6b800]" />

                <div className="bg-[#242426] p-3 flex items-center justify-center">
                  <button onClick={() => setBooking({ tierId: "star" })} className="w-32 py-2 px-4 rounded-full bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-white font-extrabold text-xs uppercase tracking-wider font-brand shadow-md active:scale-95 transition-transform hover:brightness-110">
                    <i className="fa-solid fa-bolt text-[10px] mr-1" /> Book Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ==============================================
            6. WHY BOOK ONLINE FEATURE GRID
          ============================================== */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 text-base">✨</span>
                <h3 className="text-sm font-black text-slate-900 font-brand">Why Book Online?</h3>
              </div>
              <a href="#" className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                <i className="fa-regular fa-circle-play text-[10px]" /> How it Works? <i className="fa-solid fa-angle-right text-[9px]" />
              </a>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-sky-100/70 text-sky-600 flex items-center justify-center text-lg mb-1.5 border border-sky-200/50">
                  <i className="fa-solid fa-qrcode" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Instant<br />QR Ticket</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-purple-100/70 text-purple-600 flex items-center justify-center text-lg mb-1.5 border border-purple-200/50">
                  <i className="fa-solid fa-mobile-screen-button" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Book<br />Anytime</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center text-lg mb-1.5 border border-indigo-200/50">
                  <i className="fa-solid fa-person-walking-arrow-right" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Skip the<br />Queue</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center text-lg mb-1.5 border border-emerald-200/50">
                  <i className="fa-solid fa-shield-check" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Secure &<br />Verified</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-lime-100/70 text-lime-600 flex items-center justify-center text-lg mb-1.5 border border-lime-200/50">
                  <i className="fa-solid fa-leaf" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Paperless &<br />Eco Friendly</span>
              </div>
            </div>
          </div>

          {/* ==============================================
            7. LIVE STATS STRIP
          ============================================== */}
          <div className="bg-[#101736] text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="text-amber-400 text-xl"><i className="fa-solid fa-ticket-simple" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold leading-tight">Tickets Sold</p>
                <p className="text-base font-black tracking-tight text-white leading-tight">3,250</p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-slate-700" />

            <div className="flex items-center gap-2">
              <div className="text-sky-400 text-xl"><i className="fa-solid fa-users" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold leading-tight">Happy Visitors</p>
                <p className="text-base font-black tracking-tight text-white leading-tight">1,980</p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-slate-700" />

            <div className="flex items-center gap-2">
              <div className="text-rose-500 text-xl">🔥</div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold leading-tight">Limited Tickets</p>
                <p className="text-sm font-black tracking-tight text-amber-400 leading-tight">Hurry Up!</p>
              </div>
            </div>
          </div>

          {/* ==============================================
            8. SOCIAL PROOF BANNER
          ============================================== */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Avatar" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" alt="Avatar" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" alt="Avatar" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800">
                <strong className="font-black text-slate-900">50+ people booked</strong> in last 1 hour
              </span>
            </div>

            <a href="#" className="text-[11px] font-extrabold text-rose-600 flex items-center gap-1 hover:underline whitespace-nowrap">
              🔥 Book Now Before It's Full! <i className="fa-solid fa-angle-right text-[10px]" />
            </a>
          </div>

          {/* ==============================================
            9. PRIMARY CALL TO ACTION BUTTON
          ============================================== */}
          <Link href="/book" className="block w-full bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white font-extrabold text-base py-3.5 px-4 rounded-2xl shadow-lg shadow-rose-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <i className="fa-solid fa-ticket -rotate-12 text-lg" />
            <span>Book Ticket Now</span>
            <i className="fa-solid fa-chevron-right text-xs ml-1" />
          </Link>
        </main>

        {/* ==============================================
          10. FIXED BOTTOM NAVIGATION BAR (animated)
        ============================================== */}
        <BottomNav active="home" />
      </div>

      {booking && (
        <BookTicketsModal
          initialTierId={booking.tierId}
          onClose={() => setBooking(null)}
          onProceed={async (data) => {
            try {
              await saveBooking(data);
            } catch (err) {
              console.error("Failed to save booking", err);
            }
            setBooking(null);
          }}
        />
      )}
    </div>
  );
}

function TodaysShow() {
  const shows = [
    {
      key: "1",
      name: "ADIM OWAR JARPA OPERA",
      partyName: "Adim Opera Group",
      month: "SEP",
      day: "14",
      year: "2026",
      location: "Bahanada, Khunta, Mayurbhanj",
      banner: "/jarpa.png",
      time: "10:00 PM - 05:00 AM",
    },
    {
      key: "2",
      name: "RAMRAJ GAYAN MOHAL",
      partyName: "Ramraj Opera",
      month: "OCT",
      day: "23",
      year: "2026",
      location: "Bahanada, Khunta, Mayurbhanj",
      banner: "/ramraj.png",
      time: "10:00 PM - 05:00 AM",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🎭</span>
          <h3 className="text-base font-black text-slate-900 font-brand tracking-tight">Todays Show</h3>
        </div>
        <Link href="/todays-show" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
          View All <i className="fa-solid fa-arrow-right text-[10px]" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {shows.map((show) => (
          <div key={show.key} className="min-w-[260px] flex-shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={show.banner}
              alt={show.name}
              className="w-full h-32 object-cover"
            />
            <div className="p-2.5">
              <h4 className="text-xs font-black text-slate-900 font-brand truncate">{show.name}</h4>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold mt-1">
                <i className="fa-solid fa-users text-indigo-500 text-[9px]" />
                <span className="truncate">{show.partyName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold mt-0.5">
                <i className="fa-regular fa-calendar text-rose-500 text-[9px]" />
                <span>{show.month} {show.day}, {show.year}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold mt-0.5">
                <i className="fa-solid fa-location-dot text-rose-500 text-[9px]" />
                <span className="truncate">{show.location}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-800 font-bold mt-0.5">
                <i className="fa-regular fa-clock text-indigo-500 text-[9px]" />
                <span>{show.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroCarousel() {
  const slides = [
    { img: "/jarpa.png" },
    { img: "/ramraj.png" },
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length === 0) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div>
      <div className="relative w-full h-[200px] overflow-hidden bg-slate-900">
        <div
          className="flex transition-transform duration-700 ease-in-out h-full"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full flex-shrink-0 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.img}
                alt={`Banner ${i + 1}`}
                className="w-full h-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-2.5 bg-white">
        {slides.map((_, si) => (
          <button
            key={si}
            aria-label={`Go to slide ${si + 1}`}
            onClick={() => setIndex(si)}
            className="relative h-2 rounded-full overflow-hidden transition-all duration-300"
            style={{ width: si === index ? "32px" : "8px", backgroundColor: "#e2e8f0" }}
          >
            {si === index && (
              <span
                className="absolute inset-y-0 left-0 bg-indigo-600 rounded-full banner-progress"
              />
            )}
          </button>
        ))}
      </div>

      <style>{`
        .banner-progress {
          width: 100%;
          animation: bannerProgress 5s linear forwards;
        }
        @keyframes bannerProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

function EventCarousel() {
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

  const [events, setEvents] = useState(defaultEvents);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((data) => {
        if (data && data.length > 0) {
          setEvents(data);
          setIndex(0);
        }
      });
      return () => unsub();
    } catch (err) {
      return () => {};
    }
  }, []);

  useEffect(() => {
    if (events.length === 0) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % events.length), 4000);
    return () => clearInterval(id);
  }, [events.length]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {events.map((ev, i) => (
            <div key={i} className="w-full flex-shrink-0">
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-3 translate-y-2">
                  <i className="fa-solid fa-users text-8xl text-indigo-900" />
                </div>

                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap -mt-1 blink-live">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  <span>Live Booking</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-shrink-0 w-20 bg-rose-50 border border-rose-200 rounded-xl overflow-hidden text-center shadow-xs">
                    <div className="bg-rose-600 text-white font-extrabold text-[11px] py-0.5 uppercase tracking-wider">{ev.month}</div>
                    <div className="text-2xl font-black text-slate-900 leading-none py-1">{ev.day}</div>
                    <div className="text-[11px] font-bold text-slate-600 pb-1">{ev.year}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="text-base font-black text-slate-900 truncate font-brand flex items-center gap-1">
                        {ev.name} <span>{ev.emoji}</span>
                      </h3>
                      <div className="w-6" />
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
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-2">
        {events.map((_, si) => (
          <button
            key={si}
            aria-label={`Go to event ${si + 1}`}
            onClick={() => setIndex(si)}
            className={`${si === index ? "w-2.5 h-2.5 rounded-full bg-indigo-600" : "w-2 h-2 rounded-full bg-slate-200"} transition-all`}
          />
        ))}
      </div>
    </div>
  );
}