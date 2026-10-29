"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import BannerImage from "../../components/BannerImage";
import { subscribeEvents } from "../../../lib/events";

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value];
  return [];
};

const toYouTubeEmbedUrl = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
    }
  } catch {
    return value;
  }
  return value;
};

const normalizeCast = (raw) =>
  asArray(raw)
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        return name ? { name, photo: null } : null;
      }
      if (!item || typeof item !== "object") return null;
      const name = firstValue(item.name, item.actorName, item.fullName) || "";
      const photo = firstValue(item.photo, item.image, item.img, item.photoUrl, item.url) || null;
      return name || photo ? { name, photo } : null;
    })
    .filter(Boolean);

export default function ShowDetailPage({ params }) {
  const { id } = use(params);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeEvents((list) => {
      setEvents(Array.isArray(list) ? list : []);
      setLoading(false);
    });
    const timer = setTimeout(() => setLoading(false), 4000);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  const event = useMemo(() => {
    const target = String(id || "").trim();
    return (
      events.find((ev) => String(ev.id) === target || String(ev.key) === target) || null
    );
  }, [events, id]);

  if (loading) {
    return (
      <div className="bg-[#f8faff] min-h-screen flex items-center justify-center">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-[#f8faff] min-h-screen flex flex-col">
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3">
          <Link href="/todays-show" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </Link>
          <h2 className="text-lg font-black font-brand">Show Details</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
          <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300" />
          <p className="text-sm font-bold text-slate-600">Show not found</p>
          <p className="text-xs text-slate-400">This show is no longer available.</p>
          <Link href="/todays-show" className="mt-2 text-xs font-bold text-indigo-600">
            Back to all shows
          </Link>
        </div>
      </div>
    );
  }

  const banner = event.banner || event.poster || "";
  const gallery = asArray(event.banners).filter((img) => img && img !== banner);
  const cast = normalizeCast(event.actors);
  const trailerUrl = toYouTubeEmbedUrl(event.trailerUrl || event.trailer);
  const dateLabel = [event.day, event.month, event.year].filter(Boolean).join(" ");
  const timeLabel =
    event.startTime && event.end_time
      ? `${event.startTime} - ${event.end_time}`
      : firstValue(event.startTime, event.entryTime, event.time, "");
  const committee = firstValue(event.organizationName, event.committee_name, event.partyName, "");
  const credits = [
    { label: "Writer", value: event.writer },
    { label: "Director", value: event.director },
    { label: "Music", value: event.music_director || event.musicDirector },
    { label: "Singer", value: asArray(event.singer).join(", ") },
  ].filter((c) => c.value);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <Link href="/todays-show" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </Link>
          <h2 className="text-lg font-black font-brand truncate">Show Details</h2>
        </div>

        <div className="w-full h-[220px] overflow-hidden bg-slate-900">
          <BannerImage src={banner} alt={event.name} className="w-full h-full object-cover" />
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 font-brand">{event.name}</h1>
            {event.partyName && (
              <p className="text-xs text-indigo-600 font-bold mt-0.5">{event.partyName}</p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-2">
            {dateLabel && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-regular fa-calendar text-rose-500 w-4" />
                <span>{dateLabel}</span>
              </div>
            )}
            {timeLabel && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-regular fa-clock text-indigo-500 w-4" />
                <span>{timeLabel}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-solid fa-location-dot text-rose-500 w-4" />
                <span>{event.location}</span>
              </div>
            )}
            {committee && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-solid fa-users text-indigo-500 w-4" />
                <span>{committee}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">About Jatra</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">{event.description}</p>
            </div>
          )}

          {(event.language || event.duration) && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Show Guide</h3>
              <div className="grid grid-cols-2 gap-2">
                {event.language && (
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <i className="fa-solid fa-language text-indigo-500 text-lg" />
                    <p className="text-[10px] font-bold text-slate-900 mt-1">Language</p>
                    <p className="text-[10px] text-slate-600">{event.language}</p>
                  </div>
                )}
                {event.duration && (
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <i className="fa-solid fa-clock text-rose-500 text-lg" />
                    <p className="text-[10px] font-bold text-slate-900 mt-1">Duration</p>
                    <p className="text-[10px] text-slate-600">{event.duration}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {trailerUrl && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Trailer</h3>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900">
                <iframe
                  src={trailerUrl}
                  title="Trailer"
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {credits.length > 0 && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Creative Credits</h3>
              <div className="space-y-1.5">
                {credits.map((c) => (
                  <div key={c.label} className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-semibold">{c.label}</span>
                    <span className="text-slate-900 font-bold text-right">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cast.length > 0 && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Cast &amp; Crew</h3>
              <div className="grid grid-cols-4 gap-3">
                {cast.map((member, i) => (
                  <div key={`${member.name}-${i}`} className="flex flex-col items-center">
                    {member.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.photo}
                        alt={member.name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm ring-2 ring-slate-100">
                        {(member.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <p className="text-[9px] font-bold text-slate-900 mt-1 text-center truncate w-full">
                      {member.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gallery.length > 0 && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Gallery</h3>
              <div className="grid grid-cols-2 gap-2">
                {gallery.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${img}-${i}`}
                    src={img}
                    alt={`Gallery ${i + 1}`}
                    className="w-full h-28 rounded-xl object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Terms &amp; Conditions</h3>
            <div className={`text-[10px] text-slate-600 leading-relaxed space-y-2 ${!showAllTerms ? "max-h-20 overflow-hidden relative" : ""}`}>
              <p><strong>1. Acceptance of Terms</strong> - By accessing or using the Ama Jatra platform, you agree to be bound by these Terms and Conditions.</p>
              <p><strong>2. Eligibility</strong> - You must be at least 18 years of age to create an account and purchase tickets.</p>
              <p><strong>3. Ticket Purchases</strong> - All ticket purchases are subject to availability. Prices are in INR and inclusive of GST.</p>
              <p><strong>4. Booking Confirmation</strong> - A booking is confirmed only after successful payment. Your e-ticket with QR code will be available in My Tickets.</p>
              <p><strong>5. Refund &amp; Cancellation</strong> - Tickets are non-refundable except in cases of show cancellation by the organiser.</p>
              <p><strong>6. Ticket Transfers</strong> - Tickets are non-transferable and linked to the purchasing account.</p>
              <p><strong>7. Entry Conditions</strong> - Ticket holders must present QR code at the venue for scanning.</p>
              <p><strong>8. Promo Codes</strong> - Only one promo code per transaction. Valid for limited time.</p>
              <p><strong>9. Intellectual Property</strong> - All content is property of Ama Jatra and protected by copyright laws.</p>
              <p><strong>10. Limitation of Liability</strong> - Ama Jatra shall not be liable for indirect damages.</p>
              <p><strong>11. Governing Law</strong> - Governed by laws of India. Jurisdiction in Bhubaneswar, Odisha.</p>
              <p><strong>12. Changes to Terms</strong> - We reserve the right to modify these Terms at any time.</p>
              {!showAllTerms && (
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
            <button onClick={() => setShowAllTerms(!showAllTerms)} className="text-[10px] font-bold text-indigo-600 mt-2">
              {showAllTerms ? "Show Less" : "Read More"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
