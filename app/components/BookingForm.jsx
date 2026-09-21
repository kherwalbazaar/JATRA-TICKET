"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function BookingForm({ onClose, onProceed, fullPage = false, block = "", seats = "", seatPrice = 0 }) {
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [seatList, setSeatList] = useState(seats ? seats.split(",").filter(Boolean) : []);
  const totalAmount = seatPrice * seatList.length;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`flex flex-col ${fullPage ? "min-h-screen" : "max-h-[96vh]"} bg-white text-slate-800`}>
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm shadow-xs">
            <i className="fa-solid fa-ticket-simple -rotate-45" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">BOOK TICKETS</h2>
            <p className="text-[11px] font-semibold text-slate-400">Select payment method to confirm</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-base" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className={`p-4 sm:p-5 space-y-6 flex-1 text-slate-800 ${fullPage ? "" : "overflow-y-auto"}`}>
        {/* Select Seats Shortcut */}
        <div className="space-y-2">
          <Link
            href="/seats"
            className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-700 to-purple-700 text-white rounded-2xl px-4 py-3 shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 text-sm">
                <i className="fa-solid fa-chair" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black font-brand uppercase tracking-wide">Select Seats</p>
                <p className="text-[10px] text-white/70 font-medium">Pick your favourite seats on the seating map</p>
              </div>
            </div>
            <i className="fa-solid fa-arrow-right text-sm bg-white/20 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" />
          </Link>
          {seatList.length > 0 && (
            <div className="space-y-1.5 px-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{seatList.length} seat{seatList.length !== 1 ? "s" : ""} selected</span>
                <button
                  onClick={() => setSeatList([])}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700"
                >
                  Delete All
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {seatList.map((s, i) => (
                  <span key={s} className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    {s}
                    <button onClick={() => setSeatList((prev) => prev.filter((_, idx) => idx !== i))} className="text-amber-600 hover:text-red-600 ml-0.5">
                      <i className="fa-solid fa-xmark text-[8px]" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PAYMENT METHOD */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">1</span>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Payment Method</h4>
          </div>

          <div className="space-y-2">
            {[
              { key: "upi", icon: "fa-brands fa-google-pay text-purple-700 text-base", title: "UPI / QR", desc: "Pay using any UPI app", disabled: false },
              { key: "online", icon: "fa-solid fa-credit-card text-slate-400 text-sm", title: "Online Payment", desc: "Pay securely using card / net banking", disabled: true },
              { key: "cash", icon: "fa-solid fa-money-bill-wave text-slate-400 text-sm", title: "Cash at Counter", desc: "Pay at ticket counter", disabled: true },
            ].map((opt) => (
              <label
                key={opt.key}
                onClick={() => !opt.disabled && setPaymentMethod(opt.key)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  opt.disabled
                    ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                    : paymentMethod === opt.key
                      ? "border-purple-600 bg-purple-50/40 shadow-xs cursor-pointer"
                      : "border-slate-200 bg-white cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <i className={opt.icon} />
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-tight">{opt.title}</p>
                    <p className="text-[9px] text-slate-500 font-medium">{opt.desc}</p>
                    {opt.disabled && <p className="text-[8px] text-slate-400 font-bold mt-0.5">Coming soon</p>}
                  </div>
                </div>
                <input type="radio" checked={paymentMethod === opt.key} disabled={opt.disabled} readOnly className="text-purple-600 focus:ring-purple-500" />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM CTA STRIP */}
      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 space-y-2.5">
        <button
          onClick={() => onProceed?.({ paymentMethod })}
          className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <span>Confirm & Book • ₹{totalAmount}</span>
          <i className="fa-solid fa-chevron-right text-[10px]" />
        </button>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-1">
          <div className="flex items-center gap-1">
            <i className="fa-solid fa-lock text-slate-400 text-[9px]" />
            <span>Your booking is 100% secure and safe.</span>
          </div>
          <div className="flex items-center gap-1">
            <i className="fa-solid fa-headset text-slate-400 text-[9px]" />
            <span>Need Help? <a href="#" className="text-purple-700 hover:underline">Contact Support</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}
