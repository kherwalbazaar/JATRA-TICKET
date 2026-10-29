"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import { findParty, subscribeParties, DEFAULT_PARTIES } from "../../../lib/parties";
import { subscribeEvents, isLogoUrl } from "../../../lib/events";
import { splitPhoneNumbers } from "../../../lib/phoneNumbers";
import { getImageSource } from "../../components/BannerImage";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function showDateOf(show) {
  const year = Number(show?.year);
  const monthIndex = MONTH_LABELS.findIndex(
    (label) => label.toUpperCase() === String(show?.month || "").trim().toUpperCase()
  );
  const day = Number(show?.day);
  if (!year || monthIndex < 0 || !day) return null;
  return new Date(year, monthIndex, day);
}

function formatShowDate(show) {
  const date = showDateOf(show);
  if (!date) return "Date not available";
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function committeeAddressOf(show) {
  return (
    show?.committeeLocation ||
    show?.committee_location ||
    show?.address ||
    show?.venue ||
    show?.location ||
    show?.city ||
    ""
  );
}

export default function PartyDetail({ id }) {
  const [party, setParty] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [slotYear, setSlotYear] = useState(() => new Date().getFullYear());
  const [slotMonth, setSlotMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Instant cache / default lookup
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`party_${id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && !cancelled) setParty(parsed);
        }
      } catch {}
    }

    const defaultMatch = findParty(id);
    if (defaultMatch && !cancelled) {
      setParty((prev) => prev || defaultMatch);
    }

    // 2. Subscribe to parties updates
    const unsubParties = subscribeParties((list) => {
      if (cancelled || !Array.isArray(list)) return;
      const matched =
        list.find((p) => p && (String(p.id) === String(id) || String(p.name).trim().toUpperCase() === String(id).trim().toUpperCase())) ||
        findParty(id);
      if (matched && !cancelled) {
        setParty(matched);
        try {
          sessionStorage.setItem(`party_${id}`, JSON.stringify(matched));
        } catch {}
      }
    });

    // 3. Subscribe to events to find shows by this party
    const unsubEvents = subscribeEvents((list) => {
      if (cancelled || !Array.isArray(list)) return;
      setAllEvents(list);
    });

    return () => {
      cancelled = true;
      unsubParties();
      unsubEvents();
    };
  }, [id]);

  const pName = party?.name || (id ? decodeURIComponent(id) : "Opera Party");
  const pGenre = party?.genre || "Santali Cultural Opera";
  const pLocation = party?.location || "Mayurbhanj, Odisha";
  const pDirector = party?.director || "";
  const pWriter = party?.writer || "";
  const pColor = party?.color || "from-indigo-600 to-purple-600";
  const pPhone1 = party?.phone || "";
  const pPhone2 = party?.phone2 || "";
  const phoneNumbers = splitPhoneNumbers(pPhone1, pPhone2);

  // Filter shows belonging to this party
  const partyShows = useMemo(() => {
    if (!party || !Array.isArray(allEvents)) return [];
    const nameUpper = String(party.name || "").trim().toUpperCase();
    const shortUpper = String(party.shortName || "").trim().toUpperCase();
    const idUpper = String(party.id || "").trim().toUpperCase();

    return allEvents.filter((ev) => {
      const evParty = String(ev.partyName || ev.party_name || ev.name || ev.eventTitle || "").trim().toUpperCase();
      const evId = String(ev.partyId || "").trim().toUpperCase();
      return (
        evParty === nameUpper ||
        (shortUpper && evParty.includes(shortUpper)) ||
        evParty.includes(nameUpper) ||
        nameUpper.includes(evParty) ||
        (evId && evId === idUpper)
      );
    });
  }, [party, allEvents]);

  // Booking calendar: real month grid of this troupe's show dates
  const now = new Date();
  const currentYear = now.getFullYear();

  const monthShows = useMemo(() => {
    const map = new Map();
    partyShows.forEach((show) => {
      const date = showDateOf(show);
      if (!date || date.getFullYear() !== slotYear || date.getMonth() !== slotMonth) return;
      const day = date.getDate();
      const existing = map.get(day);
      if (existing) existing.push(show);
      else map.set(day, [show]);
    });
    return map;
  }, [partyShows, slotYear, slotMonth]);

  const yearShowCount = useMemo(
    () => partyShows.filter((show) => showDateOf(show)?.getFullYear() === slotYear).length,
    [partyShows, slotYear]
  );

  const daysInMonth = new Date(slotYear, slotMonth + 1, 0).getDate();
  const leadingDays = new Date(slotYear, slotMonth, 1).getDay();
  const daysInPrevMonth = new Date(slotYear, slotMonth, 0).getDate();
  const trailingDays = (7 - ((leadingDays + daysInMonth) % 7)) % 7;
  const todayStart = new Date(currentYear, now.getMonth(), now.getDate());
  const selectedShows = selectedDay ? monthShows.get(selectedDay) || [] : [];

  const changeMonth = (delta) => {
    const next = new Date(slotYear, slotMonth + delta, 1);
    setSlotYear(next.getFullYear());
    setSlotMonth(next.getMonth());
    setSelectedDay(null);
  };

  const toLoadableUrl = (val) => {
    const src = getImageSource(val, "");
    if (!src) return null;
    const trimmed = src.trim();
    if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
    return null;
  };

  const partyLogoUrl = toLoadableUrl(party?.logo);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: pName,
          text: `${pName} - ${pGenre} (${pLocation})`,
          url: window.location.href,
        });
      } catch {}
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-28 shadow-2xl flex flex-col overflow-hidden">
        {/* Sticky Header */}
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = "/parties";
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <i className="fa-solid fa-arrow-left text-xs" />
            </button>
            <div>
              <h2 className="text-sm font-black font-brand truncate max-w-[200px] sm:max-w-xs">{pName}</h2>
              <p className="text-[10px] text-slate-300 font-medium">Party Profile</p>
            </div>
          </div>
          <button
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs active:scale-95 transition-transform"
            aria-label="Share"
          >
            <i className="fa-solid fa-share-nodes text-xs" />
          </button>
        </div>

        {/* Hero Section */}
        <div className="relative bg-slate-900 text-white overflow-hidden">
          {partyLogoUrl ? (
            <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-slate-950 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={partyLogoUrl}
                alt={pName}
                className="w-full h-full object-cover brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            </div>
          ) : (
            <div className={`w-full aspect-[16/8] sm:aspect-[21/9] bg-gradient-to-tr ${pColor} flex items-center justify-center relative p-6 text-center`}>
              <div className="text-white/20 text-8xl font-black absolute select-none tracking-widest">
                OPERA
              </div>
            </div>
          )}

          {/* Floating Live Badge */}
          <div className="absolute top-3 right-3 z-10">
            {partyShows.length > 0 ? (
              <span className="bg-emerald-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                {partyShows.length} Live Show{partyShows.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="bg-slate-900/80 backdrop-blur-md text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-md border border-white/10">
                0 Shows - Bookings Open
              </span>
            )}
          </div>

          {/* Troupe Info Header Overlay */}
          <div className="p-4 sm:p-5 relative z-10 -mt-8 sm:-mt-12">
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-100 text-slate-900">
              <div className="flex items-start gap-3.5">
                {/* Monogram / Logo Avatar */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-indigo-100 shadow-sm flex items-center justify-center">
                  {partyLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={partyLogoUrl} alt={pName} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-tr ${pColor} text-white font-black text-xl uppercase`}>
                      {pName.slice(0, 2)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-black font-brand leading-tight text-slate-900">
                    {pName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                      {pGenre}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <i className="fa-solid fa-masks-theater text-[9px] text-indigo-500" />
                      Traditional Troupe
                    </span>
                  </div>
                  {pLocation && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mt-2">
                      <i className="fa-solid fa-location-dot text-rose-500 text-[10px] flex-shrink-0" />
                      <span className="line-clamp-1">{pLocation}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 space-y-3">
          {/* Troupe Booking Slots Calendar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black text-slate-900 font-brand uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-regular fa-calendar-check text-emerald-600 text-xs" />
                Booking Slots
              </h3>
              <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100 shrink-0">
                {yearShowCount} show{yearShowCount === 1 ? "" : "s"} in {slotYear}
              </span>
            </div>

            {/* Active month */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition-all"
              >
                <i className="fa-solid fa-chevron-left text-[10px]" />
              </button>
              <p className="text-xs font-black text-slate-900">
                {MONTH_FULL[slotMonth]} {slotYear}
              </p>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition-all"
              >
                <i className="fa-solid fa-chevron-right text-[10px]" />
              </button>
            </div>

            {/* Weekday names + dates */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {WEEKDAYS.map((weekday, index) => (
                <span
                  key={`weekday-${index}`}
                  className="text-[9px] font-bold text-slate-400 uppercase tracking-wide py-1"
                >
                  {weekday}
                </span>
              ))}

              {Array.from({ length: leadingDays }, (_, index) => (
                <span
                  key={`prev-${index}`}
                  className="aspect-square rounded-md text-[11px] font-bold flex items-center justify-center bg-slate-200 text-slate-400"
                >
                  {daysInPrevMonth - leadingDays + 1 + index}
                </span>
              ))}

              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dayShows = monthShows.get(day) || [];
                const hasShows = dayShows.length > 0;
                const isPast = new Date(slotYear, slotMonth, day) < todayStart;
                const isToday =
                  slotYear === currentYear && slotMonth === now.getMonth() && day === now.getDate();
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isPast && !hasShows}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    aria-pressed={isSelected}
                    aria-label={
                      hasShows
                        ? `${day} ${MONTH_FULL[slotMonth]} ${slotYear} - ${dayShows.length} booked event${dayShows.length > 1 ? "s" : ""}`
                        : undefined
                    }
                    title={
                      hasShows
                        ? dayShows.map((s) => s.eventTitle || s.name || "Jatra Show").join(", ")
                        : undefined
                    }
                    className={`aspect-square rounded-md text-[11px] font-bold flex flex-col items-center justify-center transition-colors ${
                      hasShows
                        ? "bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-95"
                        : isPast
                          ? "bg-rose-200 text-rose-500"
                          : "bg-emerald-200 text-emerald-900 hover:bg-emerald-300 active:scale-95"
                    } ${isSelected ? "ring-2 ring-indigo-600 ring-offset-1" : ""} ${
                      isToday && !isSelected && !hasShows ? "ring-2 ring-indigo-400 ring-inset" : ""
                    }`}
                  >
                    <span>{day}</span>
                    {hasShows && (
                      <span className="text-[7px] font-black uppercase tracking-tight leading-none mt-0.5">
                        {dayShows.length > 1 ? `${dayShows.length} Shows` : "Booked"}
                      </span>
                    )}
                  </button>
                );
              })}

              {Array.from({ length: trailingDays }, (_, index) => (
                <span
                  key={`next-${index}`}
                  className="aspect-square rounded-md text-[11px] font-bold flex items-center justify-center bg-slate-200 text-slate-400"
                >
                  {index + 1}
                </span>
              ))}
            </div>

            {selectedDay && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 space-y-2">
                {selectedShows.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-rose-600">
                        Booked on {selectedDay} {MONTH_LABELS[slotMonth]} {slotYear}
                      </p>
                      <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full shrink-0">
                        {selectedShows.length} event{selectedShows.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {selectedShows.map((show) => (
                      <div
                        key={show.key || show.id}
                        className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1.5"
                      >
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Event Name
                          </p>
                          <p className="text-xs font-black text-slate-900">
                            {show.eventTitle || show.name || "Jatra Show"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Event Date
                          </p>
                          <p className="text-[11px] font-semibold text-slate-700">
                            {formatShowDate(show)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Committee Address
                          </p>
                          <p className="text-[11px] font-semibold text-slate-700">
                            {committeeAddressOf(show) || "Address not available"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-indigo-900">
                      Enquire for {selectedDay} {MONTH_LABELS[slotMonth]} {slotYear}
                    </p>

                    {phoneNumbers[0] ? (
                      <a
                        href={`tel:${phoneNumbers[0].replace(/[^\d+]/g, "")}`}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
                      >
                        <i className="fa-solid fa-phone-volume text-[9px]" />
                        Call Troupe
                      </a>
                    ) : (
                      <span className="text-[10px] font-semibold text-indigo-700 shrink-0">
                        Contact via support
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Troupe Key Leadership & Creative Details */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            <h3 className="text-xs font-black text-slate-900 font-brand uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-users text-indigo-600 text-xs" />
              Troupe Creative &amp; Direction
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Director */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 rounded-xl p-3 border border-indigo-100/70">
                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <i className="fa-solid fa-user-tie text-indigo-600 text-[9px]" />
                  <span>Director</span>
                </div>
                <p className="text-xs sm:text-sm font-black text-slate-900 mt-1">
                  {pDirector || "Management Directed"}
                </p>
              </div>

              {/* Writer */}
              <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/50 rounded-xl p-3 border border-purple-100/70">
                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <i className="fa-solid fa-feather-pointed text-purple-600 text-[9px]" />
                  <span>Writer</span>
                </div>
                <p className="text-xs sm:text-sm font-black text-slate-900 mt-1">
                  {pWriter || "Cultural Scriptwriting"}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Numbers & Booking Action Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 font-brand uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-address-book text-indigo-600 text-xs" />
                Troupe Contact &amp; Booking
              </h3>
              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                Direct Line
              </span>
            </div>

            {phoneNumbers.length > 0 ? (
              <div className="space-y-2">
                {phoneNumbers.map((phone, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-phone text-xs" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {i === 0 ? "Primary Contact" : i === 1 ? "Secondary Contact" : `Contact ${i + 1}`}
                        </p>
                        <p className="text-xs sm:text-sm font-mono font-bold text-slate-900">{phone}</p>
                      </div>
                    </div>
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <i className="fa-solid fa-phone-volume text-[10px]" />
                      <span>Call</span>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Contact details available via Jatra Bazaar support.</p>
            )}

            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-[11px] text-amber-900 flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Stage Program &amp; Festival Bookings</p>
                <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                  To book this troupe for village jatras, committee mandawas, or festival performances, contact the troupe representatives directly via the numbers above.
                </p>
              </div>
            </div>
          </div>

          {/* Shows by this Party */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 font-brand uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-ticket text-rose-500 text-xs" />
                Shows by {pName}
              </h3>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                {partyShows.length} Available
              </span>
            </div>

            {partyShows.length > 0 ? (
              <div className="space-y-3 pt-1">
                {partyShows.map((show) => {
                  const showTitle = show.name || show.eventTitle || pName;
                  const showPoster = show.banner || (show.banners && show.banners[0]) || (!isLogoUrl(show.poster) ? show.poster : null) || show.img || partyLogoUrl;
                  const showVenue = show.committeeLocation || show.location || show.venue || pLocation;
                  const showDate = `${show.day || "22"} ${show.month || "OCT"} ${show.year || "2026"}`;

                  return (
                    <div
                      key={show.key || show.id}
                      className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 hover:border-indigo-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {showPoster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={showPoster}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover bg-slate-200 flex-shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 font-black">
                            🎭
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate font-brand">
                            {showTitle}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 truncate">
                            <i className="fa-solid fa-location-dot text-rose-500 text-[8px]" />
                            <span className="truncate">{showVenue}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-1">
                            <i className="fa-regular fa-calendar text-[9px]" />
                            <span>{showDate}</span>
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/event-details?id=${encodeURIComponent(show.key || show.id)}`}
                        onClick={() => {
                          try {
                            sessionStorage.setItem(`event_${show.key || show.id}`, JSON.stringify(show));
                          } catch {}
                        }}
                        className="w-full sm:w-auto bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-[11px] px-4 py-2 rounded-xl shadow-xs active:scale-95 transition-transform text-center flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-ticket text-[10px]" />
                        <span>Book Ticket</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <i className="fa-solid fa-masks-theater text-3xl text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No active ticketed shows online yet</p>
                <p className="text-[10px] text-slate-500 max-w-xs">
                  New shows for {pName} are being scheduled. Check back soon or call troupe management directly for upcoming village dates.
                </p>
                <Link
                  href="/events"
                  className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full hover:bg-indigo-100 active:scale-95 transition-all"
                >
                  Explore All Events
                </Link>
              </div>
            )}
          </div>

          {/* About Troupe */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
            <h3 className="text-xs font-black text-slate-900 font-brand uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-book-open text-indigo-600 text-xs" />
              About {pName}
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {party?.about ||
                `${pName} is one of the premier traditional ${pGenre} troupes based out of ${pLocation}. Bringing captivating storytelling, authentic tribal music, powerful acting, and culturally rich folklore to audiences across Odisha, Jharkhand, and West Bengal.`}
            </p>
          </div>
        </div>

        <BottomNav active="events" />
      </div>
    </div>
  );
}
