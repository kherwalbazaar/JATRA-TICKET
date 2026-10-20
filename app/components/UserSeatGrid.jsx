"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ChairSvg from "./ChairSvg";
import { subscribeSeats, getHoldSessionId, isHoldFresh } from "../../lib/seats";
import { getPriceForRow, subscribeTicketTypes } from "../../lib/ticketTypes";
import { subscribeBlockCategories, blockDisplayName } from "../../lib/blockCategories";

/**
 * UserSeatGrid: Reactive real-time seat availability map for customer booking.
 * Subscribes to Supabase `seats` table in real-time via postgres_changes and sbFetchSeats.
 *
 * Ensures all seat state modifications (available, selected, booked, locked)
 * stream dynamically into the UI without page reloads.
 * Automatically cleans up the listener in useEffect.
 */
export default function UserSeatGrid({
  showId,
  eventId,
  activeBlock,
  selected = [],
  onToggleSeat,
  disabled = false,
  seatsByBlock: externalSeatsByBlock,
  loading: externalLoading,
  onSeatsUpdate,
  onError,
  seatPrice,
  pricePerSeat: propPricePerSeat,
}) {
  const targetId = showId || eventId || "";
  const [internalSeats, setInternalSeats] = useState({});
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" (default) | "row"
  const [ticketTypes, setTicketTypes] = useState([]);
  const [blockCats, setBlockCats] = useState([]);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const onToggleSeatRef = useRef(onToggleSeat);
  onToggleSeatRef.current = onToggleSeat;

  const onSeatsUpdateRef = useRef(onSeatsUpdate);
  onSeatsUpdateRef.current = onSeatsUpdate;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const sessionId = useMemo(() => getHoldSessionId(), []);

  // Reserved by another session and still fresh → blocked for this user too.
  const reservedByOther = (seat) =>
    String(seat?.status || "").toLowerCase() === "reserved" &&
    seat.reservedBy !== sessionId &&
    isHoldFresh(seat);

  const isSeatAvailable = (seat) =>
    !seat?.status ||
    seat.status === "available" ||
    (seat.status === "reserved" && !isHoldFresh(seat));

  // Controlled mode: if externalSeatsByBlock is provided, parent manages seat state
  const isControlled = externalSeatsByBlock !== undefined;
  const seatsByBlock = isControlled ? (externalSeatsByBlock || {}) : internalSeats;
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  // Real-time Firestore onSnapshot subscription (only runs when NOT controlled externally)
  useEffect(() => {
    if (isControlled) {
      setInternalLoading(false);
      return;
    }

    if (!targetId) {
      setInternalLoading(false);
      return;
    }

    setInternalLoading(true);
    setError(null);
    let isFirst = true;

    const unsubscribe = subscribeSeats(
      targetId,
      (newSeats) => {
        setInternalSeats(newSeats);
        if (onSeatsUpdateRef.current) {
          onSeatsUpdateRef.current(newSeats);
        }

        if (isFirst) {
          isFirst = false;
          setInternalLoading(false);
        }
      },
      (err) => {
        console.error("UserSeatGrid subscription error:", err);
        setError("Live seat updates disconnected. Retrying...");
        if (onErrorRef.current) onErrorRef.current(err);
        setInternalLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [targetId, isControlled]);

  // Subscribe to real-time ticket types from Supabase / admin
  useEffect(() => {
    if (!targetId) return;
    const unsub = subscribeTicketTypes((tts) => {
      setTicketTypes(tts || []);
    }, targetId);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [targetId]);

  // Subscribe to block categories from Supabase (for block display names)
  useEffect(() => {
    return subscribeBlockCategories(setBlockCats);
  }, []);

  // Concurrency collision check: deselect any seat that became booked / locked / reserved
  useEffect(() => {
    if (!activeBlock || !seatsByBlock[activeBlock] || !onToggleSeatRef.current) return;
    const blockSeats = seatsByBlock[activeBlock];
    const currSelected = selectedRef.current || [];
    for (const sKey of currSelected) {
      const found = blockSeats.find(
        (s) =>
          s.id === sKey ||
          s.seatLabel === sKey ||
          `${s.rowId}-${s.seatNumber}` === sKey ||
          `${s.rowId}${s.seatNumber}` === sKey
      );
      if (found && (found.status === "booked" || found.status === "locked" || reservedByOther(found))) {
        onToggleSeatRef.current(sKey, found);
      }
    }
  }, [seatsByBlock, activeBlock]);

  // Group seats by row for data-driven rendering of the active block
  const rows = useMemo(() => {
    if (!activeBlock) return null;
    const list = seatsByBlock[activeBlock] || [];
    if (!list.length) return null;

    const byRow = {};
    list.forEach((s) => {
      const rid = String(s.rowId || s.row || "A").trim().toUpperCase();
      if (!byRow[rid]) byRow[rid] = [];
      byRow[rid].push(s);
    });

    return Object.keys(byRow)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((rid) => ({
        id: rid,
        seats: byRow[rid].sort(
          (a, b) =>
            Number(a.seatNumber ?? a.number ?? 0) -
            Number(b.seatNumber ?? b.number ?? 0)
        ),
      }));
  }, [seatsByBlock, activeBlock]);

  // Block stats for the active block
  const blockStats = useMemo(() => {
    if (!activeBlock) return { total: 0, available: 0, booked: 0, locked: 0, reserved: 0 };
    const list = seatsByBlock[activeBlock] || [];
    const available = list.filter((s) => isSeatAvailable(s)).length;
    const booked = list.filter((s) => s.status === "booked" || s.status === "sold").length;
    const locked = list.filter((s) => s.status === "locked").length;
    const reserved = list.filter((s) => s.status === "reserved" && isHoldFresh(s)).length;
    return { total: list.length, available, booked, locked, reserved };
  }, [seatsByBlock, activeBlock]);

  const pricePerSeat = useMemo(() => {
    const raw = seatPrice ?? propPricePerSeat;
    if (raw && Number(raw) > 0) return Number(raw);
    if (!activeBlock) return null;
    const list = seatsByBlock[activeBlock] || [];
    const found = list.find((s) => s.price != null && Number(s.price) > 0);
    return found ? Number(found.price) : null;
  }, [seatPrice, propPricePerSeat, seatsByBlock, activeBlock]);

  const getRowPrice = (row) => {
    // 1. Check if admin configured a ticket type for this row in Supabase
    if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
      const cleanRow = String(row?.id || "").trim().toUpperCase();
      const matched = ticketTypes.find(
        (tt) => Array.isArray(tt.rows) && tt.rows.map((r) => String(r).toUpperCase()).includes(cleanRow)
      );
      if (matched && Number(matched.price) > 0) {
        return Number(matched.price);
      }
    }

    // 2. Check if seats in this row have explicit positive prices from Supabase seats table
    const seatPrices = [
      ...new Set(
        (row?.seats || [])
          .map((s) => Number(s.price))
          .filter((p) => !isNaN(p) && p > 0)
      ),
    ].sort((a, b) => a - b);

    if (seatPrices.length > 0) {
      return seatPrices[0];
    }

    // 3. Fallback to standard row tier pricing from ticketTypes.js
    const standardPrice = getPriceForRow(row?.id, ticketTypes);
    if (standardPrice && Number(standardPrice) > 0) {
      return Number(standardPrice);
    }

    // 4. Fallback to general pricePerSeat prop
    if (pricePerSeat && Number(pricePerSeat) > 0) {
      return Number(pricePerSeat);
    }

    return 100;
  };

  const getTierName = (price, rowId) => {
    if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
      const cleanRow = String(rowId || "").trim().toUpperCase();
      const matched = ticketTypes.find(
        (tt) => Array.isArray(tt.rows) && tt.rows.map((r) => String(r).toUpperCase()).includes(cleanRow)
      );
      if (matched?.name) return matched.name;
      const matchedByPrice = ticketTypes.find((tt) => Number(tt.price) === Number(price));
      if (matchedByPrice?.name) return matchedByPrice.name;
    }
    const cleanRow = String(rowId || "").trim().toUpperCase();
    if (["A", "B", "C", "D", "E"].includes(cleanRow) || price === 200) return "Star";
    if (["F", "G", "H", "I", "J", "K"].includes(cleanRow) || price === 150) return "VIP";
    if (["L", "M", "N", "O", "P", "Q", "R"].includes(cleanRow) || price === 120) return "Special";
    if (price === 100) return "3rd Class";
    return "";
  };

  const priceGroups = useMemo(() => {
    if (!rows || !rows.length) return [];

    const groupMap = new Map();

    rows.forEach((row) => {
      const price = getRowPrice(row);
      const tierName = getTierName(price, row.id);
      const groupKey = `${price}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          price,
          tierName,
          rows: [],
          totalSeats: 0,
          availableSeats: 0,
          bookedSeats: 0,
        });
      }

      const g = groupMap.get(groupKey);
      g.rows.push(row);
      const rowTotal = row.seats.length;
      const rowBooked = row.seats.filter((s) => s.status === "booked" || s.status === "sold").length;
      const rowAvailable = row.seats.filter((s) => isSeatAvailable(s)).length;
      g.totalSeats += rowTotal;
      g.bookedSeats += rowBooked;
      g.availableSeats += rowAvailable;
    });

    // Sort groups descending by price (e.g. ₹200 first, then ₹150)
    return Array.from(groupMap.values()).sort((a, b) => b.price - a.price);
  }, [rows, ticketTypes, pricePerSeat]);

  const customBlockName = useMemo(() => {
    return blockDisplayName(blockCats, activeBlock);
  }, [blockCats, activeBlock]);

  const priceSummaryText = useMemo(() => {
    if (!priceGroups || priceGroups.length === 0) {
      return pricePerSeat ? `₹${pricePerSeat}` : "₹100";
    }
    const prices = priceGroups.map((g) => g.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `₹${min}`;
    return `₹${max} - ₹${min}`;
  }, [priceGroups, pricePerSeat]);


  const handleSeatClick = (seat) => {
    if (disabled) return;
    const key = seat.id || `${seat.rowId || seat.row}-${seat.seatNumber}`;
    if (seat.status === "booked" || seat.status === "locked") return;
    if (reservedByOther(seat)) return;
    if (onToggleSeat) {
      onToggleSeat(key, seat);
    }
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Legend (Reduced Text Size) */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[9px] font-bold text-slate-500 py-0.5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-[3px] bg-green-400 border border-emerald-600 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-[3px] bg-amber-400 border border-amber-600 inline-block" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-[3px] bg-gray-300 border border-gray-400 inline-block" /> Booked
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-[3px] bg-amber-200 border border-amber-500 inline-block" /> Locked
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-[3px] bg-yellow-300 border border-yellow-600 inline-block" /> Reserved
        </span>
      </div>

      {/* Disconnection Warning Banner if error occurs */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-center justify-between text-[11px] text-amber-800">
          <div className="flex items-center gap-1.5">
            <i className="fa-solid fa-triangle-exclamation text-amber-600 text-xs" />
            <span>{error}</span>
          </div>
          <span className="text-[9px] bg-amber-200/60 font-semibold px-1.5 py-0.5 rounded">Reconnecting</span>
        </div>
      )}

      {/* Seating Area Card (No Background) */}
      <div className="w-full min-h-[120px] flex flex-col justify-center bg-transparent border-0 shadow-none p-0 sm:px-0.5">
        {loading ? (
          <div className="text-center py-8 space-y-2.5">
            <div className="inline-block w-7 h-7 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[11px] text-slate-500 font-semibold">
              Loading real seats from database...
            </p>
          </div>
        ) : !targetId ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-500 font-medium">No show selected — seats cannot be loaded.</p>
          </div>
        ) : !activeBlock ? (
          <div className="text-center py-6 space-y-1.5">
            <i className="fa-solid fa-chair text-slate-300 text-2xl mb-0.5" />
            <p className="text-xs font-bold text-slate-700">Select a Block from the Diagram Above</p>
            <p className="text-[10px] text-slate-400 font-medium">Click any block (like B1, A1, C1) to view real seats</p>
          </div>
        ) : rows && rows.length > 0 ? (
          <div className="space-y-2.5">
            {/* Block Header Banner with Default Color Background */}
            <div className="w-full bg-[#12193b] text-white rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-md space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
                {/* Left: Block Title & Custom Name & Stats */}
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  <span className="bg-sky-500 text-slate-950 font-black text-xs sm:text-sm px-3 py-1 rounded-lg uppercase tracking-wider shadow-xs flex items-center gap-1.5">
                    <i className="fa-solid fa-layer-group text-[11px]" />
                    <span>Block {activeBlock}</span>
                  </span>
                  {customBlockName && customBlockName !== activeBlock && !/^block\s+/i.test(customBlockName) && (
                    <span className="bg-white/10 text-white font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg border border-white/15">
                      {customBlockName}
                    </span>
                  )}
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/70 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{blockStats.available} Available</span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-md">
                    Total {blockStats.total}
                  </span>
                  {selected.length > 0 && (
                    <span className="text-[11px] sm:text-xs font-black text-slate-950 bg-amber-400 px-2.5 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                      <i className="fa-solid fa-check text-[10px]" />
                      <span>{selected.length} Selected</span>
                    </span>
                  )}
                </div>

                {/* Right: Price highlight and View Switcher */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-1.5 sm:pt-0 border-t border-white/10 sm:border-t-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Price:
                    </span>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 font-brand tracking-tight drop-shadow-sm">
                      {priceSummaryText}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-300">
                      / seat
                    </span>
                  </div>

                  {/* View Switcher Button */}
                  <button
                    type="button"
                    onClick={() => setViewMode((prev) => (prev === "grid" ? "row" : "grid"))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all text-xs font-bold text-white shadow-2xs cursor-pointer select-none active:scale-95 shrink-0"
                    title={viewMode === "grid" ? "Click to switch to List View" : "Click to switch to Grid View"}
                  >
                    <i
                      className={`fa-solid ${
                        viewMode === "grid" ? "fa-grip text-sky-400" : "fa-bars text-amber-400"
                      } text-xs`}
                    />
                    <span>{viewMode === "grid" ? "Grid" : "List"}</span>
                  </button>
                </div>
              </div>
            </div>


            {/* View Mode: Grid (Grouped by Price Category) vs Row View */}
            {viewMode === "grid" ? (
              <div className="space-y-4 py-1">
                {priceGroups.map((group) => (
                  <div
                    key={group.price}
                    className="border border-slate-200/90 rounded-2xl p-2 sm:p-3 space-y-3 bg-white shadow-sm"
                  >
                    {/* Price Category Top Header with Default Color Background */}
                    <div className="w-full bg-[#12193b] text-white rounded-xl p-3 sm:p-3.5 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
                      {/* Left: Block Name & Category Name + Badges */}
                      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                        {/* Block Name inside Block Category */}
                        <span className="bg-sky-500 text-slate-950 font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs flex items-center gap-1.5">
                          <i className="fa-solid fa-layer-group text-[11px]" />
                          <span>Block {activeBlock}</span>
                        </span>

                        {/* Category Name */}
                        <span className="bg-white/10 text-white font-extrabold text-xs sm:text-sm px-2.5 py-1 rounded-lg border border-white/15 tracking-wide flex items-center gap-1.5">
                          <i className="fa-solid fa-crown text-amber-400 text-[10px]" />
                          <span>{group.tierName ? `${group.tierName} Category` : "Standard Category"}</span>
                        </span>

                        {/* Availability Status */}
                        <span className="text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                          <span>{group.availableSeats} Available</span>
                        </span>

                        <span className="text-[11px] sm:text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                          Total {group.totalSeats} Seats
                        </span>
                      </div>

                      {/* Right: Price BOLD and BIG as per section and screen */}
                      <div className="flex items-baseline justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t border-white/10 sm:border-t-0 shrink-0">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider sm:hidden">
                          Seat Price:
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 font-brand tracking-tight drop-shadow-sm">
                            ₹{group.price}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-300">
                            / seat
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* All seat rows inside this category: left side shows row number like A, B, C */}
                    <div className="space-y-2.5 pt-0.5">
                      {group.rows.map((row) => (
                        <div key={row.id} className="flex items-start sm:items-center gap-2 sm:gap-2.5 w-full">
                          {/* Row number like A, B, C on left side */}
                          <span className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md bg-pink-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0 shadow-2xs select-none mt-0.5 sm:mt-0 border border-pink-600">
                            {row.id}
                          </span>

                          {/* Responsive seat grid */}
                          <div
                            className="grid gap-[2px] sm:gap-1 flex-1 py-0.5 justify-items-center"
                            style={{
                              gridTemplateColumns: "repeat(auto-fill, minmax(20px, 1fr))",
                            }}
                          >
                            {row.seats.map((seat) => {
                              const key = seat.id || `${seat.rowId || seat.row}-${seat.seatNumber}`;
                              const isBooked = seat.status === "booked";
                              const isLocked = seat.status === "locked";
                              const isReservedBlocked = reservedByOther(seat);
                              const isSelected = selected.includes(key);
                              const seatLabel = seat.seatLabel || `${seat.rowId || seat.row}${seat.seatNumber}`;

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={disabled || isBooked || isLocked || isReservedBlocked}
                                  onClick={() => handleSeatClick(seat)}
                                  title={`${seatLabel} • ₹${seat.price || group.price} • ${
                                    isBooked
                                      ? "Booked"
                                      : isSelected
                                      ? "Selected"
                                      : isLocked || isReservedBlocked
                                      ? "Held"
                                      : "Available"
                                  }`}
                                  className={`w-full flex items-center justify-center p-0 transition-all select-none bg-transparent border-0 shadow-none ${
                                    isBooked
                                      ? "opacity-45 cursor-not-allowed"
                                      : isLocked || isReservedBlocked
                                      ? "opacity-70 cursor-not-allowed"
                                      : isSelected
                                      ? "scale-115 drop-shadow-md cursor-pointer"
                                      : "hover:scale-110 active:scale-95 cursor-pointer"
                                  }`}
                                >
                                  <ChairSvg
                                    isBooked={isBooked}
                                    isLocked={isLocked}
                                    isReserved={isReservedBlocked}
                                    isSelected={isSelected}
                                    label={seat.seatNumber}
                                    sizeClass="w-[20px] h-[24px] sm:w-[22px] sm:h-[26px]"
                                    disabled={disabled}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Row View: Horizontal Row Layout Grouped by Price Category */
              <div className="space-y-4 pb-4 pt-1 select-none">
                {priceGroups.map((group) => (
                  <div
                    key={group.price}
                    className="border border-slate-200/90 rounded-2xl p-2 sm:p-3 space-y-3 bg-white shadow-sm overflow-x-auto scrollbar-thin"
                  >
                    {/* Price Category Top Header with Default Color Background */}
                    <div className="w-full bg-[#12193b] text-white rounded-xl p-3 sm:p-3.5 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
                      {/* Left: Block Name & Category Name + Badges */}
                      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                        {/* Block Name inside Block Category */}
                        <span className="bg-sky-500 text-slate-950 font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs flex items-center gap-1.5">
                          <i className="fa-solid fa-layer-group text-[11px]" />
                          <span>Block {activeBlock}</span>
                        </span>

                        {/* Category Name */}
                        <span className="bg-white/10 text-white font-extrabold text-xs sm:text-sm px-2.5 py-1 rounded-lg border border-white/15 tracking-wide flex items-center gap-1.5">
                          <i className="fa-solid fa-crown text-amber-400 text-[10px]" />
                          <span>{group.tierName ? `${group.tierName} Category` : "Standard Category"}</span>
                        </span>

                        {/* Availability Status */}
                        <span className="text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                          <span>{group.availableSeats} Available</span>
                        </span>

                        <span className="text-[11px] sm:text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                          Total {group.totalSeats} Seats
                        </span>
                      </div>

                      {/* Right: Price BOLD and BIG as per section and screen */}
                      <div className="flex items-baseline justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t border-white/10 sm:border-t-0 shrink-0">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider sm:hidden">
                          Seat Price:
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 font-brand tracking-tight drop-shadow-sm">
                            ₹{group.price}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-300">
                            / seat
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Horizontal Rows */}
                    <div className="space-y-2 pt-0.5 min-w-max">
                      {group.rows.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center gap-1 min-w-max mx-auto justify-center px-0.5 py-0.5 rounded-md hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Left Row Badge */}
                          <span className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md bg-pink-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0 shadow-xs border border-pink-600">
                            {row.id}
                          </span>

                          {/* Horizontal Seats in Row */}
                          <div className="flex items-center gap-[2px] sm:gap-1">
                            {row.seats.map((seat) => {
                              const key = seat.id || `${seat.rowId || seat.row}-${seat.seatNumber}`;
                              const isBooked = seat.status === "booked";
                              const isLocked = seat.status === "locked";
                              const isReservedBlocked = reservedByOther(seat);
                              const isSelected = selected.includes(key);
                              const seatLabel = seat.seatLabel || `${seat.rowId || seat.row}${seat.seatNumber}`;

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={disabled || isBooked || isLocked || isReservedBlocked}
                                  onClick={() => handleSeatClick(seat)}
                                  title={`${seatLabel} • ₹${seat.price || group.price} • ${
                                    isBooked
                                      ? "Booked"
                                      : isSelected
                                      ? "Selected"
                                      : isLocked || isReservedBlocked
                                      ? "Held"
                                      : "Available"
                                  }`}
                                  className={`flex items-center justify-center p-0 transition-all shrink-0 select-none bg-transparent border-0 shadow-none ${
                                    isBooked
                                      ? "opacity-45 cursor-not-allowed"
                                      : isLocked || isReservedBlocked
                                      ? "opacity-70 cursor-not-allowed"
                                      : isSelected
                                      ? "scale-115 drop-shadow-md cursor-pointer"
                                      : "hover:scale-110 active:scale-95 cursor-pointer"
                                  }`}
                                >
                                  <ChairSvg
                                    isBooked={isBooked}
                                    isLocked={isLocked}
                                    isReserved={isReservedBlocked}
                                    isSelected={isSelected}
                                    label={seat.seatNumber}
                                    sizeClass="w-[20px] h-[24px] sm:w-[22px] sm:h-[26px]"
                                    disabled={disabled}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          {/* Right Row Badge */}
                          <span className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md bg-pink-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0 shadow-xs border border-pink-600">
                            {row.id}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <p className="text-center text-[11px] text-slate-500 font-semibold pt-1">
                  ← Scroll / swipe horizontally to explore all seats in row →
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 space-y-2">
            <i className="fa-solid fa-chair text-slate-300 text-2xl" />
            <p className="text-xs font-bold text-slate-700">
              No seats found in database for Block{" "}
              <span className="font-black text-amber-600">{activeBlock}</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              Only real seats created by admin will appear here. No fake seat rows.
            </p>
          </div>
        )}
      </div>

      {/* Block Seat Counter Footer (Reduced Text Size) */}
      {activeBlock && blockStats.total > 0 && (
        <div className="flex items-center justify-between px-2 text-[10px] text-slate-500">
          <span>
            Block <span className="font-black text-amber-600">{activeBlock}</span> • Total: {blockStats.total}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">{blockStats.available} available</span>
            <span>•</span>
            <span className="text-rose-500 font-bold">{blockStats.booked} booked</span>
            {blockStats.locked > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-600 font-bold">{blockStats.locked} locked</span>
              </>
            )}
            {blockStats.reserved > 0 && (
              <>
                <span>•</span>
                <span className="text-yellow-600 font-bold">{blockStats.reserved} reserved</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
