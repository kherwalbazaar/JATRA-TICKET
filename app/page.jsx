"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BookTicketsModal from "./components/BookTicketsModal";
import BottomNav from "./components/BottomNav";
import Header from "./components/Header";
import BannerImage from "./components/BannerImage";
import { saveBooking, subscribeBookings } from "../lib/bookings";
import { subscribeEvents, getEventExpiryInfo, isLogoUrl } from "../lib/events";
import { subscribeBanners } from "../lib/banners";
import { subscribeTicketTypes } from "../lib/ticketTypes";
import { subscribeParties, DEFAULT_PARTIES } from "../lib/parties";
import { getSavedCustomerProfile } from "../lib/supabase";
import LoginRequiredModal from "./components/LoginRequiredModal";

const DEFAULT_TIERS = [
  { id: "star", name: "STAR", price: 200, rows: ["A", "B", "C", "D", "E"], badgeText: "Exclusive" },
  { id: "vip", name: "VIP", price: 150, rows: ["F", "G", "H", "I", "J", "K"], badgeText: "Popular" },
  { id: "special", name: "SPECIAL", price: 100, rows: ["L", "M", "N", "O", "P", "Q", "R"] },
  { id: "3rd-class", name: "3RD CLASS", price: 80, rows: ["S", "T", "U", "V", "W", "X", "Y", "Z"] },
  { id: "standing", name: "STANDING", price: 50, blocks: ["Standing"] },
];

function getTierTheme(tierName = "", index = 0) {
  const n = String(tierName || "").trim().toUpperCase();
  if (n.includes("STAR")) {
    return {
      headerBg: "bg-gradient-to-r from-[#161a29] via-[#1f2437] to-[#0f1424]",
      titleColor: "text-amber-400",
      circleBg: "bg-gradient-to-b from-[#d4a017] to-[#8a6500]",
      barBg: "bg-gradient-to-r from-[#b8860b] to-[#e6b800]",
      buttonBg: "bg-gradient-to-r from-[#d4a017] to-[#b8860b]",
      badge: "Exclusive",
      badgeColor: "bg-amber-500",
    };
  }
  if (n.includes("VIP")) {
    return {
      headerBg: "bg-gradient-to-r from-[#702bf9] via-[#5b24e6] to-[#3a1eb8]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#8033ff] to-[#3a1eb8]",
      barBg: "bg-gradient-to-r from-[#702bf9] to-[#3a1eb8]",
      buttonBg: "bg-gradient-to-r from-[#702bf9] to-[#5b24e6]",
      badge: "Popular",
      badgeColor: "bg-red-500",
    };
  }
  if (n.includes("SPECIAL")) {
    return {
      headerBg: "bg-gradient-to-r from-[#00c978] via-[#00a6c9] to-[#0077ff]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#00c978] to-[#0077ff]",
      barBg: "bg-gradient-to-r from-[#00c978] to-[#0077ff]",
      buttonBg: "bg-gradient-to-r from-[#00c978] to-[#009fd9]",
      badge: null,
      badgeColor: "bg-emerald-500",
    };
  }
  if (n.includes("3RD") || n.includes("THIRD") || n.includes("CHAIR")) {
    return {
      headerBg: "bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#1e40af]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8]",
      barBg: "bg-gradient-to-r from-[#2563eb] to-[#1e40af]",
      buttonBg: "bg-gradient-to-r from-[#3b82f6] to-[#2563eb]",
      badge: null,
      badgeColor: "bg-blue-500",
    };
  }
  if (n.includes("STAND")) {
    return {
      headerBg: "bg-gradient-to-r from-[#ff5500] via-[#ff7700] to-[#ffaa00]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#ff8c00] to-[#ff4900]",
      barBg: "bg-gradient-to-r from-[#ff5500] to-[#ffaa00]",
      buttonBg: "bg-gradient-to-r from-[#ff5500] to-[#ff8c00]",
      badge: null,
      badgeColor: "bg-orange-500",
    };
  }
  const fallbacks = [
    {
      headerBg: "bg-gradient-to-r from-[#161a29] via-[#1f2437] to-[#0f1424]",
      titleColor: "text-amber-400",
      circleBg: "bg-gradient-to-b from-[#d4a017] to-[#8a6500]",
      barBg: "bg-gradient-to-r from-[#b8860b] to-[#e6b800]",
      buttonBg: "bg-gradient-to-r from-[#d4a017] to-[#b8860b]",
      badge: null,
      badgeColor: "bg-amber-500",
    },
    {
      headerBg: "bg-gradient-to-r from-[#702bf9] via-[#5b24e6] to-[#3a1eb8]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#8033ff] to-[#3a1eb8]",
      barBg: "bg-gradient-to-r from-[#702bf9] to-[#3a1eb8]",
      buttonBg: "bg-gradient-to-r from-[#702bf9] to-[#5b24e6]",
      badge: null,
      badgeColor: "bg-red-500",
    },
    {
      headerBg: "bg-gradient-to-r from-[#00c978] via-[#00a6c9] to-[#0077ff]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#00c978] to-[#0077ff]",
      barBg: "bg-gradient-to-r from-[#00c978] to-[#0077ff]",
      buttonBg: "bg-gradient-to-r from-[#00c978] to-[#009fd9]",
      badge: null,
      badgeColor: "bg-emerald-500",
    },
    {
      headerBg: "bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#1e40af]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8]",
      barBg: "bg-gradient-to-r from-[#2563eb] to-[#1e40af]",
      buttonBg: "bg-gradient-to-r from-[#3b82f6] to-[#2563eb]",
      badge: null,
      badgeColor: "bg-blue-500",
    },
    {
      headerBg: "bg-gradient-to-r from-[#ff5500] via-[#ff7700] to-[#ffaa00]",
      titleColor: "text-white",
      circleBg: "bg-gradient-to-b from-[#ff8c00] to-[#ff4900]",
      barBg: "bg-gradient-to-r from-[#ff5500] to-[#ffaa00]",
      buttonBg: "bg-gradient-to-r from-[#ff5500] to-[#ff8c00]",
      badge: null,
      badgeColor: "bg-orange-500",
    },
  ];
  return fallbacks[index % fallbacks.length];
}

function getTierPerks(tier) {
  if (Array.isArray(tier.perks) && tier.perks.length > 0) {
    return tier.perks.map((p) => (typeof p === "string" ? { text: p, included: true } : p));
  }
  const n = String(tier.name || "").trim().toUpperCase();
  if (n.includes("STAR")) {
    return [
      { text: "Exclusive Entry", included: true },
      { text: "Special Sitting", included: true },
      { text: "Priority Entry", included: true },
      { text: "Best View Zone", included: true },
    ];
  }
  if (n.includes("VIP")) {
    return [
      { text: "Priority Entry", included: true },
      { text: "Best View Zone", included: true },
      { text: "Reserved Seating", included: true },
      { text: "Exclusive Lounge", included: false },
    ];
  }
  if (n.includes("SPECIAL")) {
    return [
      { text: "Fast Entry", included: true },
      { text: "Better View", included: true },
      { text: "Covered Seating", included: true },
      { text: "Priority Entry", included: false },
    ];
  }
  if (n.includes("3RD") || n.includes("THIRD") || n.includes("CHAIR")) {
    return [
      { text: "Standard Entry", included: true },
      { text: "Chair Seating", included: true },
      { text: "Clear Stage View", included: true },
      { text: "Fast Track Entry", included: false },
    ];
  }
  if (n.includes("STAND")) {
    return [
      { text: "Normal Entry", included: true },
      { text: "Free Seating", included: true },
      { text: "Fast Track Entry", included: false },
      { text: "Best View Zone", included: false },
    ];
  }
  return [
    { text: "Normal Entry", included: true },
    { text: "Standard Seating", included: true },
    { text: "Stage View", included: true },
    { text: "Fast Track Entry", included: false },
  ];
}

export default function Home() {
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  // The pricing cards are static, but a booking must always carry the real
  // `bookings.eventId` or the admin panel / gate scanner cannot match it.
  const [featuredEvent, setFeaturedEvent] = useState(null);
  const [allEventsList, setAllEventsList] = useState([]);
  // Tier prices are authored in JATRA BAZAAR ADMIN (`ticketTypes`); the
  // static numbers below are only the fallback when nothing is stored yet.
  const [ticketTypes, setTicketTypes] = useState([]);
  const [countdown, setCountdown] = useState({ d: "00", h: "00", m: "00", s: "00" });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginTargetUrl, setLoginTargetUrl] = useState("");

  const featuredExpiryInfo = useMemo(() => {
    return getEventExpiryInfo(featuredEvent);
  }, [featuredEvent]);

  const handleBookTicketNow = (e, tierId = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (featuredExpiryInfo.isExpired) {
      alert(`This event is expired on date ${featuredExpiryInfo.formattedDate}. Ticket booking is closed.`);
      return;
    }
    const eventId = featuredEvent?.key || featuredEvent?.id || "";
    const eventName = featuredEvent?.eventTitle || featuredEvent?.name || "Event";
    const date = featuredEvent?.date || "";
    const time = featuredEvent?.time || "";

    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (eventName) params.set("event", eventName);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    params.set("block", "B1");

    // Direct guest navigation: allows viewing all seat rows and auditorium layout freely
    const seatsUrl = `/seats?${params.toString()}`;
    router.push(seatsUrl);
  };

  const displayTiers = useMemo(() => {
    const rawList = Array.isArray(ticketTypes) && ticketTypes.length > 0 ? ticketTypes : DEFAULT_TIERS;
    // Show highest amount ticket first as requested
    return [...rawList].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }, [ticketTypes]);

  useEffect(() => {
    try {
      const eventId = featuredEvent?.key || featuredEvent?.id || "";
      if (!eventId) return () => {};
      // Scope tiers to the featured (upcoming) show so past events' pricing
      // never leaks into these cards.
      const unsub = subscribeTicketTypes((list) => {
        setTicketTypes(Array.isArray(list) ? list : []);
      }, eventId);
      return () => unsub();
    } catch {
      return () => {};
    }
  }, [featuredEvent?.key, featuredEvent?.id]);

  const priceFor = (tierName, fallback) => {
    const match = displayTiers.find(
      (t) => String(t.name || "").trim().toUpperCase() === String(tierName || "").trim().toUpperCase(),
    );
    const price = Number(match?.price);
    return price > 0 ? price : fallback;
  };

  const [bookingsList, setBookingsList] = useState([]);
  const [parties, setParties] = useState(DEFAULT_PARTIES);

  useEffect(() => {
    try {
      const unsub = subscribeBookings((list) => {
        if (Array.isArray(list)) setBookingsList(list);
      });
      return () => unsub();
    } catch {
      return () => {};
    }
  }, []);

  useEffect(() => {
    try {
      const unsub = subscribeParties((list) => {
        if (Array.isArray(list) && list.length > 0) setParties(list);
      });
      return () => unsub();
    } catch {
      return () => {};
    }
  }, []);

  const activeEventId = featuredEvent?.key || featuredEvent?.id || "";

  const eventBookings = useMemo(() => {
    if (!activeEventId) return bookingsList;
    const matching = bookingsList.filter(
      (b) => String(b.eventId || b.showId || "") === String(activeEventId)
    );
    return matching.length > 0 ? matching : bookingsList;
  }, [bookingsList, activeEventId]);

  const realTicketsSold = useMemo(() => {
    const fromBookings = eventBookings.reduce(
      (sum, b) => sum + (Number(b.quantity || b.seatCount) || 1),
      0
    );
    const adminSold = Number(featuredEvent?.ticketsSold) || 0;
    return Math.max(fromBookings, adminSold);
  }, [eventBookings, featuredEvent?.ticketsSold]);

  const totalCapacity = useMemo(() => {
    const adminCap = Number(featuredEvent?.totalCapacity) || 0;
    if (adminCap > 0) return adminCap;
    const quotaCap = (ticketTypes || []).reduce(
      (sum, t) => sum + (Number(t.totalQuota) || 0),
      0
    );
    return quotaCap > 0 ? quotaCap : 2250;
  }, [featuredEvent?.totalCapacity, ticketTypes]);

  const remainingTickets = useMemo(() => {
    return Math.max(0, totalCapacity - realTicketsSold);
  }, [totalCapacity, realTicketsSold]);

  const happyVisitors = useMemo(() => {
    const adminVisitors = Number(featuredEvent?.happyVisitors || featuredEvent?.visitors) || 0;
    if (adminVisitors > 0) return adminVisitors;

    const checkedIn = eventBookings.reduce(
      (sum, b) => sum + (Number(b.enteredCount) || 0),
      0
    );
    if (checkedIn > 0) return checkedIn;

    const uniqueCustomers = new Set(
      eventBookings.map((b) => b.customerPhone || b.customerName).filter(Boolean)
    );
    return uniqueCustomers.size > 0 ? uniqueCustomers.size : realTicketsSold;
  }, [eventBookings, featuredEvent, realTicketsSold]);

  const recentAvatars = useMemo(() => {
    const list = [];
    const colors = [
      "bg-gradient-to-tr from-rose-500 to-pink-500",
      "bg-gradient-to-tr from-indigo-500 to-purple-500",
      "bg-gradient-to-tr from-amber-500 to-orange-500",
      "bg-gradient-to-tr from-emerald-500 to-teal-500",
      "bg-gradient-to-tr from-sky-500 to-blue-500",
    ];
    eventBookings.forEach((b, i) => {
      const name = String(b.customerName || "").trim();
      if (!name) return;
      const initials = name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "J";
      if (!list.some((a) => a.name === name)) {
        list.push({
          name,
          initials,
          color: colors[i % colors.length],
        });
      }
    });
    if (list.length === 0) {
      list.push(
        { name: "Balakram Tudu", initials: "BT", color: colors[0] },
        { name: "Lucky Babu", initials: "LB", color: colors[1] },
        { name: "Guest User", initials: "GU", color: colors[2] },
      );
    }
    return list.slice(0, 3);
  }, [eventBookings]);

  const socialProofText = useMemo(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const past24Hours = now - 24 * 60 * 60 * 1000;

    const countLastHour = eventBookings
      .filter((b) => {
        const t = new Date(b.createdAt || b.date || 0).getTime();
        return !isNaN(t) && t >= oneHourAgo;
      })
      .reduce((sum, b) => sum + (Number(b.quantity || b.seatCount) || 1), 0);

    if (countLastHour > 0) {
      return {
        highlight: `${countLastHour}+ people booked`,
        suffix: "in last 1 hour",
      };
    }

    const countLast24 = eventBookings
      .filter((b) => {
        const t = new Date(b.createdAt || b.date || 0).getTime();
        return !isNaN(t) && t >= past24Hours;
      })
      .reduce((sum, b) => sum + (Number(b.quantity || b.seatCount) || 1), 0);

    if (countLast24 > 0) {
      return {
        highlight: `${countLast24}+ people booked`,
        suffix: "recently",
      };
    }

    if (realTicketsSold > 0) {
      return {
        highlight: `${realTicketsSold}+ tickets booked`,
        suffix: "so far",
      };
    }

    return {
      highlight: "Live booking",
      suffix: "open right now",
    };
  }, [eventBookings, realTicketsSold]);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((data) => {
        if (Array.isArray(data)) {
          setAllEventsList(data);
          if (data.length > 0) {
            // List is sorted ascending; feature the next bookable show rather
            // than the oldest (possibly already completed) one.
            const nextUpcoming = data.find((ev) => !getEventExpiryInfo(ev).isExpired);
            setFeaturedEvent(nextUpcoming || data[data.length - 1]);
          }
        }
      });
      return () => unsub();
    } catch {
      return () => {};
    }
  }, []);

  useEffect(() => {
    if (!featuredEvent) return;

    const MONTH_MAP = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };

    const buildTarget = () => {
      const pad = (n) => String(n).padStart(2, "0");
      let y, m, d;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(featuredEvent.date || ""))) {
        const parts = String(featuredEvent.date).split("-");
        y = Number(parts[0]);
        m = Number(parts[1]) - 1;
        d = Number(parts[2]);
      } else {
        y = Number(featuredEvent.year) || new Date().getFullYear();
        m = MONTH_MAP[String(featuredEvent.month || "").toUpperCase()] ?? 9;
        d = Number(featuredEvent.day) || 1;
      }

      const timeStr = String(
        featuredEvent.startTime || featuredEvent.start_time || featuredEvent.time || "11:00 PM",
      );
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      let hours = 23;
      let minutes = 0;
      if (timeMatch) {
        hours = Number(timeMatch[1]) % 12;
        if (/pm/i.test(timeMatch[3])) hours += 12;
        minutes = Number(timeMatch[2]);
      }
      return new Date(y, m, d, hours, minutes, 0, 0);
    };

    const tick = () => {
      const TARGET = buildTarget();
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
  }, [featuredEvent]);

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
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
              {displayTiers.map((tier, idx) => {
                const theme = getTierTheme(tier.name, idx);
                const perks = getTierPerks(tier);
                const badge = tier.badgeText || theme.badge;
                const badgeColor = theme.badgeColor || "bg-red-500";
                const tierId = String(tier.name || tier.id || "").toLowerCase().replace(/\s+/g, "-");

                return (
                  <div
                    key={tier.id || tier.key || idx}
                    className="min-w-[130px] flex-1 bg-white rounded-[16px] shadow-lg overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 relative"
                  >
                    {badge && (
                      <div className={`absolute top-2 -right-6 ${badgeColor} text-white text-[7px] font-extrabold uppercase py-0.5 px-5 rotate-45 shadow-sm z-30`}>
                        {badge}
                      </div>
                    )}

                    <div className={`relative ${theme.headerBg} h-16 pt-3 text-center overflow-hidden`}>
                      <div className="absolute inset-0 pattern-dots opacity-80 pointer-events-none" />
                      <h4 className={`relative z-10 text-sm font-black ${theme.titleColor} tracking-wider font-brand uppercase drop-shadow-sm`}>
                        {tier.name}
                      </h4>
                    </div>

                    <div className="relative -mt-5 flex justify-center z-20">
                      <div className="relative z-10 w-12 h-12 rounded-full p-1 bg-white shadow-lg flex items-center justify-center">
                        <div className={`w-full h-full rounded-full ${theme.circleBg} shadow-[inset_0_3px_6px_rgba(0,0,0,0.35)] flex items-center justify-center text-white`}>
                          <span className="text-lg font-black font-brand tracking-tight drop-shadow">
                            {tier.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="px-2 pt-2 pb-1 flex-1">
                      <ul className="space-y-1 text-[8px] leading-tight text-slate-500 font-medium">
                        {perks.map((p, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <i className={`fa-solid ${p.included ? "fa-check text-emerald-500" : "fa-xmark text-slate-400"} text-[9px] mt-0.5`} />
                            <span className={p.included ? "text-slate-600 font-semibold" : "text-slate-400"}>{p.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={`h-1 w-full ${theme.barBg}`} />

                    <div className="bg-[#242426] p-1.5 flex items-center justify-center">
                      <button
                        onClick={(e) => handleBookTicketNow(e, tierId)}
                        className={`w-20 py-1 px-2 rounded-full ${theme.buttonBg} text-white font-extrabold text-[9px] uppercase tracking-wider font-brand shadow-md active:scale-95 transition-transform hover:brightness-110 whitespace-nowrap cursor-pointer border-0`}
                      >
                        <i className="fa-solid fa-bolt text-[7px] mr-0.5" /> Book Now
                      </button>
                    </div>
                  </div>
                );
              })}
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
                <i className="fa-solid fa-circle-play text-[10px]" /> How it Works? <i className="fa-solid fa-angle-right text-[9px]" />
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
                  <i className="fa-solid fa-clock" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Book<br />Anytime</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center text-lg mb-1.5 border border-indigo-200/50">
                  <i className="fa-solid fa-person-running" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">Skip the<br />Queue</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center text-lg mb-1.5 border border-emerald-200/50">
                  <i className="fa-solid fa-shield-halved" />
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
                <p className="text-base font-black tracking-tight text-white leading-tight">
                  {realTicketsSold.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-slate-700" />

            <div className="flex items-center gap-2">
              <div className="text-sky-400 text-xl"><i className="fa-solid fa-users" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold leading-tight">Happy Visitors</p>
                <p className="text-base font-black tracking-tight text-white leading-tight">
                  {happyVisitors.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-slate-700" />

            <div className="flex items-center gap-2">
              <div className="text-rose-500 text-xl">🔥</div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold leading-tight">Limited Tickets</p>
                <p className="text-sm font-black tracking-tight text-amber-400 leading-tight">
                  {remainingTickets > 0 ? `${remainingTickets.toLocaleString()} Left` : "Hurry Up!"}
                </p>
              </div>
            </div>
          </div>

          {/* ==============================================
            8. SOCIAL PROOF BANNER
          ============================================== */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 overflow-hidden">
                {recentAvatars.map((av, idx) => (
                  <div
                    key={idx}
                    title={av.name}
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white text-[9px] font-black text-white shadow-xs ${av.color}`}
                  >
                    {av.initials}
                  </div>
                ))}
              </div>
              <span className="text-[11px] font-semibold text-slate-800">
                <strong className="font-black text-slate-900">{socialProofText.highlight}</strong> {socialProofText.suffix}
              </span>
            </div>

            <button
              onClick={(e) => handleBookTicketNow(e)}
              className="text-[11px] font-extrabold text-rose-600 flex items-center gap-1 hover:underline whitespace-nowrap bg-transparent border-0 p-0 cursor-pointer"
            >
              🔥 Book Now Before It's Full! <i className="fa-solid fa-angle-right text-[10px]" />
            </button>
          </div>

          {/* ==============================================
            8.5. OPERA PARTIES (HORIZONTAL CARD SCROLL)
          ============================================== */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🎭</span>
                <h3 className="text-sm font-black text-slate-900 font-brand">Opera Parties</h3>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-black px-1.5 py-0.5 rounded-full border border-indigo-100">
                  {parties.length}
                </span>
              </div>
              <Link
                href="/parties"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 active:scale-95 transition-transform"
              >
                View All <i className="fa-solid fa-arrow-right text-[9px]" />
              </Link>
            </div>

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {parties.map((party) => {
                return (
                  <Link
                    key={party.id || party.name}
                    href={`/parties/${encodeURIComponent(party.id)}`}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(`party_${party.id}`, JSON.stringify(party));
                      } catch {}
                    }}
                    className="flex-shrink-0 w-28 flex flex-col items-center bg-slate-50/80 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200/80 rounded-xl p-2 transition-all text-center group active:scale-95"
                  >
                    <div className="w-full aspect-[5/3] rounded-lg overflow-hidden bg-white shadow-xs border border-slate-200/80 flex items-center justify-center mb-1.5 relative group-hover:scale-105 transition-transform">
                      {party.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={party.logo}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        aria-hidden="true"
                        className={`w-full h-full ${party.logo ? "hidden" : "flex"} items-center justify-center bg-gradient-to-tr ${party.color || "from-indigo-600 to-purple-600"} text-white font-black text-xs uppercase select-none`}
                      >
                        {party.name.slice(0, 2)}
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {party.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ==============================================
            9. PRIMARY CALL TO ACTION BUTTON
          ============================================== */}
          {featuredExpiryInfo.isExpired ? (
            <div className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 text-rose-600 font-black text-xs uppercase tracking-wide">
                <i className="fa-solid fa-ban" />
                <span>Booking Closed</span>
              </div>
              <p className="text-xs font-black text-slate-800">
                This event is expired on date {featuredExpiryInfo.formattedDate}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Online bookings are closed for past shows.
              </p>
            </div>
          ) : (
            <button
              onClick={(e) => handleBookTicketNow(e)}
              className="btn-book-ticket-glow w-full bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white font-black text-base py-3.5 px-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer border-0 select-none hover:brightness-110"
            >
              <i className="fa-solid fa-ticket ticket-icon-wiggle text-xl" />
              <span className="tracking-wide uppercase text-sm sm:text-base font-black drop-shadow-sm">Book Ticket Now</span>
              <i className="fa-solid fa-angles-right text-xs ml-0.5 animate-pulse" />
            </button>
          )}
        </main>

        {/* ==============================================
          10. FIXED BOTTOM NAVIGATION BAR (animated)
        ============================================== */}
        {/* Login Required Modal */}
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          redirectUrl={loginTargetUrl}
          title="Login First to Book Tickets"
          message="You can freely browse events, parties, and view seat layouts. However, you must log in to your account before you can book tickets."
        />

        <BottomNav active="home" />
      </div>

      {booking && (
        <BookTicketsModal
          initialTierId={booking.tierId}
          onClose={() => setBooking(null)}
          onProceed={async (data) => {
            try {
              await saveBooking({
                ...data,
                eventId: featuredEvent?.key || featuredEvent?.id || "",
                eventName:
                  featuredEvent?.eventTitle ||
                  featuredEvent?.name ||
                  data.eventName ||
                  "",
                date: featuredEvent?.date || "",
                time: featuredEvent?.time || "",
              });
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
  const monthMap = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

  const [allShows, setAllShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((data) => {
        if (data && data.length > 0) {
          const shows = data.map((ev) => {
            const eventKey = ev.key || ev.id || "";
            const eventTitle = ev.eventTitle || ev.name || "Jatra Show";
            const storyTitle = ev.title && ev.title !== eventTitle ? ev.title : "";
            const partyName = ev.partyName || ev.organizer || "";
            const organizationName = ev.organizationName || ev.committeeName || "";
            const location = ev.location || ev.venue || ev.address || "Mayurbhanj, Odisha";
            const banner = ev.banner || (ev.banners && ev.banners[0]) || (!isLogoUrl(ev.poster) ? ev.poster : null) || ev.img || "https://ik.imagekit.io/kherwalbazaar/MANDAWA/JARPA%202026.jpg?updatedAt=1789577829940";
            const time = ev.time || ev.startTime || ev.entryTime || "11:00 PM";

            return {
              ...ev,
              key: eventKey,
              id: eventKey,
              name: eventTitle,
              eventTitle,
              storyTitle,
              title: ev.title || eventTitle,
              partyName,
              organizationName,
              month: ev.month || "OCT",
              day: ev.day || ev.dayOfMonth || "22",
              year: ev.year || "2026",
              location,
              banner,
              time,
            };
          });
          setAllShows(shows);
        } else {
          setAllShows([]);
        }
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.error("Failed to load shows:", err);
      setAllShows([]);
      setLoading(false);
      return () => {};
    }
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseShowDate = (show) => new Date(Number(show.year), monthMap[show.month], Number(show.day));

  // Show all shows instead of filtering by date
  const displayShows = [...allShows].sort((a, b) => parseShowDate(a) - parseShowDate(b));
  const title = "All Shows";

  if (loading) return null;
  if (displayShows.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🎭</span>
          <h3 className="text-base font-black text-slate-900 font-brand tracking-tight">{title}</h3>
        </div>
        <Link href="/todays-show" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
          View All <i className="fa-solid fa-arrow-right text-[10px]" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {displayShows.map((show) => {
          const expiryInfo = getEventExpiryInfo(show);
          return (
            <div
              key={show.key}
              onClick={() => {
                try {
                  sessionStorage.setItem(`event_${show.key}`, JSON.stringify(show));
                } catch {}
                window.location.href = `/event-details?id=${encodeURIComponent(show.key)}`;
              }}
              className="min-w-[260px] flex-shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden active:scale-95 transition-transform cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <BannerImage
                src={show.banner}
                alt={show.organizationName || show.name}
                className="w-full h-32 object-cover"
              />
              <div className="p-2.5">
                <h4 className="text-xs font-black text-slate-900 font-brand truncate">{show.organizationName || show.name}</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold mt-1">
                  <i className="fa-solid fa-user-group text-indigo-500 text-[9px] flex-shrink-0" />
                  <span className="truncate">{show.partyName || "Party TBD"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold mt-1">
                  <i className="fa-solid fa-location-dot text-rose-500 text-[9px] flex-shrink-0" />
                  <span className="truncate">{show.location}</span>
                </div>
                <div className="flex items-center justify-between gap-1.5 text-[10px] mt-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <i className="fa-regular fa-calendar text-emerald-600 text-[9px] flex-shrink-0" />
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200/80 whitespace-nowrap">
                      {show.month} {show.day}, {show.year}
                    </span>
                  </div>
                  {expiryInfo.isExpired && (
                    <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                      <i className="fa-solid fa-ban text-[8px]" />
                      Expired
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroCarousel() {
  const [allSlides, setAllSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((data) => {
        if (data && data.length > 0) {
          const slides = data
            .map((ev) => {
              const eventKey = ev.key || ev.id || "";
              const img = ev.banner || (ev.banners && ev.banners[0]) || (!isLogoUrl(ev.poster) ? ev.poster : null) || ev.img || "";
              return {
                ...ev,
                key: eventKey,
                id: eventKey,
                img,
                month: ev.month || "OCT",
                day: ev.day || ev.dayOfMonth || "22",
                year: ev.year || "2026",
                name: ev.eventTitle || ev.name || "",
              };
            })
            .filter((s) => Boolean(s.img));
          setAllSlides(slides);
        } else {
          setAllSlides([]);
        }
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.error("Failed to load banners:", err);
      setAllSlides([]);
      setLoading(false);
      return () => {};
    }
  }, []);

  const slides = allSlides;
  const singleSlide = slides.length === 1;

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (loading) return null;
  if (slides.length === 0) return null;

  const handleSlideClick = (slide) => {
    const eventKey = slide?.key || slide?.id;
    if (eventKey) {
      try {
        sessionStorage.setItem(`event_${eventKey}`, JSON.stringify(slide));
      } catch {}
      window.location.href = `/event-details?id=${encodeURIComponent(eventKey)}`;
    }
  };

  return (
    <div>
      <div className="relative w-full h-[200px] overflow-hidden bg-slate-900">
        {singleSlide ? (
          <div
            onClick={() => handleSlideClick(slides[0])}
            className="relative w-full h-full overflow-hidden cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <BannerImage
              src={slides[0].img}
              alt="Banner"
              className="w-full h-full object-cover single-banner-motion"
            />
          </div>
        ) : (
          <div
            className="flex transition-transform duration-700 ease-in-out h-full"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.key || i}
                onClick={() => handleSlideClick(slide)}
                className="w-full flex-shrink-0 h-full cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <BannerImage
                  src={slide.img}
                  alt={`Banner ${i + 1}`}
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>
        )}
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
        .single-banner-motion {
          animation: singleBannerSlide 8s ease-in-out infinite;
        }
        @keyframes bannerProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes singleBannerSlide {
          0% {
            transform: translateX(-100%);
          }
          15% {
            transform: translateX(0);
          }
          85% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

function EventCarousel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((data) => {
        if (data && data.length > 0) {
          const processedEvents = data.map((ev) => {
            const eventKey = ev.key || ev.id || "";
            const eventTitle = ev.eventTitle || ev.name || "Jatra Show";
            const storyTitle = ev.title && ev.title !== eventTitle ? ev.title : "";
            const partyName = ev.partyName || ev.organizer || "";
            const organizationName = ev.organizationName || ev.committeeName || "";
            const committeeLocation = ev.committeeLocation || ev.committee_location || "";
            const location = committeeLocation || ev.location || ev.venue || ev.address || "Mayurbhanj, Odisha";
            const entryTime = ev.entryTime || ev.entry_time || "9:00 PM";
            const startTime = ev.startTime || ev.start_time || ev.time || "11:00 PM";

            return {
              ...ev,
              key: eventKey,
              id: eventKey,
              name: eventTitle,
              eventTitle,
              storyTitle,
              title: ev.title || eventTitle,
              emoji: ev.emoji || "🔥",
              partyName,
              organizationName,
              committeeLocation,
              month: ev.month || "OCT",
              day: ev.day || ev.dayOfMonth || "22",
              year: ev.year || "2026",
              location,
              entryTime,
              startTime,
            };
          });
          setEvents(processedEvents);
          setIndex(0);
        } else {
          setEvents([]);
        }
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.error("Failed to load events:", err);
      setEvents([]);
      setLoading(false);
      return () => {};
    }
  }, []);

  useEffect(() => {
    if (events.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % events.length), 5000);
    return () => clearInterval(id);
  }, [events.length]);

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {events.map((ev, i) => (
            <div
              key={ev.key || ev.id || i}
              onClick={() => {
                const eventKey = ev.key || ev.id;
                if (eventKey) {
                  try {
                    sessionStorage.setItem(`event_${eventKey}`, JSON.stringify(ev));
                  } catch {}
                  window.location.href = `/event-details?id=${encodeURIComponent(eventKey)}`;
                }
              }}
              className="w-full flex-shrink-0 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 relative overflow-hidden hover:border-indigo-200 transition-colors">
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
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-base font-black text-slate-900 truncate font-brand flex items-center gap-1">
                        {ev.organizationName || ev.name || ev.partyName || "Jatra Show"} <span>{ev.emoji}</span>
                      </h3>
                      <div className="w-6" />
                    </div>

                    {ev.storyTitle && (
                      <p className="text-[10px] font-bold text-rose-600 truncate mb-1">
                        <i className="fa-solid fa-masks-theater text-[9px] mr-1" />
                        {ev.storyTitle}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-1">
                      <i className="fa-solid fa-user-group text-indigo-500 text-xs flex-shrink-0" />
                      <span className="truncate">{ev.partyName || "Party TBD"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                      <i className="fa-solid fa-location-dot text-rose-500 text-xs flex-shrink-0" />
                      <span className="truncate">{ev.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {events.length > 1 && (
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
      )}
    </div>
  );
}