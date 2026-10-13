"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ChairSvg from "./ChairSvg";
import { subscribeSeats, getHoldSessionId, isHoldFresh } from "../../lib/seats";

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
}) {
  const targetId = showId || eventId || "";
  const [internalSeats, setInternalSeats] = useState({});
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" (default responsive to screen width) | "row"

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
      const rid = s.rowId || s.row || "A";
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
  }, [seatsByBlock, activeBlock]);

  // Block stats for the active block
  const blockStats = useMemo(() => {
    if (!activeBlock) return { total: 0, available: 0, booked: 0, locked: 0, reserved: 0 };
    const list = seatsByBlock[activeBlock] || [];
    const available = list.filter((s) => s.status === "available" || !s.status).length;
    const booked = list.filter((s) => s.status === "booked").length;
    const locked = list.filter((s) => s.status === "locked").length;
    const reserved = list.filter((s) => s.status === "reserved").length;
    return { total: list.length, available, booked, locked, reserved };
  }, [seatsByBlock, activeBlock]);

  const pricePerSeat = useMemo(() => {
    if (seatPrice && Number(seatPrice) > 0) return Number(seatPrice);
    if (!activeBlock) return null;
    const list = seatsByBlock[activeBlock] || [];
    const found = list.find((s) => s.price != null && Number(s.price) > 0);
    return found ? Number(found.price) : null;
  }, [seatPrice, seatsByBlock, activeBlock]);

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
    <div className="w-full space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[10px] font-bold text-slate-600 py-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[4px] bg-green-400 border border-emerald-600 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[4px] bg-amber-400 border border-amber-600 inline-block" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[4px] bg-gray-300 border border-gray-400 inline-block" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[4px] bg-amber-200 border border-amber-500 inline-block" /> Locked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[4px] bg-yellow-300 border border-yellow-600 inline-block" /> Reserved
        </span>
      </div>

      {/* Disconnection Warning Banner if error occurs */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm" />
            <span>{error}</span>
          </div>
          <span className="text-[10px] bg-amber-200/60 font-semibold px-2 py-0.5 rounded">Reconnecting</span>
        </div>
      )}

      {/* Seating Area Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 min-h-[160px] flex flex-col justify-center">
        {loading ? (
          <div className="text-center py-10 space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-semibold">
              Loading real seats from database...
            </p>
          </div>
        ) : !targetId ? (
          <div className="text-center py-8">
            <p className="text-xs text-slate-500 font-medium">No show selected — seats cannot be loaded.</p>
          </div>
        ) : !activeBlock ? (
          <div className="text-center py-8 space-y-2">
            <i className="fa-solid fa-chair text-slate-300 text-3xl mb-1" />
            <p className="text-sm font-black text-slate-700">Select a Block from the Diagram Above</p>
            <p className="text-xs text-slate-400 font-medium">Click any block (like B1, A1, C1) to view real seats</p>
          </div>
        ) : rows && rows.length > 0 ? (
          <div className="space-y-3">
            {/* Block Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="bg-sky-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  Block {activeBlock}
                </span>
                <span className="text-xs font-black text-slate-800">
                  Seat Grid View
                </span>
                {pricePerSeat != null && (
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                    ₹{pricePerSeat} / seat
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {blockStats.available} Available
                </span>
                <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {blockStats.total} Total
                </span>
                {selected.length > 0 && (
                  <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    {selected.length} Selected
                  </span>
                )}

                {/* View Switcher: Grid View vs Row View */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[10px] ${
                      viewMode === "grid"
                        ? "bg-white text-slate-900 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-700 font-semibold"
                    }`}
                    title="Grid View (responsive to screen width)"
                  >
                    <i className="fa-solid fa-grip text-[10px]" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("row")}
                    className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[10px] ${
                      viewMode === "row"
                        ? "bg-white text-slate-900 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-700 font-semibold"
                    }`}
                    title="Row View (stage row alignment)"
                  >
                    <i className="fa-solid fa-bars text-[10px]" />
                    <span className="hidden sm:inline">Row</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stage / Screen Direction Indicator */}
            <div className="w-full max-w-xs sm:max-w-sm mx-auto my-1 text-center">
              <div className="h-1.5 w-full bg-gradient-to-r from-purple-400 via-sky-400 to-purple-400 rounded-t-xl opacity-80" />
              <div className="bg-slate-800 text-white rounded-b-xl py-1 px-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <span className="text-sky-400">▲</span> STAGE / SCREEN THIS WAY <span className="text-sky-400">▲</span>
                </p>
              </div>
            </div>

            {/* View Mode: Grid (as per screen width) vs Row View */}
            {viewMode === "grid" ? (
              <div className="space-y-3 py-1">
                {rows.map((row) => (
                  <div key={row.id} className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        Row {row.id} • {row.seats.length} Seats
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {row.seats.filter((s) => s.status === "available" || !s.status).length} available
                      </span>
                    </div>

                    {/* Responsive Grid matching screen width without horizontal scroll */}
                    <div className="grid grid-cols-3 min-[380px]:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 sm:gap-2.5 w-full">
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
                            className={`group relative flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all select-none ${
                              isBooked
                                ? "bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                : isLocked || isReservedBlocked
                                ? "bg-yellow-50 border-yellow-300 text-yellow-800 cursor-not-allowed opacity-75"
                                : isSelected
                                ? "bg-amber-100 border-amber-500 ring-2 ring-amber-400/80 text-amber-950 shadow-sm scale-[1.02]"
                                : "bg-white hover:bg-emerald-50/70 border-slate-200 hover:border-emerald-400 text-slate-800 cursor-pointer active:scale-95 shadow-2xs"
                            }`}
                          >
                            <ChairSvg
                              isBooked={isBooked}
                              isLocked={isLocked}
                              isReserved={isReservedBlocked}
                              isSelected={isSelected}
                              label={seat.seatNumber}
                              sizeClass="w-6 h-7 sm:w-7 sm:h-8"
                              disabled={disabled}
                            />
                            <span className="text-[11px] font-black mt-1 leading-tight">
                              {seatLabel}
                            </span>
                            <span className="text-[9px] font-bold mt-0.5">
                              {isBooked ? (
                                <span className="text-rose-500 font-extrabold">Booked</span>
                              ) : isSelected ? (
                                <span className="text-amber-800 font-extrabold">Selected</span>
                              ) : isLocked || isReservedBlocked ? (
                                <span className="text-yellow-700 font-bold">Held</span>
                              ) : (
                                <span className="text-emerald-700">₹{seat.price || pricePerSeat || 50}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Row View: Horizontal Row Layout */
              <div className="space-y-1.5 overflow-x-auto pb-3 pt-2 select-none scrollbar-thin">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center gap-1.5 min-w-max mx-auto justify-center px-1">
                    <span className="w-6 text-right pr-1 text-[11px] font-black text-slate-400 shrink-0 select-none">
                      {row.id}
                    </span>
                    <div className="flex items-center gap-1">
                      {row.seats.map((seat) => {
                        const key = seat.id || `${seat.rowId || seat.row}-${seat.seatNumber}`;
                        const isBooked = seat.status === "booked";
                        const isLocked = seat.status === "locked";
                        const isReservedBlocked = reservedByOther(seat);
                        const isSelected = selected.includes(key);

                        return (
                          <div key={key} className="flex flex-col items-center shrink-0">
                            <ChairSvg
                              isBooked={isBooked}
                              isLocked={isLocked}
                              isReserved={isReservedBlocked}
                              isSelected={isSelected}
                              onClick={() => handleSeatClick(seat)}
                              label={seat.seatNumber}
                              sizeClass="w-5 h-6 sm:w-6 sm:h-7"
                              disabled={disabled}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <span className="w-6 text-left pl-1 text-[11px] font-black text-slate-400 shrink-0 select-none">
                      {row.id}
                    </span>
                  </div>
                ))}

                <p className="text-center text-[10px] text-slate-400 font-medium pt-0.5">
                  ← Swipe / scroll horizontally to see all seats in row →
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

      {/* Block Seat Counter Footer */}
      {activeBlock && blockStats.total > 0 && (
        <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
          <span>
            Block <span className="font-black text-amber-600">{activeBlock}</span> • Total: {blockStats.total}
          </span>
          <span className="flex items-center gap-2">
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
