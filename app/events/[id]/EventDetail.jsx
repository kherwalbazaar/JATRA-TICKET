"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import { subscribeEvents, fetchEvents } from "../../../lib/events";
import { getImageSource } from "../../components/BannerImage";

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value];
  return [];
};

const normalizeCast = (raw) => {
  if (!raw) return [];
  let list = raw;

  if (typeof list === "string") {
    list = list.trim() ? [list] : [];
  } else if (Array.isArray(list)) {
    // already a list
  } else if (typeof list === "object") {
    // single member object
    if (list.name || list.actorName || list.fullName || list.photo || list.image || list.img) {
      list = [list];
    } else if (Array.isArray(list.members)) list = list.members;
    else if (Array.isArray(list.cast)) list = list.cast;
    else if (Array.isArray(list.list)) list = list.list;
    else if (Array.isArray(list.items)) list = list.items;
    else list = Object.values(list); // map keyed by index/name
  } else {
    return [];
  }

  return list
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        return name ? { name, photo: null } : null;
      }
      if (item && typeof item === "object") {
        const name =
          firstValue(item.name, item.actorName, item.fullName, item.title, item.label) || "";
        const photo =
          firstValue(item.photo, item.image, item.img, item.photoUrl, item.imageUrl, item.picture, item.avatar, item.url) || null;
        if (!name && !photo) return null;
        return { ...item, name, photo };
      }
      return null;
    })
    .filter(Boolean);
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

export default function EventDetail({ id }) {
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [event, setEvent] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setFetching(true);
    setLoadError("");
    setEvent(null);
    setAllEvents([]);

    // 1. Instantly read the event pre-saved by the list page
    const cachedEvent = sessionStorage.getItem(`event_${id}`);
    if (cachedEvent) {
      try {
        const parsedData = JSON.parse(cachedEvent);
        if (!cancelled && parsedData) {
          setEvent(parsedData);
          setFetching(false);
        }
      } catch (e) {
        console.error("Failed to parse cached event data", e);
      }
    }

    // 2. Background sync with Firestore to keep data fresh
    async function syncFreshData() {
      try {
        const data = await fetchEvents();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setAllEvents(list);
        const matched = list.find((item) => String(item?.key) === String(id));
        if (matched) {
          setEvent(matched);
          setLoadError("");
          try {
            sessionStorage.setItem(`event_${id}`, JSON.stringify(matched));
          } catch {}
        } else if (!cachedEvent) {
          setEvent(null);
        }
      } catch (err) {
        console.error("Background sync failed:", err);
        if (!cancelled && !cachedEvent) {
          setLoadError("We could not load this event. Please try again.");
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    syncFreshData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/events";
  };

  const statusPage = (icon, message, actionLabel = "Go back", onAction = goBack) => (
    <div className="standalone-detail-page bg-slate-900 min-h-screen text-slate-800 antialiased">
      <div className="bg-[#f8faff] min-h-screen flex flex-col pb-24">
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <button onClick={onAction} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center" aria-label={actionLabel}>
            <i className="fa-solid fa-arrow-left text-xs" />
          </button>
          <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-3 text-center">
          <i className={`${icon} text-4xl text-slate-300`} />
          <p className="text-sm text-slate-600 font-semibold">{message}</p>
        </div>
        <BottomNav active="events" />
      </div>
    </div>
  );

  if (fetching && !event) {
    return null;
  }

  if (loadError) {
    return statusPage("fa-solid fa-triangle-exclamation", loadError, "Try again", () => window.location.reload());
  }

  if (!event) {
    return statusPage("fa-regular fa-calendar-xmark", "Event not found", "Go back");
  }

  const guide = event?.guide || {};
  const language = firstValue(event?.language, guide.language);
  const duration = firstValue(event?.duration, guide.duration, event?.time);
  const audience = firstValue(event?.audience, guide.audience);
  const trailer = toYouTubeEmbedUrl(firstValue(event?.trailer, event?.trailerUrl, event?.youtubeTrailer));
  const credits = event?.credits && Object.values(event?.credits || {}).some(Boolean) ? event.credits : null;
  const castCandidates = [
    event?.cast,
    event?.castCrew,
    event?.actors,
    event?.actor,
    event?.starCast,
    event?.castMembers,
    event?.castList,
    event?.artistDetails,
    event?.artists,
    event?.performers,
    event?.crew,
    event?.details?.cast,
    event?.guide?.cast,
  ];
  const castSource = castCandidates.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
  );
  const cast = normalizeCast(castSource);
  const contact = event?.contact || event?.contactInformation || {};
  const address = firstValue(contact.address, event?.fullAddress, event?.address, event?.addressLine);
  const committeeAddress = firstValue(
    event?.committeeLocation,
    event?.committee?.location,
    event?.committeeAddress,
    event?.committeeAddr,
    event?.committee?.address
  );
  const locationAddress = committeeAddress || address;
  const phone = firstValue(contact.phone, contact.mobile, event?.contactNumber, event?.mdPhone, event?.phone);
  const managingDirector = firstValue(contact.md, contact.managingDirector, event?.managingDirector, event?.mdName);
  const committee = event?.committee || contact.committee;
  const about = event?.about || "";
  // Only keep URLs the browser can actually load (remote/data URLs).
  // Local paths like "/jarpa.png" 404 because the project has no public/ folder.
  const toLoadableUrl = (value) => {
    const src = getImageSource(value, "");
    if (!src) return null;
    const trimmed = src.trim();
    if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
    return null;
  };
  const sameYearEvents = allEvents.filter(
    (item) => String(item?.year || "") === String(event?.year || "")
  );
  const bannerCandidates = [
    ...asArray(event?.banners),
    event?.bannerUrl,
    event?.bannerImg,
    event?.imageUrl,
    event?.image,
    event?.img,
    event?.banner,
    ...sameYearEvents.flatMap((item) => [item?.banner, ...asArray(item?.banners)]),
  ];
  const displayBanners = [...new Set(bannerCandidates.map(toLoadableUrl).filter(Boolean))];
  const topBanner = displayBanners[0] || null;

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

  return (
    <div className="standalone-detail-page bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </button>
          <h2 className="text-lg font-black font-brand truncate">Event Details</h2>
        </div>

        {/* Banner - only when a loadable image exists */}
        {topBanner && (
          <div className="w-full overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={topBanner}
              alt={event?.name || "Event banner"}
              className="w-full h-auto object-contain"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Event Name & Party */}
          <div>
            <h1 className="text-xl font-black text-slate-900 font-brand">{event?.name || "Event"}</h1>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">{event?.partyName || event?.organizer || "TBD"}</p>
          </div>

          {/* Location (Committee, Address) - only database data */}
          {(committee || locationAddress) && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-2">
              <h3 className="text-sm font-black text-slate-900 font-brand flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-rose-500" /> Location
              </h3>
              <div className="space-y-2">
                {committee && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Committee</p>
                    <p className="text-xs font-black text-slate-900">{committee}</p>
                  </div>
                )}
                {locationAddress && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Address</p>
                    <p className="text-xs font-semibold text-rose-600">{locationAddress}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* About Jatra */}
          {about && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-2">About Jatra</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">{about}</p>
            </div>
          )}

          {/* Show Guide (Language, Duration, Audience) */}
          {(language || duration || audience) && (
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
                {audience && (
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <i className="fa-solid fa-users text-emerald-500 text-xl" />
                    <p className="text-[10px] font-bold text-slate-900 mt-2">Audience</p>
                    <p className="text-[10px] text-slate-600 font-semibold">{audience}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trailer - only when the database has one */}
          {trailer && (
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-rose-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-film text-rose-500" /> Trailer
              </h3>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-lg">
                <iframe src={trailer} title="Trailer" className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            </div>
          )}

          {/* Creative Credits - only database data */}
          {credits && (() => {
            const writer = firstValue(credits?.writer, credits?.writerName, event?.writer);
            const director = firstValue(credits?.director, credits?.direction, event?.director);
            const music = firstValue(credits?.music, event?.music);
            const singers = asArray(firstValue(credits?.singers, credits?.singer, event?.singer)).join(", ");
            const rows = [
              ["Writer", writer],
              ["Director", director],
              ["Music", music],
              ["Singer", singers],
            ].filter(([, value]) => value);
            if (rows.length === 0) return null;
            return (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 shadow-sm border border-amber-100">
                <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-star text-amber-500" /> Creative
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {rows.map(([label, value]) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Cast & Crew - only real data from the database */}
          {cast.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 shadow-sm border border-emerald-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-users text-emerald-500" /> Cast & Crew
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {cast.map((member, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-emerald-100 flex items-center justify-center">
                      {member?.photo ? (
                        <img
                          src={member.photo}
                          alt={member?.name || "Cast member"}
                          className="w-full h-full object-contain object-center bg-white"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
                          <i className="fa-solid fa-user text-emerald-400 text-2xl" />
                        </div>
                      )}
                    </div>
                    {member?.name && (
                      <p className="text-[10px] font-bold text-slate-900 mt-2 text-center truncate w-full">{member.name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner Photos - only database banners */}
          {displayBanners.length > 0 && (
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 shadow-sm border border-cyan-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-images text-cyan-500" /> Banner ({event?.year || "2026"})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {displayBanners.map((img, i) => (
                  <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Banner ${i + 1}`}
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const tile = e.currentTarget.parentElement;
                        if (tile) tile.style.display = "none";
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Party Address - only database data */}
          {(managingDirector || address || phone) && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-purple-100">
              <h3 className="text-sm font-black text-slate-900 font-brand mb-3 flex items-center gap-2">
                <i className="fa-solid fa-address-book text-purple-500" /> Party Address
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
                )}
                {phone && (
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
                )}
              </div>
            </div>
          )}

          {/* Book Ticket Now */}
          <button
            onClick={() => {
              const eventName = event?.name || "Event";
              const eventId = event?.key || id;
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
