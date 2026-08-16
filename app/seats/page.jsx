"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChairSvg from "../components/ChairSvg";

const blockOrder = { B: ["C", "B", "A"], C: ["A", "C", "B"], A: ["B", "A", "C"] };

const generateRows = (count, startSeats) =>
  Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    count: startSeats + i,
  }));

const blockSeats = {
  A: generateRows(8, 10),
  B: generateRows(10, 15),
  C: generateRows(8, 12),
};

export default function SeatSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState([]);
  const [activeBlock, setActiveBlock] = useState("B");
  const seatPrice = 100;
  const selectedRows = [...new Set(selected.map((k) => k.split("-")[0]))].join(", ");

  const toggleSeat = (rowId, seatIndex) => {
    const key = `${rowId}-${seatIndex}`;
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-28 shadow-2xl flex flex-col overflow-hidden">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-700 shadow-md border border-slate-200 text-sm active:scale-95 transition-transform"
        >
          <i className="fa-solid fa-arrow-left" />
        </button>

        <div className="flex-1 p-4 space-y-4">
          {/* Stage Area - Top Center */}
          <div className="flex flex-col items-center">
            <div className="w-[85%] max-w-md bg-white rounded-2xl border border-slate-200 shadow-md px-4 py-3 flex flex-col items-center">
              <div className="relative w-full flex items-center justify-center leading-none">
                {blockOrder[activeBlock].map((letter) => (
                  <button
                    key={letter}
                    onClick={() => {
                      setActiveBlock(letter);
                      setSelected([]);
                    }}
                    aria-label={`Select block ${letter}`}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-black font-brand uppercase drop-shadow transition-all active:scale-95 mx-1.5 ${
                      activeBlock === letter
                        ? "bg-amber-400 text-slate-900 scale-110 shadow-lg border-2 border-amber-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <span className="text-slate-900 font-black tracking-[0.35em] text-xs sm:text-sm font-brand uppercase mt-2 block">
                BLOCK
              </span>
              <span className="text-slate-500 font-bold tracking-widest text-[8px] sm:text-[9px] uppercase mt-0.5 block">
                {activeBlock === "A" ? "Right Side" : activeBlock === "C" ? "Left Side" : "Front"}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-green-400 border-2 border-slate-900 inline-block" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-amber-400 border-2 border-slate-900 inline-block" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-gray-300 border-2 border-slate-900 inline-block" /> Booked
            </span>
          </div>

          {/* Seating Area */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            {blockSeats[activeBlock].map((row, rowIndex) => (
              <div key={row.id} className="flex items-center gap-0.5">
                <span className="w-6 text-right pr-1 text-[10px] font-black text-slate-400">{row.id}</span>
                <div className="flex-1 overflow-x-auto">
                    <div className="flex w-max mx-auto -space-x-1.5">
                    {Array.from({ length: row.count }).map((_, i) => {
                      const seatNo = i + 1;
                      const key = `${row.id}-${seatNo}`;
                      const isBooked = (seatNo * 2 + rowIndex) % 5 === 0;
                      return (
                        <div key={key} className="flex flex-col items-center shrink-0">
                          <ChairSvg
                            isBooked={isBooked}
                            isSelected={selected.includes(key)}
                            onClick={() => toggleSeat(row.id, seatNo)}
                            label={`${row.id}${seatNo}`}
                            sizeClass="w-9 h-11"
                          />
                        </div>
                      );
                    })}
                    </div>
                  </div>
                <span className="w-6 text-left pl-1 text-[10px] font-black text-slate-400">{row.id}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-slate-400 font-medium">
            Tap a seat to select. Selected: <span className="font-black text-amber-600">{selected.length}</span>
          </p>
        </div>

        {/* Bottom Summary + CTA */}
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-2xl p-4 bg-white border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] space-y-2.5">
          {/* Calculation Bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="flex-shrink-0 bg-indigo-950 text-white font-black text-[10px] px-2 py-1 rounded-md">
                Row {selectedRows || "—"}
              </span>
              <span className="font-black text-slate-700 truncate">
                VIP <span className="text-slate-300 font-normal mx-0.5">•</span> {selected.length} seat{selected.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">Total Amount</p>
              <p className="text-base font-black text-emerald-600 leading-tight">₹{selected.length * seatPrice}</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/book")}
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
