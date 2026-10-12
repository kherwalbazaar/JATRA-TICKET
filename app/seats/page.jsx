"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ChairSvg from "../components/ChairSvg";
import UserSeatGrid from "../components/UserSeatGrid";
import { subscribeSeats, BLOCK_GROUPS, holdSeat, releaseSeatHold, getHoldSessionId, isHoldFresh } from "../../lib/seats";
import { fetchEvents } from "../../lib/events";
import {
  subscribeBlockCategories,
  isBlockOnline,
  blockDisplayName,
  blockChannelText,
} from "../../lib/blockCategories";

const EVENT_ID_KEY = "jatra:eventId";
const HOLD_KEY = "jatra:seatHold";

function SeatSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId") || "";
  const [eventId, setEventId] = useState(eventIdParam);
  const [eventName, setEventName] = useState(searchParams.get("event") || "Event");
  const [currentEventData, setCurrentEventData] = useState(null);
  const [eventOptions, setEventOptions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [showSeatPanel, setShowSeatPanel] = useState(false);
  const [showBlockSelector, setShowBlockSelector] = useState(false);
  const [clickedFromMap, setClickedFromMap] = useState(false);
  const [seatsByBlock, setSeatsByBlock] = useState({});
  const [loading, setLoading] = useState(true);
  const [eventReady, setEventReady] = useState(!!eventIdParam);
  const [blockCats, setBlockCats] = useState([]);

  // Live block-category config from Firestore (admin/counter/online rules + names)
  useEffect(() => subscribeBlockCategories(setBlockCats), []);

  const isOnlineBlock = (id) => isBlockOnline(blockCats, id);
  const blockLabel = (id) => blockDisplayName(blockCats, id);
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

  const seatPrice =
    (seatsByBlock[activeBlock] || []).find((s) => s.price != null)?.price ?? 0;

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

  const toggleSeat = (key) => {
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
  };

  const handleBlockSelect = (blockId) => {
    // Blocks flipped to Counter selling in the admin panel can't be booked online.
    if (!isOnlineBlock(blockId)) return;
    selected.forEach((k) => releaseSeatHold(eventId, activeBlock, k));
    setActiveBlock(blockId);
    setSelected([]);
    setShowSeatPanel(true);
    setClickedFromMap(true);
    setShowBlockSelector(true);
  };

  // If the admin flips the selected block to Counter-only, drop the selection.
  useEffect(() => {
    if (activeBlock && blockCats.length && !isOnlineBlock(activeBlock)) {
      selected.forEach((k) => releaseSeatHold(eventId, activeBlock, k));
      setActiveBlock(null);
      setSelected([]);
      setShowSeatPanel(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockCats]);

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
    const available = fsSeats.filter((s) => s.status === "available").length;
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

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <style jsx>{`
        .block-path:hover {
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.95));
        }
        .block-path text {
          fill: #ffffff !important;
          stroke: none !important;
        }
        .block-active {
          stroke: #38bdf8 !important;
          stroke-width: 3 !important;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.9));
        }
        .block-off {
          opacity: 0.35;
          pointer-events: none;
        }
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            filter: brightness(1) drop-shadow(0 0 0 rgba(56, 189, 248, 0));
          }
          50% {
            opacity: 0.85;
            filter: brightness(1.2) drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));
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
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 shadow-lg border border-slate-700">
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
                        : "bg-slate-700 border-slate-600 text-slate-300"
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )}
            <h2 className="text-center text-lg font-black text-sky-400 font-brand mb-2">
              {eventName} - Seating Map
            </h2>
            <p className="text-center text-slate-400 text-xs mb-4">
              Click on any block (especially <span className="text-sky-300 font-semibold">Block B1</span>) to view and book seats
            </p>
            <div className="flex items-center justify-center gap-3 mb-3 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#d97706] inline-block" /> Counter</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#16a34a] inline-block" /> Online</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ef4444] inline-block" /> All Booked</span>
            </div>
            
            <svg
              viewBox="0 0 1000 900"
              className="w-full h-auto select-none"
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
                  rx="10"
                />
                <text
                  x="500"
                  y="185"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="28"
                  fontWeight="bold"
                  letterSpacing="2"
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
                >
                  FRONT
                </text>
              </g>

              {/* BLOCK C2 (Top Left) */}
              <g onClick={() => handleBlockSelect('C2')} className={`block-path ${isOnlineBlock('C2') ? '' : 'block-off '}${activeBlock === 'C2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <rect
                  x="40"
                  y="40"
                  width="310"
                  height="190"
                  fill={blockFill('C2')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="6"
                />
                <text x="195" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('C2')}</text>
                <text x="195" y="165" textAnchor="middle" fill={channelColor('C2')} fontSize="14" pointerEvents="none">
                  {subLabel('C2')}
                </text>
              </g>

              {/* BLOCK A2 (Top Right) */}
              <g onClick={() => handleBlockSelect('A2')} className={`block-path ${isOnlineBlock('A2') ? '' : 'block-off '}${activeBlock === 'A2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <rect
                  x="650"
                  y="40"
                  width="310"
                  height="190"
                  fill={blockFill('A2')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="6"
                />
                <text x="805" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('A2')}</text>
                <text x="805" y="165" textAnchor="middle" fill={channelColor('A2')} fontSize="14" pointerEvents="none">
                  {subLabel('A2')}
                </text>
              </g>

              {/* BLOCK C3 (Outer Left) */}
              <g onClick={() => handleBlockSelect('C3')} className={`block-path ${isOnlineBlock('C3') ? '' : 'block-off '}${activeBlock === 'C3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="40,250 170,250 170,680 40,840"
                  fill={blockFill('C3')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="105" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('C3')}</text>
                <text x="105" y="550" textAnchor="middle" fill={channelColor('C3')} fontSize="14" pointerEvents="none">
                  {subLabel('C3')}
                </text>
              </g>

              {/* BLOCK C1 (Inner Left) */}
              <g onClick={() => handleBlockSelect('C1')} className={`block-path ${isOnlineBlock('C1') ? '' : 'block-off '}${activeBlock === 'C1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="190,250 350,250 350,420 190,660"
                  fill={blockFill('C1')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="270" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('C1')}</text>
                <text x="270" y="470" textAnchor="middle" fill={channelColor('C1')} fontSize="14" pointerEvents="none">
                  {subLabel('C1')}
                </text>
              </g>

              {/* BLOCK A1 (Inner Right) */}
              <g onClick={() => handleBlockSelect('A1')} className={`block-path ${isOnlineBlock('A1') ? '' : 'block-off '}${activeBlock === 'A1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="650,250 810,250 810,660 650,420"
                  fill={blockFill('A1')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="730" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('A1')}</text>
                <text x="730" y="470" textAnchor="middle" fill={channelColor('A1')} fontSize="14" pointerEvents="none">
                  {subLabel('A1')}
                </text>
              </g>

              {/* BLOCK A3 (Outer Right) */}
              <g onClick={() => handleBlockSelect('A3')} className={`block-path ${isOnlineBlock('A3') ? '' : 'block-off '}${activeBlock === 'A3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="830,250 960,250 960,840 830,680"
                  fill={blockFill('A3')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="895" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('A3')}</text>
                <text x="895" y="550" textAnchor="middle" fill={channelColor('A3')} fontSize="14" pointerEvents="none">
                  {subLabel('A3')}
                </text>
              </g>

              {/* BLOCK B1 (Main Center Front Trapezoid) */}
              <g onClick={() => handleBlockSelect('B1')} className={`block-path ${isOnlineBlock('B1') ? '' : 'block-off '}${activeBlock === 'B1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="370,420 630,420 780,660 220,660"
                  fill={blockFill('B1')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="500" y="540" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('B1')}</text>
                <text x="500" y="575" textAnchor="middle" fill={channelColor('B1')} fontSize="14" pointerEvents="none">
                  {subLabel('B1')}
                </text>
              </g>

              {/* BLOCK B2 (Bottom Left) */}
              <g onClick={() => handleBlockSelect('B2')} className={`block-path ${isOnlineBlock('B2') ? '' : 'block-off '}${activeBlock === 'B2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="200,680 480,680 480,860 60,860"
                  fill={blockFill('B2')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="290" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('B2')}</text>
                <text x="290" y="800" textAnchor="middle" fill={channelColor('B2')} fontSize="14" pointerEvents="none">
                  {subLabel('B2')}
                </text>
              </g>

              {/* BLOCK B3 (Bottom Right) */}
              <g onClick={() => handleBlockSelect('B3')} className={`block-path ${isOnlineBlock('B3') ? '' : 'block-off '}${activeBlock === 'B3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="520,680 800,680 940,860 520,860"
                  fill={blockFill('B3')}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="710" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">{blockLabel('B3')}</text>
                <text x="710" y="800" textAnchor="middle" fill={channelColor('B3')} fontSize="14" pointerEvents="none">
                  {subLabel('B3')}
                </text>
              </g>
            </svg>
          </div>
          {/* Stage Area - Top Center */}
          <div className="flex flex-col items-center">
            {showBlockSelector && !loading && eventReady && (
              <div className="w-[95%] max-w-lg bg-white rounded-2xl border border-slate-200 shadow-md px-4 py-3 flex flex-col items-center mb-4">
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
            )}
          </div>

          {/* UserSeatGrid: Reactive real-time seat availability map */}
          <UserSeatGrid
            showId={eventId}
            eventId={eventId}
            activeBlock={activeBlock}
            selected={selected}
            onToggleSeat={(seatKey) => toggleSeat(seatKey)}
            disabled={!clickedFromMap}
            seatsByBlock={seatsByBlock}
            onSeatsUpdate={setSeatsByBlock}
          />

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
              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">Total</p>
              <p className="text-base font-black text-emerald-600 leading-tight">₹{selected.length * seatPrice}</p>
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
              router.push(`/book?event=${encodeURIComponent(eventName)}&eventId=${eventId}&date=${encodeURIComponent(eventDate)}&time=${encodeURIComponent(eventTime)}&block=${activeBlock}&seats=${displaySeats.join(',')}&seatPrice=${seatPrice}`);
            }}
            disabled={selected.length === 0}
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-ticket -rotate-12 text-base" />
            <span>Continue with {selected.length > 0 ? `${selected.length} seat${selected.length > 1 ? "s" : ""}` : "seat selection"}</span>
            <i className="fa-solid fa-chevron-right text-xs ml-1" />
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
