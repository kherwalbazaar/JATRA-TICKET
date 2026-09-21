"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import BookTicketsModal from "../../components/BookTicketsModal";
import { subscribeEvents } from "../../../lib/events";
import { saveBooking } from "../../../lib/bookings";

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value];
  return [];
};

const normalizeCast = (cast) => {
  if (!cast) return [];
  const castArray = asArray(cast);
  return castArray.map(member => {
    if (typeof member === 'string') {
      return { name: member, photo: null };
    }
    return member;
  });
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

export default function EventDetail({ id }) {
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);

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

  const event = events.find((ev) => ev.key === id) || events[0];

  const guide = event?.guide || {};
  const language = firstValue(event?.language, guide.language);
  const duration = firstValue(event?.duration, guide.duration);
  const trailer = toYouTubeEmbedUrl(firstValue(event?.trailer, event?.trailerUrl, event?.youtubeTrailer));
  const credits = event?.credits || {};
  const cast = normalizeCast(firstValue(event?.cast, event?.castCrew));
  const contact = event?.contact || event?.contactInformation || {};
  const address = firstValue(contact.address, event?.fullAddress, event?.address);
  const phone = firstValue(contact.phone, contact.mobile, event?.contactNumber, event?.mdPhone);
  const managingDirector = firstValue(contact.md, contact.managingDirector, event?.managingDirector, event?.mdName);
  const yearBanners = [...new Set(events
    .filter((item) => String(item.year || "") === String(event?.year || ""))
    .flatMap((item) => [item.banner, ...asArray(item.banners)])
    .filter(Boolean))];

  const formatDate = (month, day, year) => {
    if (!month || !day || !year) return "TBD";
    
    // Check if day is a day name (like "Sunday") vs numeric day (like "22")
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const isDayName = dayNames.includes(day);
    
    if (isDayName) {
      // Data issue: day contains day name instead of numeric day
      const monthShort = new Date(`${month} 1, ${year}`).toLocaleString("en-US", { month: "short" });
      return `${monthShort} ${day}, ${year}`; // Shows "OCT Sunday, 2026" to indicate data issue
    }
    
    // Normal case: day is numeric - use short format "22 Oct 2026"
    const date = new Date(`${month} ${day}, ${year}`);
    if (isNaN(date.getTime())) {
      return "TBD";
    }
    
    const monthShort = date.toLocaleString("en-US", { month: "short" });
    return `${date.getDate()} ${monthShort} ${date.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
        <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
            <Link href="/events" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <i className="fa-solid fa-arrow-left text-xs" />
            </Link>
            <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading event...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
        <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
            <Link href="/events" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <i className="fa-solid fa-arrow-left text-xs" />
            </Link>
            <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300" />
            <p className="text-sm text-slate-400 font-medium">Event not found</p>
            <Link href="/events" className="text-xs font-bold text-indigo-600">Go back to events</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <Link href="/events" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </Link>
          <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
        </div>

        <div className="px-4 py-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="w-full h-[200px] overflow-hidden bg-slate-100">
              <img
                src={event.banner || event.img || "/jarpa.png"}
                alt={event.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 font-brand">{event.name || "Event"}</h1>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">{event.partyName || event.organizer || "TBD"}</p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <i className="fa-regular fa-calendar text-rose-500 w-4" />
              <span>{formatDate(event.month, event.day, event.year)}</span>
            </div>
            {event.entryTime && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-regular fa-clock text-indigo-500 w-4" />
                <span>Entry: {event.entryTime}</span>
              </div>
            )}
            {event.startTime && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-solid fa-play text-emerald-500 w-4" />
                <span>Start: {event.startTime}</span>
              </div>
            )}
            {event.time && !event.entryTime && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-regular fa-clock text-indigo-500 w-4" />
                <span>{event.time}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <i className="fa-solid fa-location-dot text-rose-500 w-4" />
              <span>{event.location || "TBD"}</span>
            </div>
            {event.committee && (
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <i className="fa-solid fa-users text-indigo-500 w-4" />
                <span>{event.committee}</span>
              </div>
            )}
          </div>

          {event.about && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">About Jatra</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">{event.about}</p>
            </div>
          )}

          {(language || duration) && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 shadow-sm border border-indigo-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-clapperboard text-indigo-500" />
                Show Guide
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {language && (
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <i className="fa-solid fa-language text-indigo-500 text-xl" />
                    <p className="text-[11px] font-bold text-slate-900 mt-2">Language</p>
                    <p className="text-[11px] text-slate-600 font-semibold">{language}</p>
                  </div>
                )}
                {duration && (
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <i className="fa-solid fa-clock text-rose-500 text-xl" />
                    <p className="text-[11px] font-bold text-slate-900 mt-2">Duration</p>
                    <p className="text-[11px] text-slate-600 font-semibold">{duration}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {trailer && (
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-rose-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-film text-rose-500" />
                Trailer
              </h3>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-lg">
                <iframe
                  src={trailer}
                  title="Trailer"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {Object.values(credits).some(Boolean) && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 shadow-sm border border-amber-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-star text-amber-500" />
                Creative Credits
              </h3>
              <div className="space-y-2">
                {firstValue(credits.writer, credits.writerName, event.writer) && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-2 shadow-sm">
                    <span className="text-slate-600 font-semibold text-xs">Writer</span>
                    <span className="text-slate-900 font-bold text-xs">{firstValue(credits.writer, credits.writerName, event.writer)}</span>
                  </div>
                )}
                {firstValue(credits.director, credits.direction, event.director) && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-2 shadow-sm">
                    <span className="text-slate-600 font-semibold text-xs">Director</span>
                    <span className="text-slate-900 font-bold text-xs">{firstValue(credits.director, credits.direction, event.director)}</span>
                  </div>
                )}
                {firstValue(credits.music, event.music) && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-2 shadow-sm">
                    <span className="text-slate-600 font-semibold text-xs">Music</span>
                    <span className="text-slate-900 font-bold text-xs">{firstValue(credits.music, event.music)}</span>
                  </div>
                )}
                {firstValue(credits.singers, credits.singer, event.singer) && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-2 shadow-sm">
                    <span className="text-slate-600 font-semibold text-xs">Singers</span>
                    <span className="text-slate-900 font-bold text-xs">
                      {asArray(firstValue(credits.singers, credits.singer, event.singer)).join(", ")}
                    </span>
                  </div>
                )}
                {firstValue(credits.danceMaster, event.danceMaster) && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-2 shadow-sm">
                    <span className="text-slate-600 font-semibold text-xs">Dance Master</span>
                    <span className="text-slate-900 font-bold text-xs">{firstValue(credits.danceMaster, event.danceMaster)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {cast.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 shadow-sm border border-emerald-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-users text-emerald-500" />
                Cast & Crew
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {cast.map((member, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-emerald-100 flex items-center justify-center">
                      {member.photo || member.image ? (
                        <img
                          src={member.photo || member.image}
                          alt={member.name || "Cast member"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
                          <i className="fa-solid fa-user text-emerald-400 text-2xl" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-900 mt-2 text-center truncate w-full">{member.name || "Cast member"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {yearBanners.length > 0 && (
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 shadow-sm border border-cyan-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-images text-cyan-500" />
                Banners ({event.year || "2026"})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {yearBanners.map((img, i) => (
                  <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
                    <img 
                      key={i} 
                      src={img} 
                      alt={`Banner ${i + 1}`} 
                      className="w-full aspect-video object-contain bg-slate-100" 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(address || phone || managingDirector) && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-purple-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-address-book text-purple-500" />
                Contact Information
              </h3>
              <div className="space-y-3">
                {managingDirector && (
                  <div className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-user-tie text-indigo-500 text-sm" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Managing Director</p>
                      <p className="text-sm font-bold text-slate-900">{managingDirector}</p>
                    </div>
                  </div>
                )}
                {address && (
                  <div className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-location-dot text-rose-500 text-sm" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Full Address</p>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">{address}</p>
                    </div>
                  </div>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-phone text-emerald-500 text-sm" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Contact Number</p>
                      <p className="text-sm font-bold text-indigo-700">{phone}</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Ticket Prices</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-orange-50 rounded-xl p-2.5 border border-orange-200">
                <p className="text-[10px] font-black text-orange-700 uppercase">Standing</p>
                <p className="text-lg font-black text-orange-600">₹50</p>
                <p className="text-[9px] text-orange-600">Gate A</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-2.5 border border-cyan-200">
                <p className="text-[10px] font-black text-cyan-700 uppercase">Special</p>
                <p className="text-lg font-black text-cyan-600">₹100</p>
                <p className="text-[9px] text-cyan-600">Gate B</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-2.5 border border-purple-200">
                <p className="text-[10px] font-black text-purple-700 uppercase">VIP</p>
                <p className="text-lg font-black text-purple-600">₹200</p>
                <p className="text-[9px] text-purple-600">Gate C</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200">
                <p className="text-[10px] font-black text-amber-700 uppercase">Star</p>
                <p className="text-lg font-black text-amber-600">₹500</p>
                <p className="text-[9px] text-amber-600">Gate D</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Terms & Conditions</h3>
            <div className={`text-[10px] text-slate-600 leading-relaxed space-y-2 ${!showAllTerms ? "max-h-20 overflow-hidden relative" : ""}`}>
              <p><strong>1. Acceptance of Terms</strong> - By accessing or using the Ama Jatra platform, you agree to be bound by these Terms and Conditions.</p>
              <p><strong>2. Eligibility</strong> - You must be at least 18 years of age to create an account and purchase tickets.</p>
              <p><strong>3. Ticket Purchases</strong> - All ticket purchases are subject to availability. Prices are in INR and inclusive of GST.</p>
              <p><strong>4. Booking Confirmation</strong> - A booking is confirmed only after successful payment. Your e-ticket with QR code will be available in My Tickets.</p>
              <p><strong>5. Refund & Cancellation</strong> - Tickets are non-refundable except in cases of show cancellation by the organiser.</p>
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

          <button
            onClick={() => {
              const eventName = event.name || "Event";
              const eventId = event.key || id;
              window.location.href = `/seats?event=${encodeURIComponent(eventName)}&eventId=${eventId}`;
            }}
            className="w-full bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white font-extrabold text-base py-3.5 rounded-2xl shadow-lg shadow-rose-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-ticket -rotate-12 text-lg" />
            <span>Book Ticket Now</span>
            <i className="fa-solid fa-chevron-right text-xs ml-1" />
          </button>
        </div>

        <BottomNav active="events" />
      </div>

      {booking && (
        <BookTicketsModal
          initialTierId={booking.tierId}
          onClose={() => setBooking(null)}
          onProceed={async (data) => {
            try {
              await saveBooking({ ...data, eventId: event.key || id });
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
