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
  const [viewMode, setViewMode] = useState("grid"); // "grid" (default) | "row"

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
      <div className="w-full min-h-[120px] flex flex-col justify-center bg-transparent border-0 shadow-none p-1 sm:p-2">
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
            {/* Block Header Banner - Single Line (Fill to Width) */}
            <div className="w-full flex items-center gap-1 sm:gap-1.5 pb-2.5 border-b border-slate-100 flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none">
              <span className="flex-1 min-w-0 bg-sky-500 text-slate-950 font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-wider text-center flex items-center justify-center truncate shrink-0">
                Block {activeBlock}
              </span>
              <span className="flex-1 min-w-0 bg-slate-100 text-slate-700 font-bold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-1 rounded-lg text-center flex items-center justify-center truncate shrink-0">
                Seat {viewMode === "grid" ? "Grid" : "List"} View
              </span>
              {pricePerSeat != null && (
                <span className="flex-1 min-w-0 text-indigo-700 bg-indigo-50 border border-indigo-200 font-bold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-1 rounded-lg text-center flex items-center justify-center truncate shrink-0">
                  ₹{pricePerSeat} / seat
                </span>
              )}
              <span className="flex-1 min-w-0 text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-1 rounded-lg text-center flex items-center justify-center truncate shrink-0">
                {blockStats.booked}/{blockStats.total}
              </span>
              {selected.length > 0 && (
                <span className="flex-1 min-w-0 text-amber-800 bg-amber-100 border border-amber-300 font-bold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-1 rounded-lg text-center flex items-center justify-center truncate shrink-0">
                  {selected.length} Selected
                </span>
              )}

              {/* View Switcher: Single button with Grid / List icon (Fill to Width) */}
              <button
                type="button"
                onClick={() => setViewMode((prev) => (prev === "grid" ? "row" : "grid"))}
                className="flex-1 min-w-0 flex items-center justify-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-[9px] sm:text-[10px] font-bold text-slate-700 shadow-2xs cursor-pointer select-none active:scale-95 truncate shrink-0"
                title={viewMode === "grid" ? "Click to switch to List View" : "Click to switch to Grid View"}
              >
                <i
                  className={`fa-solid ${
                    viewMode === "grid" ? "fa-grip text-sky-600" : "fa-bars text-indigo-600"
                  } text-[10px]`}
                />
                <span>{viewMode === "grid" ? "Grid" : "List"}</span>
              </button>
            </div>


            {/* View Mode: Grid (as per screen width) vs Row View */}
            {viewMode === "grid" ? (
              <div className="space-y-3 py-1">
                {rows.map((row) => (
                  <div key={row.id} className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                        Row-{row.id}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                        {row.seats.filter((s) => s.status === "booked" || s.status === "sold").length}/{row.seats.length}
                      </span>
                    </div>

                    {/* Responsive Grid: close to each other, fills width, wraps naturally */}
                    <div
                      className="grid gap-[2px] sm:gap-1 w-full py-0.5 justify-items-center"
                      style={{
                        gridTemplateColumns: "repeat(auto-fill, minmax(22px, 1fr))",
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
                            title={`${seatLabel} • ₹${seat.price || pricePerSeat || 50} • ${
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
            ) : (
              /* Row View: Horizontal Row Layout */
              <div className="space-y-2.5 overflow-x-auto pb-4 pt-2 select-none scrollbar-thin">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-1.5 min-w-max mx-auto justify-center px-2 py-1 rounded-xl hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Left Row Badge */}
                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0 shadow-xs border border-slate-700">
                      {row.id}
                    </span>

                    {/* Horizontal Seats in Row: close to each other with slight gap */}
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
                            title={`${seatLabel} • ₹${seat.price || pricePerSeat || 100} • ${
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
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs border border-slate-700">
                      {row.id}
                    </span>
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
