"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookTicketsModal from "./components/BookTicketsModal";

export default function Home() {
  const [booking, setBooking] = useState(null);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      {/* Full Screen Container */}
      <div className="bg-[#f8faff] min-h-screen relative pb-28 shadow-2xl flex flex-col overflow-x-hidden">
        {/* ==============================================
            1. TOP HEADER & APP BAR
        ============================================== */}
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

        <main className="p-3.5 space-y-3.5">
          {/* ==============================================
            2. HERO BANNER (AUTO SLIDER)
          ============================================== */}
          <HeroCarousel />

          {/* ==============================================
            3. EVENT SCHEDULE & LOCATION CARD
          ============================================== */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-3 translate-y-2">
              <i className="fa-solid fa-users text-8xl text-indigo-900" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex-shrink-0 w-20 bg-rose-50 border border-rose-200 rounded-xl overflow-hidden text-center shadow-xs">
                <div className="bg-rose-600 text-white font-extrabold text-[11px] py-0.5 uppercase tracking-wider">OCT</div>
                <div className="text-2xl font-black text-slate-900 leading-none py-1">22</div>
                <div className="text-[11px] font-bold text-slate-600 pb-1">2026</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-base font-black text-slate-900 truncate font-brand flex items-center gap-1">
                    Adim Lahah Mandawa 2026 <span>🔥</span>
                  </h3>
                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Live Booking</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-1">
                  <i className="fa-solid fa-location-dot text-rose-500 text-xs flex-shrink-0" />
                  <span className="truncate">Balanada, Khunta, Mayurbhanj</span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-indigo-900 font-bold">
                  <i className="fa-regular fa-clock text-indigo-600 text-xs flex-shrink-0" />
                  <span>
                    Entry 6:00 PM <span className="text-slate-300 font-normal mx-0.5">|</span> Jatra Start 8:00 PM
                  </span>
                </div>
              </div>
            </div>
          </div>

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
                <div className="text-sm font-black text-slate-900 leading-tight">5</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Days</div>
              </div>
              <span className="font-bold text-pink-400">:</span>
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-indigo-950 leading-tight">08</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Hours</div>
              </div>
              <span className="font-bold text-pink-400">:</span>
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-indigo-950 leading-tight">24</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Minutes</div>
              </div>
              <span className="font-bold text-pink-400">:</span>
              <div className="bg-white px-2 py-1 rounded-xl shadow-xs border border-pink-100 min-w-[42px]">
                <div className="text-sm font-black text-rose-600 leading-tight">36</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">Seconds</div>
              </div>
            </div>
          </div>

          {/* ==============================================
            5. TICKET TIERS SELECTION (HORIZONTAL SCROLL)
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

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              <div className="min-w-[125px] flex-1 bg-gradient-to-b from-amber-50/70 to-white rounded-2xl p-3 border border-amber-200 shadow-xs flex flex-col justify-between text-center relative">
                <div>
                  <div className="text-2xl mb-1">👨‍👩‍👧‍👦</div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">General</h4>
                  <span className="inline-block mt-1 bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate A
                  </span>
                  <div className="my-2.5">
                    <span className="text-lg font-black text-slate-900">₹50</span>
                  </div>
                  <ul className="text-[10px] font-medium text-slate-600 space-y-1 text-left border-t border-amber-100 pt-2">
                    <li className="flex items-center gap-1"><span className="text-amber-500 font-bold">•</span> Normal Entry</li>
                    <li className="flex items-center gap-1"><span className="text-amber-500 font-bold">•</span> Free Seating</li>
                  </ul>
                </div>
                <button onClick={() => setBooking({ tierId: "general" })} className="mt-3 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-[11px] py-1.5 rounded-xl shadow-xs active:scale-95 transition-transform flex items-center justify-center gap-1">
                  <i className="fa-solid fa-bolt text-[10px]" /> Book Now
                </button>
              </div>

              <div className="min-w-[125px] flex-1 bg-gradient-to-b from-sky-50/70 to-white rounded-2xl p-3 border border-sky-200 shadow-xs flex flex-col justify-between text-center relative">
                <div>
                  <div className="text-2xl mb-1 text-sky-500"><i className="fa-solid fa-star" /></div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Premium</h4>
                  <span className="inline-block mt-1 bg-sky-100 text-sky-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate B
                  </span>
                  <div className="my-2.5">
                    <span className="text-lg font-black text-slate-900">₹100</span>
                  </div>
                  <ul className="text-[10px] font-medium text-slate-600 space-y-1 text-left border-t border-sky-100 pt-2">
                    <li className="flex items-center gap-1"><span className="text-sky-500 font-bold">•</span> Fast Entry</li>
                    <li className="flex items-center gap-1"><span className="text-sky-500 font-bold">•</span> Better View</li>
                  </ul>
                </div>
                <button onClick={() => setBooking({ tierId: "premium" })} className="mt-3 w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-[11px] py-1.5 rounded-xl shadow-xs active:scale-95 transition-transform flex items-center justify-center gap-1">
                  <i className="fa-solid fa-bolt text-[10px]" /> Book Now
                </button>
              </div>

              <div className="min-w-[125px] flex-1 bg-gradient-to-b from-purple-50 to-white rounded-2xl p-3 border-2 border-purple-400 shadow-md flex flex-col justify-between text-center relative overflow-hidden">
                <div className="absolute top-2 -right-6 bg-red-500 text-white text-[8px] font-extrabold uppercase py-0.5 px-6 rotate-45 shadow-sm">
                  Popular
                </div>

                <div>
                  <div className="text-2xl mb-1 text-amber-500"><i className="fa-solid fa-crown" /></div>
                  <h4 className="text-xs font-black text-purple-950 uppercase tracking-tight">VIP</h4>
                  <span className="inline-block mt-1 bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate C
                  </span>
                  <div className="my-2.5">
                    <span className="text-lg font-black text-purple-900">₹200</span>
                  </div>
                  <ul className="text-[10px] font-medium text-slate-600 space-y-1 text-left border-t border-purple-100 pt-2">
                    <li className="flex items-center gap-1"><span className="text-purple-600 font-bold">•</span> Priority Entry</li>
                    <li className="flex items-center gap-1"><span className="text-purple-600 font-bold">•</span> Best View Zone</li>
                  </ul>
                </div>
                <button onClick={() => setBooking({ tierId: "vip" })} className="mt-3 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-[11px] py-1.5 rounded-xl shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1">
                  <i className="fa-solid fa-bolt text-[10px]" /> Book Now
                </button>
              </div>

              <div className="min-w-[125px] flex-1 bg-[#161a29] text-white rounded-2xl p-3 border border-amber-400/50 shadow-md flex flex-col justify-between text-center relative">
                <div>
                  <div className="text-2xl mb-1 text-amber-400"><i className="fa-solid fa-crown" /></div>
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-tight">VVIP</h4>
                  <span className="inline-block mt-1 bg-amber-400/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-400/30">
                    <i className="fa-solid fa-location-dot text-[8px]" /> Gate D
                  </span>
                  <div className="my-2.5">
                    <span className="text-lg font-black text-white">₹500</span>
                  </div>
                  <ul className="text-[10px] font-medium text-slate-300 space-y-1 text-left border-t border-slate-700 pt-2">
                    <li className="flex items-center gap-1"><span className="text-amber-400 font-bold">•</span> Exclusive Entry</li>
                    <li className="flex items-center gap-1"><span className="text-amber-400 font-bold">•</span> Special Sitting</li>
                  </ul>
                </div>
                <button onClick={() => setBooking({ tierId: "vvip" })} className="mt-3 w-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[11px] py-1.5 rounded-xl shadow-xs active:scale-95 transition-transform flex items-center justify-center gap-1">
                  <i className="fa-solid fa-bolt text-[10px]" /> Book Now
                </button>
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
          10. FIXED BOTTOM NAVIGATION BAR
        ============================================== */}
        <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200/80 px-4 py-2 flex items-center justify-between z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <a href="#" className="flex flex-col items-center flex-1 text-indigo-600 relative group">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5">
              <i className="fa-solid fa-house" />
            </div>
            <span className="text-[10px] font-bold">Home</span>
            <span className="w-6 h-1 bg-indigo-600 rounded-full mt-0.5" />
          </a>

          <Link href="/tickets" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5">
              <i className="fa-solid fa-ticket-simple" />
            </div>
            <span className="text-[10px] font-medium">My Tickets</span>
          </Link>

          <a href="#" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5">
              <i className="fa-regular fa-calendar-days" />
            </div>
            <span className="text-[10px] font-medium">Events</span>
          </a>

          <a href="#" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5">
              <i className="fa-solid fa-headset" />
            </div>
            <span className="text-[10px] font-medium">Support</span>
          </a>

          <a href="#" className="flex flex-col items-center flex-1 text-slate-400 hover:text-slate-700 transition-colors">
            <div className="w-6 h-6 flex items-center justify-center text-lg mb-0.5">
              <i className="fa-regular fa-circle-user" />
            </div>
            <span className="text-[10px] font-medium">Profile</span>
          </a>
        </nav>
      </div>

      {booking && (
        <BookTicketsModal
          initialTierId={booking.tierId}
          onClose={() => setBooking(null)}
          onProceed={() => setBooking(null)}
        />
      )}
    </div>
  );
}

function HeroCarousel() {
  const slides = [
    {
      img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
      kicker: "Adim",
      title: "LAHAH MANDAWA",
      sub: "Opera Entry Ticket",
      badge: ["Cultural", "Heritage of", "Odisha"],
      ctaTop: "Book Your Ticket Online",
      ctaBottom: "Skip the Queue • Enjoy the Show",
    },
    {
      img: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&auto=format&fit=crop&q=80",
      kicker: "Live",
      title: "OPERA NIGHT",
      sub: "Traditional Cultural Show",
      badge: ["Night", "Cultural", "Show"],
      ctaTop: "Grand Cultural Night",
      ctaBottom: "Traditional Odia Opera",
    },
    {
      img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&auto=format&fit=crop&q=80",
      kicker: "Book",
      title: "ONLINE TICKETS",
      sub: "Instant Digital QR Ticket",
      badge: ["Instant", "Booking", "2026"],
      ctaTop: "Instant Digital QR Ticket",
      ctaBottom: "Easy • Fast • Secure",
    },
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-blue-950 via-indigo-950 to-purple-950 text-white border border-indigo-900/50">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={i} className="w-full flex-shrink-0 relative min-h-[180px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.img}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            <div className="relative z-10 p-4 pt-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-serif italic text-amber-300 text-xl font-bold tracking-wide drop-shadow">{slide.kicker}</span>
                  <h2 className="text-2xl font-black tracking-tight text-yellow-400 drop-shadow-md font-brand uppercase leading-none mt-0.5">
                    {slide.title}
                  </h2>
                  <p className="text-sm font-bold text-white tracking-wide mt-1 drop-shadow">{slide.sub}</p>
                </div>

                <div className="bg-gradient-to-b from-amber-500/90 to-amber-700/90 backdrop-blur-sm border border-amber-300/40 rounded-xl px-2.5 py-1.5 text-center shadow-lg">
                  <i className="fa-solid fa-award text-amber-200 text-xs block mb-0.5" />
                  <span className="text-[9px] uppercase font-black leading-tight text-white block tracking-tighter">
                    {slide.badge.map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex items-end justify-between">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-semibold text-yellow-300">{slide.ctaTop}</p>
                  <p className="text-[11px] font-normal text-slate-200">{slide.ctaBottom}</p>
                </div>

                <div className="flex items-center gap-1.5 pb-1">
                  {slides.map((_, si) => (
                    <button
                      key={si}
                      aria-label={`Go to slide ${si + 1}`}
                      onClick={() => setIndex(si)}
                      className={`${si === index ? "w-2 h-2 rounded-full bg-white" : "w-1.5 h-1.5 rounded-full bg-white/50"} transition-all`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}