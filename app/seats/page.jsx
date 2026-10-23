"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ChairSvg from "../components/ChairSvg";
import UserSeatGrid from "../components/UserSeatGrid";
import MovingSpotlights from "../components/MovingSpotlights";
import { subscribeSeats, BLOCK_GROUPS, holdSeat, releaseSeatHold, getHoldSessionId, isHoldFresh } from "../../lib/seats";
import { fetchEvents, getEventExpiryInfo } from "../../lib/events";
import {
  subscribeBlockCategories,
  isBlockOnline,
  blockDisplayName,
  blockChannelText,
} from "../../lib/blockCategories";
import { getSavedCustomerProfile } from "../../lib/supabase";
import { getPriceForRow } from "../../lib/ticketTypes";
import LoginRequiredModal from "../components/LoginRequiredModal";

const EVENT_ID_KEY = "jatra:eventId";
const HOLD_KEY = "jatra:seatHold";

function roundedPolygon(pointsStr, radius = 10) {
  const pts = pointsStr.trim().split(/\s+/).map((p) => {
    const parts = p.split(",").map(Number);
    return { x: parts[0], y: parts[1] };
  });
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const vPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const lenPrev = Math.hypot(vPrev.x, vPrev.y);
    const vNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenNext = Math.hypot(vNext.x, vNext.y);
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);
    const start = {
      x: (curr.x + (vPrev.x / lenPrev) * r).toFixed(1),
      y: (curr.y + (vPrev.y / lenPrev) * r).toFixed(1),
    };
    const end = {
      x: (curr.x + (vNext.x / lenNext) * r).toFixed(1),
      y: (curr.y + (vNext.y / lenNext) * r).toFixed(1),
    };
    if (i === 0) {
      d += `M ${start.x},${start.y} `;
    } else {
      d += `L ${start.x},${start.y} `;
    }
    d += `Q ${curr.x},${curr.y} ${end.x},${end.y} `;
  }
  return d + "Z";
}

function SeatSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId") || "";
  const blockParam = searchParams.get("block") || "";
  const [eventId, setEventId] = useState(eventIdParam);
  const [eventName, setEventName] = useState(searchParams.get("event") || "Event");
  const [currentEventData, setCurrentEventData] = useState(null);
  const [eventOptions, setEventOptions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeBlock, setActiveBlock] = useState(blockParam || "B1");
  const [showSeatPanel, setShowSeatPanel] = useState(true);
  const [showBlockSelector, setShowBlockSelector] = useState(true);
  const [clickedFromMap, setClickedFromMap] = useState(!!blockParam);
  const [seatsByBlock, setSeatsByBlock] = useState({});
  const [loading, setLoading] = useState(true);
  const [eventReady, setEventReady] = useState(!!eventIdParam);
  const [blockCats, setBlockCats] = useState([]);
  const [counterNotice, setCounterNotice] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const seatGridRef = useRef(null);

  // Live block-category config from Supabase (source of truth)
  useEffect(() => subscribeBlockCategories(setBlockCats), []);

  const isOnlineBlock = (id) => isBlockOnline(blockCats, id);
  const blockLabel = (id) => blockDisplayName(blockCats, id);

  // If currently active block is switched to counter-only via Supabase Realtime, deselect it
  useEffect(() => {
    if (activeBlock && blockCats.length > 0 && !isOnlineBlock(activeBlock)) {
      selected.forEach((k) => releaseSeatHold(eventId, activeBlock, k));
      setSelected([]);
      setActiveBlock(null);
      setShowSeatPanel(false);
      setCounterNotice("This block is available for counter booking only. Please select another block.");
      setTimeout(() => setCounterNotice(""), 5000);
    }
  }, [activeBlock, blockCats, eventId]);
  // Diagram sub-label: "Counter" (amber) when counter selling, "Online" (sky) otherwise.
  const subLabel = (id) => blockChannelText(blockCats, id);
  const channelColor = (id) => (isOnlineBlock(blockCats, id) ? "#dcfce7" : "#fffbeb");
  // Diagram block colours: fully sold out (booked or fresh holds) → red,
  // Counter → yellow, Online → green.
  const blockFill = (id) => {
    const list = seatsByBlock[id] || [];
    const seatTaken = (s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "booked" || st === "sold") return true;
      if (st === "reserved" && isHoldFresh(s)) return true;
      return false;
    };
    if (list.length && list.every(seatTaken)) return "#ef4444";
    return isOnlineBlock(id) ? "#16a34a" : "#d97706";
  };

  const findSeatInBlock = (blockId, key) => {
    const list = seatsByBlock[blockId] || [];
    return list.find(
      (s) =>
        s.id === key ||
        s.seatLabel === key ||
        `${s.rowId}-${s.seatNumber}` === key ||
        `${s.rowId}${s.seatNumber}` === key
    );
  };

  const findFsSeat = (blockId, key) => findSeatInBlock(blockId, key);

  const getSeatRealPrice = useCallback(
    (key) => {
      const fs = findSeatInBlock(activeBlock, key);
      if (fs?.price != null && Number(fs.price) > 50) return Number(fs.price);
      const rowId =
        fs?.rowId ||
        String(key).split("-")[1] ||
        String(key).replace(/\d+$/, "");
      return getPriceForRow(rowId);
    },
    [activeBlock, seatsByBlock]
  );

  const selectedTotal = (selected || []).reduce(
    (sum, k) => sum + getSeatRealPrice(k),
    0
  );

  const seatPrice =
    selected.length > 0
      ? Math.round(selectedTotal / selected.length)
      : (seatsByBlock[activeBlock] || []).find((s) => s.price != null && Number(s.price) > 50)?.price ||
        getPriceForRow("A");

  const getSelectedRowLetters = () => {
    if (!selected.length) return "";
    const letters = selected.map((key) => {
      const fs = findSeatInBlock(activeBlock, key);
      if (fs?.rowId) return fs.rowId;
      return String(key).split("-")[0] || String(key).replace(/\d+$/, "");
    });
    return [...new Set(letters)].join(", ");
  };
  const selectedRows = getSelectedRowLetters();

  // Live seat subscription — any change in the admin panel (new rows,
  // bookings, cancellations) streams straight into this grid without a refresh.
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    let firstSnapshot = true;
    const unsubscribe = subscribeSeats(eventId, (seats) => {
      setSeatsByBlock(seats);
      if (firstSnapshot) {
        firstSnapshot = false;
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [eventId]);

  // Auto-select first available block with seats if none is selected
  useEffect(() => {
    if (!activeBlock && Object.keys(seatsByBlock).length > 0) {
      const firstWithSeats = Object.keys(seatsByBlock).find(
        (b) => (seatsByBlock[b] || []).length > 0
      );
      if (firstWithSeats) {
        setActiveBlock(firstWithSeats);
        setShowSeatPanel(true);
        setShowBlockSelector(true);
        setClickedFromMap(true);
      }
    }
  }, [seatsByBlock, activeBlock]);

  // Resolve event and event details
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = "";
      try {
        saved = window.localStorage.getItem(EVENT_ID_KEY) || "";
      } catch (error) {
        saved = "";
      }
      const targetId = eventIdParam || eventId || saved;
      if (saved && !eventId) setEventId(saved);

      try {
        const list = await fetchEvents();
        if (cancelled) return;
        const opts = list
          .filter((e) => e?.key)
          .map((e) => ({ id: e.key, name: e.name || e.eventTitle || e.key }));
        setEventOptions(opts);

        const matched = list.find((e) => e.key === targetId || e.id === targetId) || list[0];
        if (matched) {
          setCurrentEventData(matched);
          if (!eventId) {
            setEventId(matched.key || matched.id);
            setEventName(matched.name || matched.eventTitle || "Event");
            try {
              window.localStorage.setItem(EVENT_ID_KEY, matched.key || matched.id);
            } catch (error) {
              /* ignore */
            }
          }
        }
      } catch (error) {
        console.error("Error loading events for seat map:", error);
      } finally {
        if (!cancelled) setEventReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventIdParam, eventId]);

  // No event could be resolved → stop the loading state
  useEffect(() => {
    if (eventReady && !eventId) setLoading(false);
  }, [eventReady, eventId]);

  const chooseEvent = (opt) => {
    selected.forEach((k) => releaseSeatHold(eventId, activeBlock, k));
    setEventId(opt.id);
    setEventName(opt.name);
    setSelected([]);
    setActiveBlock(null);
    setShowBlockSelector(false);
    setClickedFromMap(false);
    setSeatsByBlock({});
    try {
      window.localStorage.setItem(EVENT_ID_KEY, opt.id);
    } catch (error) {
      /* ignore */
    }
    window.history.replaceState(
      null,
      "",
      `/seats?event=${encodeURIComponent(opt.name)}&eventId=${opt.id}`
    );
  };

  const toggleSeat = useCallback((key) => {
    const profile = getSavedCustomerProfile();
    if (!profile || !profile.full_name) {
      setShowLoginModal(true);
      return;
    }
    if (!activeBlock || !isOnlineBlock(activeBlock)) {
      setCounterNotice("This block is available for counter booking only. Please select another block.");
      setTimeout(() => setCounterNotice(""), 4500);
      return;
    }
    const fs = findFsSeat(activeBlock, key);
    const st = String(fs?.status || "").toLowerCase();
    const sid = getHoldSessionId();
    if (fs && (st === "booked" || st === "locked")) return;
    // Freshly reserved by another session (someone else mid-checkout) → blocked.
    if (fs && st === "reserved" && fs.reservedBy !== sid && isHoldFresh(fs)) return;
    const removing = selected.includes(key);
    if (!removing && selected.length >= 10) return;
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 10) return prev;
      return [...prev, key];
    });
    if (removing) {
      releaseSeatHold(eventId, activeBlock, key);
    } else {
      holdSeat(eventId, activeBlock, key);
    }
  }, [activeBlock, selected, eventId, seatsByBlock, blockCats]);

  const handleBlockSelect = (blockId) => {
    if (!isOnlineBlock(blockId)) {
      setCounterNotice(`This block is available for counter booking only. Please select another block.`);
      setTimeout(() => setCounterNotice(""), 4500);
      return;
    }
    if (activeBlock !== blockId) {
      selected.forEach((k) => releaseSeatHold(eventId, activeBlock, k));
      setSelected([]);
    }
    setActiveBlock(blockId);
    setShowSeatPanel(true);
    setClickedFromMap(true);
    setShowBlockSelector(true);

    setTimeout(() => {
      seatGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Persist the in-progress hold so navigating back to this page restores the
  // selection (seats stay reserved for this session until paid or expired).
  useEffect(() => {
    if (!eventReady || !eventId) return;
    try {
      if (selected.length && activeBlock) {
        window.sessionStorage.setItem(
          HOLD_KEY,
          JSON.stringify({ eventId, block: activeBlock, keys: selected })
        );
      } else {
        window.sessionStorage.removeItem(HOLD_KEY);
      }
    } catch (e) {
      /* ignore */
    }
  }, [selected, activeBlock, eventId, eventReady]);

  useEffect(() => {
    if (!eventReady || !eventId) return;
    try {
      const raw = window.sessionStorage.getItem(HOLD_KEY);
      if (!raw) return;
      const h = JSON.parse(raw);
      if (h?.eventId === eventId && h?.block && Array.isArray(h.keys) && h.keys.length) {
        setActiveBlock(h.block);
        setSelected(h.keys);
        setShowSeatPanel(true);
        setShowBlockSelector(true);
        setClickedFromMap(true);
      }
    } catch (e) {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventReady]);

  // Give the holds back when the tab/page actually closes (abandoned checkout).
  useEffect(() => {
    const releaseAll = () => {
      try {
        const raw = window.sessionStorage.getItem(HOLD_KEY);
        if (!raw) return;
        const h = JSON.parse(raw);
        if (h?.eventId && h?.block && Array.isArray(h.keys)) {
          h.keys.forEach((k) => releaseSeatHold(h.eventId, h.block, k));
        }
        window.sessionStorage.removeItem(HOLD_KEY);
      } catch (e) {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", releaseAll);
    return () => window.removeEventListener("pagehide", releaseAll);
  }, []);

  const getAvailableBlocks = () => {
    const fsBlocks = Object.keys(seatsByBlock)
      .filter((b) => (seatsByBlock[b] || []).length > 0)
      .sort();
    // Venue layout (same as the map) + any extra blocks admin created
    const all = {
      rightSide: [
        ...new Set([...BLOCK_GROUPS.rightSide, ...fsBlocks.filter((b) => /^A/i.test(b))]),
      ],
      frontCenter: [
        ...new Set([...BLOCK_GROUPS.frontCenter, ...fsBlocks.filter((b) => /^B/i.test(b))]),
      ],
      leftSide: [
        ...new Set([...BLOCK_GROUPS.leftSide, ...fsBlocks.filter((b) => /^C/i.test(b))]),
      ],
    };
    const extra = fsBlocks.filter(
      (b) =>
        !all.rightSide.includes(b) &&
        !all.frontCenter.includes(b) &&
        !all.leftSide.includes(b)
    );
    if (extra.length) all.frontCenter = [...all.frontCenter, ...extra];

    // Online app: hide blocks that are counter-only in the admin panel.
    all.rightSide = all.rightSide.filter(isOnlineBlock);
    all.frontCenter = all.frontCenter.filter(isOnlineBlock);
    all.leftSide = all.leftSide.filter(isOnlineBlock);

    if (!activeBlock) return all;

    // Always show only the section of the selected block (A = right, B = front, C = left)
    const letter = String(activeBlock).trim().charAt(0).toUpperCase();
    const section =
      letter === "A" ? "rightSide" : letter === "B" ? "frontCenter" : letter === "C" ? "leftSide" : null;
    if (!section) return all;

    return {
      rightSide: section === "rightSide" ? all.rightSide : [],
      frontCenter: section === "frontCenter" ? all.frontCenter : [],
      leftSide: section === "leftSide" ? all.leftSide : [],
    };
  };

  const getBlockStats = (blockId) => {
    const fsSeats = seatsByBlock[blockId] || [];
    const available = fsSeats.filter(
      (s) =>
        !s.status ||
        s.status === "available" ||
        (s.status === "reserved" && !isHoldFresh(s))
    ).length;
    return { total: fsSeats.length, available };
  };

  // Group Firestore seats by row for data-driven rendering
  const getFsRows = (blockId) => {
    const list = seatsByBlock[blockId] || [];
    if (!list.length) return null;
    const byRow = {};
    list.forEach((s) => {
      const rid = s.rowId || "A";
      if (!byRow[rid]) byRow[rid] = [];
      byRow[rid].push(s);
    });
    return Object.keys(byRow)
      .sort()
      .map((rid) => ({
        id: rid,
        seats: byRow[rid].sort(
          (a, b) =>
            (a.displayIndex ?? a.seatNumber ?? 0) -
            (b.displayIndex ?? b.seatNumber ?? 0)
        ),
      }));
  };

  const expiryInfo = getEventExpiryInfo(
    currentEventData || {
      date: searchParams.get("date"),
      time: searchParams.get("time"),
    }
  );

  if (expiryInfo.isExpired) {
    return (
      <div className="min-h-screen bg-[#f8faff] flex flex-col items-center justify-center p-6 text-center text-slate-800">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-3xl mb-4 shadow-xs">
          <i className="fa-solid fa-calendar-xmark" />
        </div>
        <h2 className="text-xl font-black text-slate-900 font-brand">Event Expired</h2>
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 mt-3 max-w-sm">
          <p className="text-xs font-black text-rose-700">
            This event is expired on date {expiryInfo.formattedDate}
          </p>
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-sm font-medium">
          Ticket bookings and seat selection are closed for completed shows.
        </p>
        <button
          onClick={() => router.push("/events")}
          className="mt-6 bg-[#12193b] hover:bg-[#1a2350] text-white font-extrabold text-xs py-3 px-6 rounded-xl shadow-md transition-all active:scale-95"
        >
          View Upcoming Events
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <style jsx>{`
        .block-path {
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .block-path:hover {
          filter: drop-shadow(0 0 10px rgba(56, 189, 248, 1));
          opacity: 0.95;
        }
        .block-path text {
          fill: #ffffff !important;
          stroke: none !important;
        }
        .block-active {
          stroke: #38bdf8 !important;
          stroke-width: 4 !important;
          filter: drop-shadow(0 0 14px rgba(56, 189, 248, 1)) !important;
          animation: pulse-glow 2s infinite ease-in-out;
        }
        .block-off {
          opacity: 0.85;
          cursor: pointer;
        }
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            filter: brightness(1) drop-shadow(0 0 14px rgba(56, 189, 248, 0.9));
          }
          50% {
            opacity: 0.9;
            filter: brightness(1.2) drop-shadow(0 0 20px rgba(56, 189, 248, 1));
          }
        }
      `}</style>
      <div className="bg-[#f8faff] min-h-screen relative pb-28 shadow-2xl flex flex-col overflow-hidden">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-700 shadow-md border border-slate-200 text-sm active:scale-95 transition-transform"
        >
          <i className="fa-solid fa-arrow-left" />
        </button>

        <div className="flex-1 p-4 space-y-4">
          {/* Block Selection Map */}
          <div className="w-full bg-transparent p-0 space-y-2">
            {eventOptions.length > 1 && (
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {eventOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => chooseEvent(opt)}
                    className={`text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full border transition-all ${
                      eventId === opt.id
                        ? "bg-sky-500 border-sky-300 text-white"
                        : "bg-white border-slate-300 text-slate-700 shadow-xs"
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )}
            <h2 className="text-center text-lg font-black text-slate-900 font-brand mb-1">
              {eventName} - Seating Map
            </h2>
            <p className="text-center text-slate-500 text-xs mb-3">
              Click on any block (especially <span className="text-emerald-600 font-semibold">Block B1</span>) to view and book seats
            </p>
            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 mb-2.5 flex items-center justify-around text-xs font-bold text-slate-200 shadow-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#16a34a] inline-block shadow-xs" />
                <span>Online</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#d97706] inline-block shadow-xs" />
                <span>Counter</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#ef4444] inline-block shadow-xs" />
                <span>All Booked</span>
              </span>
            </div>
            
            <div className="rounded-2xl overflow-hidden shadow-md border border-slate-700/80 bg-[#0f172a]">
              <svg
                viewBox="0 0 1000 900"
                className="w-full h-auto select-none block"
                xmlns="http://www.w3.org/2000/svg"
              >
              {/* Definitions for gradients */}
              <defs>
                <linearGradient id="stageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
                  <stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="stageBorderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="1" />
                  <stop offset="50%" stopColor="#f472b6" stopOpacity="1" />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Background */}
              <rect width="1000" height="900" fill="#0f172a" rx="20" />

              {/* STAGE (Center Top) */}
              <g>
                <rect
                  x="370"
                  y="40"
                  width="260"
                  height="360"
                  fill="url(#stageGradient)"
                  stroke="url(#stageBorderGradient)"
                  strokeWidth="4"
                  rx="14"
                />
                <MovingSpotlights idPrefix="seats" />
                <text
                  x="500"
                  y="185"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="28"
                  fontWeight="bold"
                  letterSpacing="2"
                  style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85)" }}
                >
                  STAGE
                </text>
                <text
                  x="500"
                  y="220"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="14"
                  letterSpacing="4"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}
                >
                  FRONT
                </text>
              </g>

              {/* BLOCK C2 (Top Left) */}
              <g onClick={() => handleBlockSelect('C2')} className={`block-path ${activeBlock === 'C2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <rect
                  x="40"
                  y="40"
                  width="310"
                  height="190"
                  fill={blockFill('C2')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="12"
                />
                <text x="195" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('C2')}</text>
                <text x="195" y="165" textAnchor="middle" fill={channelColor('C2')} fontSize="14" pointerEvents="none">
                  {subLabel('C2')}
                </text>
              </g>

              {/* BLOCK A2 (Top Right) */}
              <g onClick={() => handleBlockSelect('A2')} className={`block-path ${activeBlock === 'A2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <rect
                  x="650"
                  y="40"
                  width="310"
                  height="190"
                  fill={blockFill('A2')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="12"
                />
                <text x="805" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('A2')}</text>
                <text x="805" y="165" textAnchor="middle" fill={channelColor('A2')} fontSize="14" pointerEvents="none">
                  {subLabel('A2')}
                </text>
              </g>

              {/* BLOCK C3 (Outer Left) */}
              <g onClick={() => handleBlockSelect('C3')} className={`block-path ${activeBlock === 'C3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("40,250 170,250 170,680 40,840", 12)}
                  fill={blockFill('C3')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="105" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('C3')}</text>
                <text x="105" y="550" textAnchor="middle" fill={channelColor('C3')} fontSize="14" pointerEvents="none">
                  {subLabel('C3')}
                </text>
              </g>

              {/* BLOCK C1 (Inner Left) */}
              <g onClick={() => handleBlockSelect('C1')} className={`block-path ${activeBlock === 'C1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("190,250 350,250 350,420 190,660", 12)}
                  fill={blockFill('C1')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="270" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('C1')}</text>
                <text x="270" y="470" textAnchor="middle" fill={channelColor('C1')} fontSize="14" pointerEvents="none">
                  {subLabel('C1')}
                </text>
              </g>

              {/* BLOCK A1 (Inner Right) */}
              <g onClick={() => handleBlockSelect('A1')} className={`block-path ${activeBlock === 'A1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("650,250 810,250 810,660 650,420", 12)}
                  fill={blockFill('A1')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="730" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('A1')}</text>
                <text x="730" y="470" textAnchor="middle" fill={channelColor('A1')} fontSize="14" pointerEvents="none">
                  {subLabel('A1')}
                </text>
              </g>

              {/* BLOCK A3 (Outer Right) */}
              <g onClick={() => handleBlockSelect('A3')} className={`block-path ${activeBlock === 'A3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("830,250 960,250 960,840 830,680", 12)}
                  fill={blockFill('A3')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="895" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('A3')}</text>
                <text x="895" y="550" textAnchor="middle" fill={channelColor('A3')} fontSize="14" pointerEvents="none">
                  {subLabel('A3')}
                </text>
              </g>

              {/* BLOCK B1 (Main Center Front Trapezoid) */}
              <g onClick={() => handleBlockSelect('B1')} className={`block-path ${activeBlock === 'B1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("370,420 630,420 780,660 220,660", 12)}
                  fill={blockFill('B1')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="500" y="540" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('B1')}</text>
                <text x="500" y="575" textAnchor="middle" fill={channelColor('B1')} fontSize="14" pointerEvents="none">
                  {subLabel('B1')}
                </text>
              </g>

              {/* BLOCK B2 (Bottom Left) */}
              <g onClick={() => handleBlockSelect('B2')} className={`block-path ${activeBlock === 'B2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("200,680 480,680 480,860 60,860", 12)}
                  fill={blockFill('B2')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="290" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('B2')}</text>
                <text x="290" y="800" textAnchor="middle" fill={channelColor('B2')} fontSize="14" pointerEvents="none">
                  {subLabel('B2')}
                </text>
              </g>

              {/* BLOCK B3 (Bottom Right) */}
              <g onClick={() => handleBlockSelect('B3')} className={`block-path ${activeBlock === 'B3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <path
                  d={roundedPolygon("520,680 800,680 940,860 520,860", 12)}
                  fill={blockFill('B3')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="710" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('B3')}</text>
                <text x="710" y="800" textAnchor="middle" fill={channelColor('B3')} fontSize="14" pointerEvents="none">
                  {subLabel('B3')}
                </text>
              </g>
            </svg>
            </div>
          </div>
          {/* Stage Area - Top Center */}
          <div className="flex flex-col items-center">
            {showBlockSelector && !loading && eventReady && (
              <div className="w-[95%] max-w-lg bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden mb-4">
                <div className="bg-[#12193b] text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-shapes text-sky-400 text-xs" />
                    <span className="text-xs font-black uppercase tracking-wider">Select Block</span>
                  </div>
                  {activeBlock && (
                    <span className="bg-sky-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-md uppercase">
                      Block {activeBlock}
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 flex flex-col items-center">
                <div className="text-center mb-3">
                  <p className="text-xs text-slate-600 font-medium">
                    {activeBlock
                      ? `You selected Block ${activeBlock}. Available blocks in this section are shown below.`
                      : 'Select a block from the map above or choose directly:'}
                  </p>
                </div>
                <div className="relative w-full flex items-center justify-center leading-none flex-wrap gap-2">
                  {(() => {
                    const availableBlocks = getAvailableBlocks();
                    return (
                      <>
                        {/* Right Side Blocks */}
                        {availableBlocks.rightSide.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            {availableBlocks.rightSide.map((letter) => (
                              <button
                                key={letter}
                                onClick={() => {
                                  setActiveBlock(letter);
                                  setSelected([]);
                                  setClickedFromMap(false);
                                }}
                                aria-label={`Select block ${letter}`}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-black font-brand uppercase drop-shadow transition-all active:scale-95 ${
                                  activeBlock === letter
                                    ? "bg-rose-400 text-slate-900 scale-110 shadow-lg border-2 border-rose-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {letter}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Front Center Blocks */}
                        {availableBlocks.frontCenter.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            {availableBlocks.frontCenter.map((letter) => (
                              <button
                                key={letter}
                                onClick={() => {
                                  setActiveBlock(letter);
                                  setSelected([]);
                                  setClickedFromMap(false);
                                }}
                                aria-label={`Select block ${letter}`}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-black font-brand uppercase drop-shadow transition-all active:scale-95 ${
                                  activeBlock === letter
                                    ? "bg-amber-400 text-slate-900 scale-110 shadow-lg border-2 border-amber-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {letter}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Left Side Blocks */}
                        {availableBlocks.leftSide.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            {availableBlocks.leftSide.map((letter) => (
                              <button
                                key={letter}
                                onClick={() => {
                                  setActiveBlock(letter);
                                  setSelected([]);
                                  setClickedFromMap(false);
                                }}
                                aria-label={`Select block ${letter}`}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-black font-brand uppercase drop-shadow transition-all active:scale-95 ${
                                  activeBlock === letter
                                    ? "bg-emerald-400 text-slate-900 scale-110 shadow-lg border-2 border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {letter}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="flex gap-0.5.5 mt-2 w-full">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 text-center flex-1 min-w-0">
                    <span className="text-sm font-black text-slate-900 block">{getBlockStats(activeBlock).total}</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Total Seat</span>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 text-center flex-1 min-w-0">
                    <span className="text-sm font-black text-emerald-600 block">{getBlockStats(activeBlock).available}</span>
                    <span className="text-[8px] font-bold text-emerald-500 uppercase">Available</span>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 text-center flex-1 min-w-0">
                    <span className="text-sm font-black text-red-500 block">{getBlockStats(activeBlock).total - getBlockStats(activeBlock).available}</span>
                    <span className="text-[8px] font-bold text-red-400 uppercase">Booked</span>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>

          {/* UserSeatGrid: Reactive real-time seat availability map */}
          <div ref={seatGridRef} id="seat-grid-container" className="scroll-mt-6 pt-1 -mx-2 sm:mx-0">
            <UserSeatGrid
              showId={eventId}
              eventId={eventId}
              activeBlock={activeBlock}
              selected={selected}
              onToggleSeat={toggleSeat}
              disabled={false}
              seatsByBlock={seatsByBlock}
              loading={loading}
              seatPrice={seatPrice}
            />
          </div>

          <p className="text-center text-[11px] text-slate-400 font-medium">
            Tap a seat to select. Block: <span className="font-black text-amber-600">{activeBlock || "-"}</span> • Selected: <span className="font-black text-amber-600">{selected.length}</span>
          </p>
        </div>

        {/* Bottom Summary + CTA - only after a seat is selected */}
        {activeBlock && selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-2xl p-4 bg-white border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] space-y-2.5">
          {/* Calculation Bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
              <span className="flex-shrink-0 bg-indigo-950 text-white font-black text-[10px] px-2 py-1 rounded-md">
                Block {activeBlock}
              </span>
              <div className="flex flex-wrap gap-1 min-w-0">
                {selected.length > 0 ? selected.map((s) => {
                  const fs = findFsSeat(activeBlock, s);
                  const displayLabel = fs
                    ? fs.seatLabel || `${fs.rowId}-${fs.seatNumber}`
                    : s;
                  return (
                    <span key={s} className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                      {displayLabel}
                    </span>
                  );
                }) : <span className="text-slate-400 text-[10px]">No seat selected</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">Total Amount</p>
              <p className="text-base font-black text-emerald-600 leading-tight">₹{selectedTotal}</p>
              <p className="text-[8px] text-slate-400 font-medium">Extra charges shown on next step</p>
            </div>
          </div>

          <button
            onClick={() => {
              // Always pass Firestore doc ids: row-seatNumber (e.g. A-9, A-10)
              const displaySeats = selected.map((key) => {
                const fs = findFsSeat(activeBlock, key);
                if (fs) {
                  return fs.id || `${fs.rowId}-${fs.seatNumber}`;
                }
                if (key.includes("-")) return key;
                const m = String(key).match(/^([A-Za-z]+)(\d+)$/);
                if (m) return `${m[1].toUpperCase()}-${m[2]}`;
                return key;
              });
              const eventDate = currentEventData?.date || "";
              const eventTime = currentEventData?.time || "";
              const targetUrl = `/book?event=${encodeURIComponent(eventName)}&eventId=${eventId}&date=${encodeURIComponent(eventDate)}&time=${encodeURIComponent(eventTime)}&block=${activeBlock}&seats=${displaySeats.join(',')}&seatPrice=${seatPrice}`;
              const profile = getSavedCustomerProfile();
              if (!profile || !profile.full_name) {
                setShowLoginModal(true);
                return;
              } else {
                router.push(targetUrl);
              }
            }}
            disabled={selected.length === 0}
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-ticket -rotate-12 text-base" />
            <span>Continue with {selected.length > 0 ? `${selected.length} seat${selected.length > 1 ? "s" : ""} • ₹${selectedTotal}` : "seat selection"}</span>
            <i className="fa-solid fa-chevron-right text-xs ml-1" />
          </button>
        </div>
        )}

        {/* Counter Notice Toast */}
        {/* Login Required Modal */}
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Please Register or Log In First"
          message="You can freely explore all seat rows, stage layout, and event details. Please register or log in first, then you can book seat tickets."
          actionText="Register / Log In to Book"
        />

        {counterNotice && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-amber-500 text-slate-950 font-black text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-amber-400 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <i className="fa-solid fa-store text-base text-amber-950 flex-shrink-0" />
              <span className="truncate">{counterNotice}</span>
            </div>
            <button
              onClick={() => setCounterNotice("")}
              className="w-5 h-5 rounded-full bg-amber-600/30 hover:bg-amber-600/50 flex items-center justify-center text-slate-950 flex-shrink-0"
            >
              <i className="fa-solid fa-xmark text-[11px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { default as UserSeatGrid } from "../components/UserSeatGrid";

export default function SeatSelectionPage() {
  return (
    <Suspense fallback={null}>
      <SeatSelectionContent />
    </Suspense>
  );
}
