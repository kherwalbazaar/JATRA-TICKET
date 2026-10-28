"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import { subscribeEvents, fetchEvents, getEventExpiryInfo, isLogoUrl } from "../../../lib/events";
import { getImageSource } from "../../components/BannerImage";
import { getSavedCustomerProfile } from "../../../lib/supabase";
import LoginRequiredModal from "../../components/LoginRequiredModal";
import { findParty, findPartyForEvent } from "../../../lib/parties";

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
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setFetching(true);
    setLoadError("");
    setEvent(null);
    setAllEvents([]);

    // 1. Instantly read the event pre-saved by the list page or match party
    const cachedEvent = typeof window !== "undefined" ? sessionStorage.getItem(`event_${id}`) : null;
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

    } else {
      const fallbackParty = findParty(id);
      if (fallbackParty) {
        setEvent({
          id: fallbackParty.id,
          key: fallbackParty.id,
          name: fallbackParty.name,
          partyName: fallbackParty.name,
          banner: fallbackParty.logo || "",
          poster: fallbackParty.logo || "",
          genre: fallbackParty.genre || "Santali Cultural Opera",
          location: fallbackParty.location,
          committeeLocation: fallbackParty.location,
          director: fallbackParty.director,
          writer: fallbackParty.writer,
          phone: fallbackParty.phone,
          phone2: fallbackParty.phone2,
          about: `${fallbackParty.name} is a renowned ${fallbackParty.genre || "Santali Cultural Opera"} troupe from ${fallbackParty.location}. Dedicated to traditional Santali theatre, folk music, and cultural stories.`,
          isPartyOnly: true,
          activeShows: fallbackParty.activeShows || 0,
        });
        setFetching(false);
      }
    }

    // 2. Background sync with database to keep data fresh
    async function syncFreshData() {
      try {
        const data = await fetchEvents();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setAllEvents(list);
        const cleanId = String(id).trim();
        let matched = list.find(
          (item) =>
            String(item?.key || "").trim() === cleanId ||
            String(item?.id || "").trim() === cleanId ||
            String(item?.eventId || "").trim() === cleanId ||
            String(item?.showId || "").trim() === cleanId,
        );

        // If not matched by event id, try matching by party name or party id
        if (!matched) {
          const upperId = cleanId.toUpperCase();
          matched = list.find((item) => {
            const pName = String(item?.partyName || item?.party_name || item?.name || item?.eventTitle || "").trim().toUpperCase();
            return pName && (pName === upperId || upperId.includes(pName) || pName.includes(upperId));
          });
        }

        // If still not matched, check if cleanId matches an Opera Party directly
        if (!matched) {
          const party = findParty(cleanId);
          if (party) {
            matched = {
              id: party.id,
              key: party.id,
              name: party.name,
              partyName: party.name,
              banner: party.logo || "",
              poster: party.logo || "",
              genre: party.genre || "Santali Cultural Opera",
              location: party.location,
              committeeLocation: party.location,
              director: party.director,
              writer: party.writer,
              phone: party.phone,
              phone2: party.phone2,
              about: `${party.name} is a renowned ${party.genre || "Santali Cultural Opera"} troupe from ${party.location}. Dedicated to traditional Santali theatre, folk music, and cultural stories.`,
              isPartyOnly: true,
              activeShows: party.activeShows || 0,
            };
          }
        }

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
        {/* Login Required Modal */}
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Login First to Book Tickets"
          message="You can freely view all event details, cast, and schedules. However, you must log in to your account before you can book tickets."
        />

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
  const partyInfo = findPartyForEvent(event) || findParty(id) || null;
  const partyName = firstValue(partyInfo?.name, event?.partyName, event?.party_name, event?.name);
  const partyGenre = firstValue(partyInfo?.genre, event?.genre, "Santali Cultural Opera");
  const partyLocation = firstValue(partyInfo?.location, event?.partyLocation, event?.committeeLocation, event?.location);
  const partyDirector = firstValue(partyInfo?.director, event?.director, credits?.director);
  const partyWriter = firstValue(partyInfo?.writer, event?.writer, credits?.writer);
  const partyPhone1 = firstValue(partyInfo?.phone, event?.phone, contact?.phone);
  const partyPhone2 = firstValue(partyInfo?.phone2, event?.phone2, "");
  const partyPhones = [partyPhone1, partyPhone2].filter(Boolean);
  const partyColor = partyInfo?.color || "from-indigo-600 to-purple-600";

  const address = firstValue(contact.address, event?.fullAddress, event?.address, event?.addressLine, partyLocation);
  const committeeAddress = firstValue(
    event?.committeeLocation,
    event?.committee_location,
    event?.committee?.location,
    event?.committeeAddress,
    event?.committeeAddr,
    event?.committee?.address
  );
  const locationAddress = committeeAddress || address;
  const phone = firstValue(contact.phone, contact.mobile, event?.contactNumber, event?.mdPhone, event?.phone, partyPhone1);
  const managingDirector = firstValue(contact.md, contact.managingDirector, event?.managingDirector, event?.mdName, partyDirector);
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
  const partyLogo = firstValue(
    toLoadableUrl(partyInfo?.logo),
    toLoadableUrl(event?.logo),
    isLogoUrl(event?.poster) ? toLoadableUrl(event?.poster) : null,
    toLoadableUrl(event?.partyLogo),
    toLoadableUrl(event?.poster)
  );
  const sameYearEvents = allEvents.filter(
    (item) => String(item?.year || "") === String(event?.year || "")
  );
  const bannerCandidates = [
    event?.banner,
    event?.bannerUrl,
    event?.bannerImg,
    event?.imageUrl,
    ...asArray(event?.banners),
    ...asArray(event?.additionalBanners),
    ...asArray(event?.additional_banners),
    partyInfo?.banner,
    (!isLogoUrl(event?.poster) ? event?.poster : null),
    event?.img,
    ...sameYearEvents.flatMap((item) => [item?.banner, ...asArray(item?.banners)]),
  ];
  const displayBanners = [
    ...new Set(
      bannerCandidates
        .map(toLoadableUrl)
        .filter((url) => Boolean(url) && !isLogoUrl(url))
    ),
  ];
  const topBanner = displayBanners[0] || toLoadableUrl(event?.banner) || null;

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

  const expiryInfo = getEventExpiryInfo(event);

  const handleBookTicketNow = () => {
    if (expiryInfo.isExpired) {
      alert(`This event is expired on date ${expiryInfo.formattedDate}. Ticket booking is closed.`);
      return;
    }
    const eventName = event?.name || event?.eventTitle || "Event";
    const eventId = event?.key || id;
    const date = event?.date || "";
    const time = event?.time || "";
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (eventName) params.set("event", eventName);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    params.set("block", "B1");
    // Direct guest navigation: unhindered view of stage and seat rows
    const seatsUrl = `/seats?${params.toString()}`;
    window.location.href = seatsUrl;
  };

  return (
    <div className="standalone-detail-page bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 sm:pb-28 shadow-2xl flex flex-col overflow-hidden">
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
          {/* Expired Event Banner */}
          {expiryInfo.isExpired && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <i className="fa-solid fa-calendar-xmark text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                  Show Completed • Booking Closed
                </span>
                <p className="text-xs font-black text-rose-950 mt-1">
                  This event is expired on date {expiryInfo.formattedDate}
                </p>
              </div>
            </div>
          )}

          {/* Event Name & Party Tag */}
          <div>
            <h1 className="text-xl font-black text-slate-900 font-brand">{event?.name || "Event"}</h1>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">{partyName || event?.partyName || event?.organizer || "Santali Opera Show"}</p>
          </div>

          {/* =========================================================
              OPERA TROUPE / PARTY DETAILS CARD
              Displays traditional troupe details: Dir, Writer, Phones, Location, Genre
             ========================================================= */}
          {partyName && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎭</span>
                  <h3 className="text-sm font-black text-slate-900 font-brand">Opera Troupe / Party</h3>
                </div>
                <Link
                  href="/parties"
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1 active:scale-95 transition-transform"
                >
                  All Parties <i className="fa-solid fa-arrow-right text-[8px]" />
                </Link>
              </div>

              <div className="flex items-start gap-3">
                {/* Troupe Logo or Colored Monogram Avatar */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200/80 shadow-xs relative flex items-center justify-center">
                  {partyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={partyLogo}
                      alt={partyName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-full h-full ${partyLogo ? "hidden" : "flex"} items-center justify-center bg-gradient-to-tr ${partyColor} text-white font-black text-lg uppercase select-none`}
                  >
                    {partyName.slice(0, 2)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 font-brand leading-tight">
                    {partyName}
                  </h4>
                  {partyGenre && (
                    <span className="inline-block text-[9px] font-bold text-indigo-700 bg-indigo-50 rounded-md px-1.5 py-0.5 mt-1 border border-indigo-100">
                      {partyGenre}
                    </span>
                  )}
                  {partyLocation && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1.5 truncate">
                      <i className="fa-solid fa-location-dot text-rose-500 text-[10px] flex-shrink-0" />
                      <span className="truncate">{partyLocation}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Director & Writer Details */}
              {(partyDirector || partyWriter) && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {partyDirector ? (
                    <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <i className="fa-solid fa-user-tie text-indigo-500 text-[9px]" />
                        <span>Director</span>
                      </div>
                      <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{partyDirector}</p>
                    </div>
                  ) : null}
                  {partyWriter ? (
                    <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <i className="fa-solid fa-feather-pointed text-purple-500 text-[9px]" />
                        <span>Writer</span>
                      </div>
                      <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{partyWriter}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Troupe Contact Numbers & Direct Call Action */}
              {partyPhones.length > 0 && (
                <div className="bg-indigo-50/60 rounded-xl p-2.5 border border-indigo-100/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-phone text-xs" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Troupe Contact</p>
                      <p className="text-xs font-mono font-bold text-slate-800 truncate mt-0.5">
                        {partyPhones.join(" / ")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`tel:${partyPhones[0].replace(/[^\d+]/g, "")}`}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
                  >
                    <i className="fa-solid fa-phone-volume text-[10px]" />
                    <span>Call</span>
                  </a>
                </div>
              )}

              {event?.isPartyOnly && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-[11px] text-amber-900 flex items-start gap-2">
                  <i className="fa-solid fa-circle-info text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Troupe Booking & Performance Enquiries</p>
                    <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                      Online ticketed shows for this troupe will be announced soon. For village festival dates, committee bookings, or stage performances, contact the troupe management directly via the numbers above.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Book Ticket Now / Expired State */}
          {expiryInfo.isExpired ? (
            <div className="space-y-2.5">
              <div className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 text-rose-600 font-black text-xs uppercase tracking-wide">
                  <i className="fa-solid fa-ban" />
                  <span>Booking Closed</span>
                </div>
                <p className="text-xs font-black text-slate-800">
                  This event is expired on date {expiryInfo.formattedDate}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Seat selection and ticket booking are unavailable for completed shows.
                </p>
              </div>
              <Link
                href="/events"
                className="w-full bg-[#12193b] hover:bg-[#1a2350] text-white font-extrabold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <i className="fa-solid fa-calendar-days text-amber-400" />
                <span>Explore Upcoming Events</span>
              </Link>
            </div>
          ) : event?.isPartyOnly ? (
            <a
              href={`tel:${(partyPhone1 || partyPhones[0] || "").replace(/[^\d+]/g, "")}`}
              className="btn-book-ticket-glow w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-base py-3.5 rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer border-0 select-none hover:brightness-110"
            >
              <i className="fa-solid fa-phone-volume text-xl" />
              <span className="tracking-wide uppercase text-sm sm:text-base font-black drop-shadow-sm">Call Troupe for Bookings</span>
            </a>
          ) : (
            <button
              onClick={handleBookTicketNow}
              className="btn-book-ticket-glow w-full bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white font-black text-base py-3.5 rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer border-0 select-none hover:brightness-110"
            >
              <i className="fa-solid fa-ticket ticket-icon-wiggle text-xl" />
              <span className="tracking-wide uppercase text-sm sm:text-base font-black drop-shadow-sm">Book Ticket Now</span>
              <i className="fa-solid fa-angles-right text-xs ml-0.5 animate-pulse" />
            </button>
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
        </div>

        {/* Login Required Modal */}
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Login First to Book Tickets"
          message="You can freely view all event details, cast, and schedules. However, you must log in to your account before you can book tickets."
        />

        <BottomNav active="events" />
      </div>
    </div>
  );
}
