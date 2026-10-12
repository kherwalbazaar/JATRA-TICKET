"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ChairSvg from "./ChairSvg";
import { subscribeSeats, getHoldSessionId, isHoldFresh } from "../../lib/seats";

/**
 * UserSeatGrid: Reactive real-time seat availability map for customer booking.
 * Subscribes to Firestore shows/{showId}/seats subcollection via onSnapshot.
 *
 * Ensures all seat state modifications (available, selected, booked, locked)
 * and newly generated admin seats stream dynamically into the UI without page reloads.
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
}) {
  const targetId = showId || eventId || "";
  const [internalSeats, setInternalSeats] = useState({});
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState(null);

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
            <p className="text-xs text-slate-500 font-semibold">Connecting to live seat map...</p>
          </div>
        ) : !targetId ? (
          <div className="text-center py-8">
            <p className="text-xs text-slate-500 font-medium">No show selected — seats cannot be loaded.</p>
          </div>
        ) : !activeBlock ? (
          <div className="text-center py-8 space-y-1">
            <i className="fa-solid fa-chair text-slate-300 text-2xl mb-1" />
            <p className="text-xs text-slate-500 font-medium">Click on a block on the seating map above to view seats</p>
          </div>
        ) : rows && rows.length > 0 ? (
          <div className="space-y-1.5 overflow-x-auto pb-2 pt-1 select-none">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-1 min-w-max mx-auto justify-center">
                <span className="w-6 text-right pr-1 text-[10px] font-black text-slate-400 shrink-0">
                  {row.id}
                </span>
                <div className="flex items-center gap-0.5">
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
                          sizeClass="w-4 h-5 sm:w-5 sm:h-6"
                          disabled={disabled}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-2">
            <i className="fa-solid fa-circle-info text-slate-400 text-xl" />
            <p className="text-xs text-slate-500 font-medium">
              No seats found for block <span className="font-bold text-slate-700">{activeBlock}</span>.
            </p>
            <p className="text-[10px] text-slate-400">Seats created by admin will appear here instantly.</p>
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
