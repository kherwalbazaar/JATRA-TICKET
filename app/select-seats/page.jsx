"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import BlockCategoryDiagram from "../components/BlockCategoryDiagram";
import UserSeatGrid from "../components/UserSeatGrid";
import {
  subscribeSeats,
  holdSeat,
  releaseSeatHold,
} from "../../lib/seats";
import {
  subscribeBlockCategories,
  isBlockOnline,
  blockDisplayName,
} from "../../lib/blockCategories";

function SelectSeatsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") || "";
  const eventName = searchParams.get("event") || "Event";
  const eventDate = searchParams.get("date") || "";
  const eventTime = searchParams.get("time") || "";
  const returnTo = searchParams.get("return") || "";

  const [activeBlock, setActiveBlock] = useState(null);
  const [selected, setSelected] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState({});
  const [seatsByBlock, setSeatsByBlock] = useState({});
  const [loading, setLoading] = useState(true);
  const [blockCats, setBlockCats] = useState([]);

  const seatGridRef = useRef(null);

  useEffect(() => subscribeBlockCategories(setBlockCats), []);

  const isOnlineBlock = (id) => isBlockOnline(blockCats, id);
  const blockLabel = (id) => blockDisplayName(blockCats, id);

  const seatPrice = useMemo(() => {
    const list = seatsByBlock[activeBlock] || [];
    const found = list.find((s) => s.price != null && Number(s.price) > 0);
    return found ? Number(found.price) : 0;
  }, [seatsByBlock, activeBlock]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let first = true;
    const unsub = subscribeSeats(eventId, (seats) => {
      setSeatsByBlock(seats);
      if (first) {
        first = false;
        setLoading(false);
      }
    });
    return () => unsub();
  }, [eventId]);

  const toggleSeat = useCallback(
    (key) => {
      const list = seatsByBlock[activeBlock] || [];
      const fs = list.find(
        (s) =>
          s.id === key ||
          s.seatLabel === key ||
          `${s.rowId}-${s.seatNumber}` === key ||
          `${s.rowId}${s.seatNumber}` === key
      );
      const st = String(fs?.status || "").toLowerCase();
      if (fs && (st === "booked" || st === "locked" || st === "sold")) return;

      const removing = selected.includes(key);
      if (!removing && selected.length >= 10) return;

      const label =
        fs?.seatLabel ||
        (fs?.rowId && fs?.seatNumber ? `${fs.rowId}${fs.seatNumber}` : key);

      setSelected((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
      setSelectedLabels((prev) => {
        const next = { ...prev };
        if (removing) {
          delete next[key];
        } else {
          next[key] = label;
        }
        return next;
      });

      if (removing) {
        releaseSeatHold(eventId, activeBlock, key);
      } else {
        holdSeat(eventId, activeBlock, key);
      }
    },
    [activeBlock, selected, eventId, seatsByBlock]
  );

  const handleBlockSelect = (blockId) => {
    if (!isOnlineBlock(blockId)) return;
    if (activeBlock !== blockId) {
      selected.forEach((k) => releaseSeatHold(eventId, activeBlock, k));
      setSelected([]);
      setSelectedLabels({});
    }
    setActiveBlock(blockId);
    setTimeout(() => {
      seatGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const totalAmount = seatPrice * selected.length;

  const handleProceed = () => {
    if (!activeBlock || selected.length === 0) return;
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (eventName) params.set("event", eventName);
    if (eventDate) params.set("date", eventDate);
    if (eventTime) params.set("time", eventTime);
    params.set("block", activeBlock);
    params.set("seats", selected.join(","));
    params.set("seatPrice", String(seatPrice));
    const dest = returnTo
      ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}${params.toString()}`
      : `/book?${params.toString()}`;
    router.push(dest);
  };

  if (!eventId) {
    return (
      <div className="bg-slate-900 min-h-screen">
        <div className="bg-[#f8faff] min-h-screen">
          <Header />
          <div className="p-6 text-center">
            <p className="text-sm font-bold text-slate-600">
              No event selected. Please choose an event first.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 bg-indigo-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl"
            >
              Go Home
            </button>
          </div>
          <BottomNav active="home" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-32 shadow-2xl flex flex-col overflow-x-hidden">
        <Header />

        <div className="flex-1 p-4 space-y-4">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-lg font-black text-slate-900 font-brand">
              Select Your Seat
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {eventName}
              {eventDate ? ` • ${eventDate}` : ""}
            </p>
          </div>

          {/* Stage Diagram Only */}
          <BlockCategoryDiagram
            seatsByBlock={seatsByBlock}
            activeBlock={activeBlock}
            onSelectBlock={handleBlockSelect}
            seatPrice={seatPrice}
            title="Stage & Block Map"
          />

          {/* Seat Rows — only real seats from database */}
          {activeBlock && (
            <div ref={seatGridRef} className="space-y-3">
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
          )}

          {!activeBlock && !loading && (
            <p className="text-center text-xs text-slate-400 font-medium py-4">
              Tap any green block on the map to view real seats from database
            </p>
          )}
        </div>

        {/* Bottom Bar: selected seats + total + Proceed */}
        {activeBlock && selected.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-2xl p-4 bg-white border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] space-y-2.5 z-40">
            {/* Selected seat chips — show seat labels like A1, B2 */}
            <div className="flex flex-wrap gap-1.5">
              {selected.map((s) => (
                <span
                  key={s}
                  className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1.5"
                >
                  <span>{selectedLabels[s] || s}</span>
                  <button
                    type="button"
                    onClick={() => toggleSeat(s)}
                    className="text-amber-700 hover:text-rose-600"
                  >
                    <i className="fa-solid fa-xmark text-[9px]" />
                  </button>
                </span>
              ))}
            </div>

            {/* Total row */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div className="text-[11px] text-slate-600 font-semibold">
                {selected.length} seat{selected.length > 1 ? "s" : ""}
                {seatPrice > 0 ? ` × ₹${seatPrice}` : ""}
              </div>
              <div className="text-sm font-black text-slate-900">
                Total ₹{totalAmount}
              </div>
            </div>

            {/* Proceed */}
            <button
              type="button"
              onClick={handleProceed}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-indigo-200 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              <span>
                Proceed • ₹{totalAmount}
              </span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SelectSeatsPage() {
  return (
    <Suspense fallback={null}>
      <SelectSeatsContent />
    </Suspense>
  );
}
