"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ChairSvg from "../components/ChairSvg";
import {
  fetchSeats,
  storeAllSeats,
  BLOCK_GROUPS,
  BLOCK_SEATS,
  generateBBlockSeats,
} from "../../lib/seats";

const blockOrder = { 
  B1: ["C1", "B1", "A1"], 
  C1: ["A1", "C1", "B1"], 
  A1: ["B1", "A1", "C1"],
  B2: ["C1", "B1", "A1"],
  B3: ["C1", "B1", "A1"],
  A2: ["C1", "B1", "A1"],
  A3: ["C1", "B1", "A1"],
  C2: ["C1", "B1", "A1"],
  C3: ["C1", "B1", "A1"]
};

const bBlockSeats = generateBBlockSeats();

function SeatSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventName = searchParams.get("event") || "Event";
  const eventId = searchParams.get("eventId") || "";
  const [selected, setSelected] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [showSeatPanel, setShowSeatPanel] = useState(false);
  const [showBlockSelector, setShowBlockSelector] = useState(false);
  const [clickedFromMap, setClickedFromMap] = useState(false);
  const [seatsByBlock, setSeatsByBlock] = useState({});
  const [loading, setLoading] = useState(true);
  const seatPrice = 100;

  const getSelectedRowLetters = () => {
    if (!selected.length) return "";
    const isBBlock = ["B", "B2", "B3"].includes(activeBlock);
    if (isBBlock && bBlockSeats[activeBlock]) {
      const rowLetters = selected.map((key) => {
        for (let ri = 0; ri < bBlockSeats[activeBlock].length; ri++) {
          const row = bBlockSeats[activeBlock][ri];
          if (row.some((s) => `${s.letter}${s.number}` === key)) {
            return String.fromCharCode(65 + ri);
          }
        }
        return "?";
      });
      return [...new Set(rowLetters)].join(", ");
    }
    return [...new Set(selected.map((k) => k.split("-")[0]))].join(", ");
  };
  const selectedRows = getSelectedRowLetters();

  // Fetch seats from Firestore on mount
  useEffect(() => {
    async function loadSeats() {
      if (!eventId) {
        setLoading(false);
        return;
      }
      try {
        const seats = await fetchSeats(eventId);
        setSeatsByBlock(seats);
      } catch (error) {
        console.error("Error loading seats:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSeats();
  }, [eventId]);

  const toggleSeat = (key) => {
    const fs = findFsSeat(activeBlock, key);
    if (fs && fs.status === "booked") return;
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 10) return prev;
      return [...prev, key];
    });
  };

  const handleBlockSelect = (blockId) => {
    setActiveBlock(blockId);
    setSelected([]);
    setShowSeatPanel(true);
    setClickedFromMap(true);
    setShowBlockSelector(true);
  };

  const getAvailableBlocks = () => {
    const fsBlocks = Object.keys(seatsByBlock).filter(
      (b) => (seatsByBlock[b] || []).length > 0
    );
    const all = {
      rightSide: [...new Set([...BLOCK_GROUPS.rightSide, ...fsBlocks.filter((b) => /^A/i.test(b))])],
      frontCenter: [...new Set([...BLOCK_GROUPS.frontCenter, ...fsBlocks.filter((b) => /^B/i.test(b))])],
      leftSide: [...new Set([...BLOCK_GROUPS.leftSide, ...fsBlocks.filter((b) => /^C/i.test(b))])],
    };
    const extra = fsBlocks.filter(
      (b) =>
        !all.rightSide.includes(b) &&
        !all.frontCenter.includes(b) &&
        !all.leftSide.includes(b)
    );
    if (extra.length) all.frontCenter = [...all.frontCenter, ...extra];

    if (!clickedFromMap) return all;

    if (all.rightSide.includes(activeBlock)) {
      return { rightSide: all.rightSide, frontCenter: [], leftSide: [] };
    }
    if (all.frontCenter.includes(activeBlock)) {
      return { rightSide: [], frontCenter: all.frontCenter, leftSide: [] };
    }
    if (all.leftSide.includes(activeBlock)) {
      return { rightSide: [], frontCenter: [], leftSide: all.leftSide };
    }
    return all;
  };

  const getBlockStats = (blockId) => {
    const fsSeats = seatsByBlock[blockId];
    if (fsSeats && fsSeats.length > 0) {
      const available = fsSeats.filter((s) => s.status === "available").length;
      return { total: fsSeats.length, available };
    }
    const blockData = BLOCK_SEATS[blockId];
    if (!blockData) return { total: 0, available: 0 };
    const totalSeats = blockData.reduce((sum, row) => sum + row.count, 0);
    return { total: totalSeats, available: totalSeats };
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
        seats: byRow[rid].sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0)),
      }));
  };

  const findFsSeat = (blockId, key) => {
    const list = seatsByBlock[blockId] || [];
    return list.find(
      (s) =>
        s.id === key ||
        s.seatLabel === key ||
        `${s.rowId}-${s.seatNumber}` === key ||
        `${s.rowId}${s.seatNumber}` === key
    );
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <style jsx>{`
        .block-path:hover {
          fill: #0284c7 !important;
        }
        .block-path text {
          fill: #ffffff !important;
          stroke: none !important;
        }
        .block-active {
          fill: #0369a1 !important;
          stroke: #38bdf8 !important;
          stroke-width: 2.5 !important;
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
            <h2 className="text-center text-lg font-black text-sky-400 font-brand mb-2">
              {eventName} - Seating Map
            </h2>
            <p className="text-center text-slate-400 text-xs mb-4">
              Click on any block (especially <span className="text-sky-300 font-semibold">Block B1</span>) to view and book seats
            </p>
            
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
              <g onClick={() => handleBlockSelect('C2')} className={`block-path ${activeBlock === 'C2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <rect
                  x="40"
                  y="40"
                  width="310"
                  height="190"
                  fill={activeBlock === 'C2' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="6"
                />
                <text x="195" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  C2
                </text>
                <text x="195" y="165" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Left Side
                </text>
              </g>

              {/* BLOCK A2 (Top Right) */}
              <g onClick={() => handleBlockSelect('A2')} className={`block-path ${activeBlock === 'A2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <rect
                  x="650"
                  y="40"
                  width="310"
                  height="190"
                  fill={activeBlock === 'A2' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="6"
                />
                <text x="805" y="135" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  A2
                </text>
                <text x="805" y="165" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Right Side
                </text>
              </g>

              {/* BLOCK C3 (Outer Left) */}
              <g onClick={() => handleBlockSelect('C3')} className={`block-path ${activeBlock === 'C3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="40,250 170,250 170,680 40,840"
                  fill={activeBlock === 'C3' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="105" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  C3
                </text>
                <text x="105" y="550" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Left Side
                </text>
              </g>

              {/* BLOCK C1 (Inner Left) */}
              <g onClick={() => handleBlockSelect('C1')} className={`block-path ${activeBlock === 'C1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="190,250 350,250 350,420 190,660"
                  fill={activeBlock === 'C1' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="270" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  C1
                </text>
                <text x="270" y="470" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Left Side
                </text>
              </g>

              {/* BLOCK A1 (Inner Right) */}
              <g onClick={() => handleBlockSelect('A1')} className={`block-path ${activeBlock === 'A1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="650,250 810,250 810,660 650,420"
                  fill={activeBlock === 'A1' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="730" y="440" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  A1
                </text>
                <text x="730" y="470" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Right Side
                </text>
              </g>

              {/* BLOCK A3 (Outer Right) */}
              <g onClick={() => handleBlockSelect('A3')} className={`block-path ${activeBlock === 'A3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="830,250 960,250 960,840 830,680"
                  fill={activeBlock === 'A3' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="895" y="520" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  A3
                </text>
                <text x="895" y="550" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Right Side
                </text>
              </g>

              {/* BLOCK B1 (Main Center Front Trapezoid) */}
              <g onClick={() => handleBlockSelect('B1')} className={`block-path ${activeBlock === 'B1' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="370,420 630,420 780,660 220,660"
                  fill={activeBlock === 'B1' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="500" y="540" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  B1
                </text>
                <text x="500" y="575" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Front Center
                </text>
              </g>

              {/* BLOCK B2 (Bottom Left) */}
              <g onClick={() => handleBlockSelect('B2')} className={`block-path ${activeBlock === 'B2' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="200,680 480,680 480,860 60,860"
                  fill={activeBlock === 'B2' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="290" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  B2
                </text>
                <text x="290" y="800" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Front Center
                </text>
              </g>

              {/* BLOCK B3 (Bottom Right) */}
              <g onClick={() => handleBlockSelect('B3')} className={`block-path ${activeBlock === 'B3' ? 'block-active' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}>
                <polygon
                  points="520,680 800,680 940,860 520,860"
                  fill={activeBlock === 'B3' ? '#0369a1' : '#1e293b'}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text x="710" y="770" textAnchor="middle" fill="#ffffff" fontSize="28" fontWeight="bold" pointerEvents="none">
                  B3
                </text>
                <text x="710" y="800" textAnchor="middle" fill="#94a3b8" fontSize="14" pointerEvents="none">
                  Front Center
                </text>
              </g>
            </svg>
          </div>
          {/* Stage Area - Top Center */}
          <div className="flex flex-col items-center">
            {showBlockSelector && (
              <div className="w-[95%] max-w-lg bg-white rounded-2xl border border-slate-200 shadow-md px-4 py-3 flex flex-col items-center mb-4">
                <div className="text-center mb-3">
                  <p className="text-xs text-slate-600 font-medium">
                    {clickedFromMap 
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

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-0.5.5">
              <span className="w-3 h-3 rounded-[4px] bg-green-400 border-2 border-slate-900 inline-block" /> Available
            </span>
            <span className="flex items-center gap-0.5.5">
              <span className="w-3 h-3 rounded-[4px] bg-amber-400 border-2 border-slate-900 inline-block" /> Selected
            </span>
            <span className="flex items-center gap-0.5.5">
              <span className="w-3 h-3 rounded-[4px] bg-gray-300 border-2 border-slate-900 inline-block" /> Booked
            </span>
          </div>

          {/* Seating Area */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 font-medium">Loading seats...</p>
              </div>
            ) : activeBlock && (getFsRows(activeBlock) || BLOCK_SEATS[activeBlock]) ? (
              (() => {
                const fsRows = getFsRows(activeBlock);
                if (fsRows) {
                  // Admin Seat Create → Firestore-driven grid
                  return fsRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-0.5">
                      <span className="w-6 text-right pr-1 text-[10px] font-black text-slate-400">
                        {row.id}
                      </span>
                      <div className="flex-1 overflow-x-hidden">
                        <div className="flex w-max mx-auto gap-0.5">
                          {row.seats.map((seat) => {
                            const key =
                              seat.id || `${seat.rowId}-${seat.seatNumber}`;
                            const isBooked = seat.status === "booked";
                            return (
                              <div key={key} className="flex flex-col items-center shrink-0">
                                <ChairSvg
                                  isBooked={isBooked}
                                  isSelected={selected.includes(key)}
                                  onClick={() => toggleSeat(key)}
                                  label={seat.seatNumber}
                                  sizeClass="w-6 h-8"
                                  disabled={!clickedFromMap}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ));
                }
                const isBBlock = ["B1", "B2", "B3"].includes(activeBlock);
                
                if (isBBlock && bBlockSeats[activeBlock]) {
                  // Special rendering for B blocks with directional display
                  return bBlockSeats[activeBlock].map((row, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-0.5">
                      <span className="w-6 text-right pr-1 text-[10px] font-black text-slate-400">
                        {String.fromCharCode(65 + rowIndex)}
                      </span>
                      <div className="flex-1 overflow-x-hidden">
                        <div className="flex w-max mx-auto gap-0.5">
                          {row.map((seat) => {
                            const key = `${seat.letter}${seat.number}`;
                            const firestoreSeat = findFsSeat(activeBlock, key);
                            const isBooked = firestoreSeat
                              ? firestoreSeat.status === "booked"
                              : false;
                            return (
                              <div key={key} className="flex flex-col items-center shrink-0">
                                <ChairSvg
                                  isBooked={isBooked}
                                  isSelected={selected.includes(key)}
                                  onClick={() => toggleSeat(key)}
                                  label={seat.number}
                                  sizeClass="w-6 h-8"
                                  disabled={!clickedFromMap}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ));
                } else {
                  // Standard rendering for other blocks
                  return BLOCK_SEATS[activeBlock].map((row, rowIndex) => (
                    <div key={row.id} className="flex items-center gap-0.5">
                      <span className="w-6 text-right pr-1 text-[10px] font-black text-slate-400">{row.id}</span>
                      <div className="flex-1 overflow-x-hidden">
                        <div className="flex w-max mx-auto gap-0.5">
                          {Array.from({ length: row.count }).map((_, i) => {
                            const seatNo = i + 1;
                            const key = `${row.id}-${seatNo}`;
                            const firestoreSeat = findFsSeat(activeBlock, key);
                            const isBooked = firestoreSeat
                              ? firestoreSeat.status === "booked"
                              : false;
                            return (
                              <div key={key} className="flex flex-col items-center shrink-0">
                                <ChairSvg
                                  isBooked={isBooked}
                                  isSelected={selected.includes(key)}
                                  onClick={() => toggleSeat(key)}
                                  label={seatNo}
                                  sizeClass="w-6 h-8"
                                  disabled={!clickedFromMap}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ));
                }
              })()
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 font-medium">
                  {activeBlock ? "No seats available for this block" : "Click on a block to view seats"}
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-400 font-medium">
            Tap a seat to select. Block: <span className="font-black text-amber-600">{activeBlock}</span> • Selected: <span className="font-black text-amber-600">{selected.length}</span>
          </p>
        </div>

        {/* Bottom Summary + CTA */}
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-2xl p-4 bg-white border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] space-y-2.5">
          {/* Calculation Bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
              <span className="flex-shrink-0 bg-indigo-950 text-white font-black text-[10px] px-2 py-1 rounded-md">
                Block {activeBlock}
              </span>
              <div className="flex flex-wrap gap-1 min-w-0">
                {selected.length > 0 ? selected.map((s) => {
                  let displayLabel = s;
                const isBBlock = ["B1", "B2", "B3"].includes(activeBlock);
                  if (isBBlock && bBlockSeats[activeBlock]) {
                    for (let ri = 0; ri < bBlockSeats[activeBlock].length; ri++) {
                      const row = bBlockSeats[activeBlock][ri];
                      const seatIdx = row.findIndex((seat) => `${seat.letter}${seat.number}` === s);
                      if (seatIdx !== -1) {
                        displayLabel = `${String.fromCharCode(65 + ri)}${seatIdx + 1}`;
                        break;
                      }
                    }
                  }
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
              router.push(`/book?event=${encodeURIComponent(eventName)}&eventId=${eventId}&block=${activeBlock}&seats=${displaySeats.join(',')}`);
            }}
            disabled={selected.length === 0}
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-ticket -rotate-12 text-base" />
            <span>Continue with {selected.length > 0 ? `${selected.length} seat${selected.length > 1 ? "s" : ""}` : "seat selection"}</span>
            <i className="fa-solid fa-chevron-right text-xs ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SeatSelectionPage() {
  return (
    <Suspense fallback={null}>
      <SeatSelectionContent />
    </Suspense>
  );
}
