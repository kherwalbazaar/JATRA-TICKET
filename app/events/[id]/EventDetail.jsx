"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import { subscribeEvents, fetchEvents } from "../../../lib/events";

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
    if (typeof member === 'string') return { name: member, photo: null };
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
  } catch { return value; }
  return value;
};

const DUMMY_TRAILER = "https://www.youtube.com/embed/dQw4w9WgXcQ";
const DUMMY_CAST = [
  { name: "Rajesh Kumar", photo: "https://i.pravatar.cc/150?img=11" },
  { name: "Sunita Sahu", photo: "https://i.pravatar.cc/150?img=5" },
  { name: "Bikram Oraon", photo: "https://i.pravatar.cc/150?img=12" },
  { name: "Mamata Behera", photo: "https://i.pravatar.cc/150?img=9" },
  { name: "Suresh Nayak", photo: "https://i.pravatar.cc/150?img=13" },
  { name: "Purnima Munda", photo: "https://i.pravatar.cc/150?img=16" },
];
const DUMMY_CREDITS = {
  writer: "Maheswar Soren",
  director: "Dasarath Singh",
  music: "Bhubaneswar Mishra",
  singers: ["Ardhendu Giri", "Malabika Sanyal"],
};
const DUMMY_BANNERS = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&auto=format&fit=crop&q=80",
];

const FALLBACK_EVENTS = [
  {
    key: "1",
    name: "ADIM LAHAH MANDAWA",
    partyName: "Adim Lahah Mandawa",
    organizationName: "ADIM LAHAH MANDAWA",
    month: "OCT",
    day: "1",
    year: "2026",
    location: "Balanada Ground, Khunta, Mayurbhanj",
    banner: "/jarpa.png",
    time: "08:30 PM - 04:30 AM",
    entryTime: "07:45 PM",
    startTime: "08:30 PM",
    about: "Adim Lahah Mandawa is a grand Jatra performance featuring traditional folk art, music, and cultural storytelling. Experience the vibrant colors and rhythms of Odisha's rich theatrical heritage.",
    language: "Santali",
    duration: "10:00 PM - 05:00 AM",
    audience: "All Age",
    committee: "Adim Lahah Mandawa Committee",
    address: "Bahanada, Khunta, Mayurbhanj, Odisha - 757035",
    phone: "+91 94370 12345",
    managingDirector: "Sri Prakash Chandra Sahu",
    trailer: DUMMY_TRAILER,
    credits: DUMMY_CREDITS,
    cast: DUMMY_CAST,
    banners: DUMMY_BANNERS,
  },
  {
    key: "2",
    name: "RAMRAJ GAYAN MOHAL",
    partyName: "Ramraj Opera",
    organizationName: "Ramraj Opera",
    month: "OCT",
    day: "23",
    year: "2026",
    location: "Bahanada, Khunta, Mayurbhanj",
    banner: "/ramraj.png",
    time: "10:00 PM - 05:00 AM",
    entryTime: "09:15 PM",
    startTime: "10:00 PM",
    about: "Ramraj Opera presents a spectacular Jatra show with talented artists, beautiful costumes, and mesmerizing performances that captivate the audience through the night.",
    language: "Santali",
    duration: "10:00 PM - 05:00 AM",
    audience: "All Age",
    committee: "Ramraj Gayan Mohal",
    address: "Bahanada, Khunta, Mayurbhanj, Odisha - 757035",
    phone: "+91 94370 67890",
    managingDirector: "Sri Ramesh Chandra Naik",
    trailer: DUMMY_TRAILER,
    credits: DUMMY_CREDITS,
    cast: DUMMY_CAST,
    banners: DUMMY_BANNERS,
  },
];

export default function EventDetail({ id }) {
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      try {
        const data = await fetchEvents();
        if (!cancelled && data && data.length > 0) {
          setEvents(data);
        }
      } catch (err) {
        console.error("Error loading events:", err);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    
    load();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const event = events.find((ev) => ev.key === id) 
    || events[0] 
    || FALLBACK_EVENTS.find((ev) => ev.key === id) 
    || FALLBACK_EVENTS[0];
  const guide = event?.guide || {};
  const language = firstValue(event?.language, guide.language, "Santali");
  const duration = firstValue(event?.duration, guide.duration, event?.time, "10:00 PM - 05:00 AM");
  const audience = firstValue(event?.audience, guide.audience, "All Age");
  const trailer = toYouTubeEmbedUrl(firstValue(event?.trailer, event?.trailerUrl, event?.youtubeTrailer, DUMMY_TRAILER));
  const credits = event?.credits && Object.values(event.credits).some(Boolean) ? event.credits : DUMMY_CREDITS;
  const castRaw = normalizeCast(firstValue(event?.cast, event?.castCrew));
  const cast = castRaw.length > 0 ? castRaw : DUMMY_CAST;
  const contact = event?.contact || event?.contactInformation || {};
  const address = firstValue(contact.address, event?.fullAddress, event?.address, "Bahanada, Khunta, Mayurbhanj, Odisha - 757035");
  const phone = firstValue(contact.phone, contact.mobile, event?.contactNumber, event?.mdPhone, event?.phone, "+91 94370 12345");
  const managingDirector = firstValue(contact.md, contact.managingDirector, event?.managingDirector, event?.mdName, "Sri Prakash Chandra Sahu");
  const committee = event?.committee || contact.committee || "Jatra Committee";
  const bannersRaw = asArray(event?.banners);
  const yearBanners = bannersRaw.length > 0
    ? bannersRaw
    : [...new Set(events
        .filter((item) => String(item.year || "") === String(event?.year || ""))
        .flatMap((item) => [item.banner, ...asArray(item.banners)])
        .filter(Boolean))];
  const displayBanners = yearBanners.length > 0 ? yearBanners : DUMMY_BANNERS;

  const formatDate = (month, day, year) => {
    if (!month || !day || !year) return "TBD";
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (dayNames.includes(day)) {
      const monthShort = new Date(`${month} 1, ${year}`).toLocaleString("en-US", { month: "short" });
      return `${monthShort} ${day}, ${year}`;
    }
    const date = new Date(`${month} ${day}, ${year}`);
    if (isNaN(date.getTime())) return "TBD";
    return `${date.getDate()} ${date.toLocaleString("en-US", { month: "short" })} ${date.getFullYear()}`;
  };

  if (!event) {
    return (
      <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
        <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
            <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <i className="fa-solid fa-arrow-left text-xs" />
            </button>
            <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300" />
            <p className="text-sm text-slate-400 font-medium">Event not found</p>
            <button onClick={() => window.history.back()} className="text-xs font-bold text-indigo-600">Go back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      {/* Loading Popup Modal */}
      {fetching && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-6 py-5 shadow-2xl flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-600">Loading event details...</p>
          </div>
        </div>
      )}
      <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </button>
          <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
        </div>

        {/* Banner - Full width, fit */}
        <div className="w-full overflow-hidden bg-slate-100">
          <img src={event.banner || event.img || "/jarpa.png"} alt={event.name} className="w-full h-auto object-contain" />
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Event Name & Party */}
          <div>
            <h1 className="text-xl font-black text-slate-900 font-brand">{event.name || "Event"}</h1>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">{event.partyName || event.organizer || "TBD"}</p>
          </div>

          {/* Location (Committee, Address) */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-2">
            <h3 className="text-sm font-black text-slate-900 font-brand flex items-center gap-2">
              <i className="fa-solid fa-location-dot text-rose-500" /> Location
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Committee</p>
                <p className="text-xs font-black text-slate-900">{committee}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Address</p>
                <p className="text-xs font-semibold text-rose-600">{event.location || address || "TBD"}</p>
              </div>
            </div>
          </div>

          {/* About Jatra */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">About Jatra</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">{event.about || "Experience the magic of traditional Jatra performances."}</p>
          </div>

          {/* Show Guide (Language, Duration, Audience) */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 shadow-sm border border-indigo-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-clapperboard text-indigo-500" /> Show Guide
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {language && (
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <i className="fa-solid fa-language text-indigo-500 text-xl" />
                  <p className="text-[10px] font-bold text-slate-900 mt-2">Language</p>
                  <p className="text-[10px] text-slate-600 font-semibold">{language}</p>
                </div>
              )}
              {duration && (
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <i className="fa-solid fa-clock text-rose-500 text-xl" />
                  <p className="text-[10px] font-bold text-slate-900 mt-2">Duration</p>
                  <p className="text-[10px] text-slate-600 font-semibold">{duration}</p>
                </div>
              )}
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <i className="fa-solid fa-users text-emerald-500 text-xl" />
                <p className="text-[10px] font-bold text-slate-900 mt-2">Audience</p>
                <p className="text-[10px] text-slate-600 font-semibold">{audience}</p>
              </div>
            </div>
          </div>

          {/* Trailer */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-rose-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-film text-rose-500" /> Trailer
            </h3>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-lg">
              <iframe src={trailer} title="Trailer" className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>

          {/* Creative Credits */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 shadow-sm border border-amber-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-star text-amber-500" /> Creative
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Writer</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">{firstValue(credits.writer, credits.writerName, event.writer, "Maheswar Soren")}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Director</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">{firstValue(credits.director, credits.direction, event.director, "Dasarath Singh")}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Music</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">{firstValue(credits.music, event.music, "Bhubaneswar Mishra")}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Singer</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">{asArray(firstValue(credits.singers, credits.singer, event.singer, ["Ardhendu Giri", "Malabika Sanyal"])).join(", ")}</p>
              </div>
            </div>
          </div>

          {/* Cast & Crew */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 shadow-sm border border-emerald-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-users text-emerald-500" /> Cast & Crew
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {cast.map((member, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-emerald-100 flex items-center justify-center">
                    {member.photo || member.image ? (
                      <img src={member.photo || member.image} alt={member.name || "Cast member"} className="w-full h-full object-cover" />
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

          {/* Banner Photos */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 shadow-sm border border-cyan-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-images text-cyan-500" /> Banner ({event.year || "2026"})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {displayBanners.map((img, i) => (
                <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm aspect-video">
                  <img src={img} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          {/* Good to Know */}
          <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl p-4 shadow-sm border border-sky-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-circle-info text-sky-500" /> Good to Know
            </h3>
            <div className="space-y-2 text-[11px] text-slate-700">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-door-open text-sky-500 mt-0.5" />
                <span>Gates open 45 minutes before show time.</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-ban text-sky-500 mt-0.5" />
                <span>Tickets are non-refundable and non-transferable.</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-qrcode text-sky-500 mt-0.5" />
                <span>Please carry a valid ID proof along with your e-ticket.</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-clock text-sky-500 mt-0.5" />
                <span>Late entry may not be allowed once the show starts.</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-camera-slash text-sky-500 mt-0.5" />
                <span>Recording and photography inside the venue is strictly prohibited.</span>
              </div>
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-child text-sky-500 mt-0.5" />
                <span>Children below 3 years do not require a ticket.</span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
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
              {!showAllTerms && <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />}
            </div>
            <button onClick={() => setShowAllTerms(!showAllTerms)} className="text-[10px] font-bold text-indigo-600 mt-2">
              {showAllTerms ? "Show Less" : "Read More"}
            </button>
          </div>

          {/* Party Address */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-purple-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
              <i className="fa-solid fa-address-book text-purple-500" /> Party Address
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-user-tie text-indigo-500 text-sm" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Managing Director</p>
                  <p className="text-sm font-bold text-slate-900">{managingDirector}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-location-dot text-rose-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Full Address</p>
                  <p className="text-xs font-semibold text-rose-600">{address}</p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                >
                  <i className="fa-solid fa-map-location-dot text-white text-sm" />
                </a>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-phone text-emerald-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Contact Number</p>
                  <p className="text-sm font-bold text-indigo-700">{phone}</p>
                </div>
                <a
                  href={`tel:${phone}`}
                  className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                >
                  <i className="fa-solid fa-phone-volume text-white text-sm" />
                </a>
              </div>
            </div>
          </div>

          {/* Book Ticket Now */}
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
    </div>
  );
}
