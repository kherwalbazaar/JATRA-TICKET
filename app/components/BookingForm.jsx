"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { subscribeTicketTypes } from "../../lib/ticketTypes";
import { calculateCustomerCharges } from "../../lib/pricing";

// Pricing cards on the home page use these ids when they call
// setBooking({ tierId }). Keep them in sync with that list.
export const bookingTiers = [
  { id: "standing", name: "STANDING", price: 50, gate: "Gate A" },
  { id: "special", name: "SPECIAL", price: 100, gate: "Gate B" },
  { id: "vip", name: "VIP", price: 200, gate: "Gate C" },
  { id: "star", name: "STAR", price: 500, gate: "Gate D" },
];

const FALLBACK_TIER = bookingTiers[0];

function matchByName(remoteTiers, name) {
  const wanted = String(name).trim().toUpperCase();
  return (
    remoteTiers.find((t) => String(t.name || "").trim().toUpperCase() === wanted) ||
    remoteTiers.find((t) => String(t.id || "").trim().toUpperCase() === wanted)
  );
}

/** Static card definition + the admin's Firestore tier (price / doc id). */
function mergeTiers(remoteTiers) {
  return bookingTiers.map((card) => {
    const remote = matchByName(remoteTiers, card.name);
    if (!remote) return { ...card, cardId: card.id, price: card.price };
    return {
      id: remote.id || card.id,
      cardId: card.id,
      name: remote.name || card.name,
      price: Number(remote.price) > 0 ? Number(remote.price) : card.price,
      gate: card.gate,
    };
  });
}


export default function BookingForm({
  onClose,
  onProceed,
  fullPage = false,
  block = "",
  seats = "",
  seatPrice = 0,
  initialTierId = "vip",
  initialQuantity = 1,
  eventName = "",
}) {
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [seatList, setSeatList] = useState(seats ? seats.split(",").filter(Boolean) : []);
  const [quantity, setQuantity] = useState(Math.max(1, Number(initialQuantity) || 1));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState("");
  const [remoteTiers, setRemoteTiers] = useState([]);

  // Prices/tier ids come from the ADMIN panel's `ticketTypes` collection so
  // the amount charged here is always the amount the admin configured.
  useEffect(() => {
    let active = true;
    const unsub = subscribeTicketTypes((list) => {
      if (active && Array.isArray(list)) setRemoteTiers(list);
    });
    return () => {
      active = false;
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const tiers = useMemo(() => mergeTiers(remoteTiers), [remoteTiers]);

  const tier = useMemo(
    () =>
      tiers.find((t) => t.cardId === initialTierId) ||
      tiers.find((t) => t.id === initialTierId) ||
      { ...FALLBACK_TIER, cardId: FALLBACK_TIER.id },
    [tiers, initialTierId],
  );

  const hasSeats = seatList.length > 0;
  const rawTicketAmount = hasSeats
    ? seatPrice * seatList.length
    : tier.price * quantity;
  const pricing = useMemo(() => calculateCustomerCharges(rawTicketAmount), [rawTicketAmount]);
  const totalAmount = pricing.finalCustomerAmount;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleProceed = () => {
    if (!customerName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(customerPhone.trim())) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setError("");

    onProceed?.({
      paymentMethod,
      tier: hasSeats
        ? { id: "seated", name: `SEATED (${block})`, price: seatPrice, gate: `Block ${block}` }
        : tier,
      quantity: hasSeats ? seatList.length : quantity,
      ticketAmount: pricing.ticketAmount,
      convenienceFee: pricing.convenienceFee,
      gstOnConvenienceFee: pricing.gstOnConvenienceFee,
      platformCharge: pricing.platformCharge,
      totalAmount: pricing.finalCustomerAmount,
      pricing,
      seats: seatList,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      eventName,
    });
  };

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
          {hasSeats && (
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

        {/* TIER + QUANTITY (only when no seats were picked) */}
        {!hasSeats && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">1</span>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Ticket & Quantity</h4>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl border border-purple-100 bg-purple-50/50">
              <div>
                <p className="text-xs font-black text-slate-900 tracking-wide">{tier.name}</p>
                <p className="text-[10px] font-semibold text-slate-500">
                  ₹{tier.price} per ticket &bull; {tier.gate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black flex items-center justify-center active:scale-95"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-black text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black flex items-center justify-center active:scale-95"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* YOUR DETAILS — stored on `bookings` so the admin panel and the
            gate scanner can show who the ticket belongs to. */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">
              {hasSeats ? "1" : "2"}
            </span>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Your Details</h4>
          </div>

          <div className="space-y-2">
            <div>
              <label htmlFor="bk-customer-name" className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Full Name *
              </label>
              <input
                id="bk-customer-name"
                type="text"
                autoComplete="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label htmlFor="bk-customer-phone" className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Mobile Number *
              </label>
              <input
                id="bk-customer-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter your mobile number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
              />
            </div>
            {error && (
              <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                {error}
              </p>
            )}
          </div>
        </div>

        {/* PAYMENT METHOD */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">
              {hasSeats ? "2" : "3"}
            </span>
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
                    <p className="text-[9px] font-medium text-slate-500">{opt.desc}</p>
                    {opt.disabled && <p className="text-[8px] font-bold text-slate-400 mt-0.5">Coming soon</p>}
                  </div>
                </div>
                <input type="radio" checked={paymentMethod === opt.key} disabled={opt.disabled} readOnly className="text-purple-600 focus:ring-purple-500" />
              </label>
            ))}
          </div>
        </div>

        {/* PRICE SUMMARY */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">
              {hasSeats ? "3" : "4"}
            </span>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Payment Breakdown</h4>
          </div>

          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span>Ticket Amount ({hasSeats ? `${seatList.length} seat${seatList.length !== 1 ? "s" : ""}` : `${quantity} ticket${quantity !== 1 ? "s" : ""}`})</span>
                <span className="font-bold text-slate-900">₹{pricing.ticketAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <span>Convenience Fee</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(2.70%)</span>
                </span>
                <span className="font-semibold text-slate-800">₹{pricing.convenienceFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <span>GST on Convenience Fee</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(18%)</span>
                </span>
                <span className="font-semibold text-slate-800">₹{pricing.gstOnConvenienceFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span>Platform Charge</span>
                <span className="font-semibold text-slate-800">₹{pricing.platformCharge.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-900 block leading-tight">Final Customer Amount</span>
                <span className="text-[9px] text-slate-400 font-semibold">Inclusive of all fees & GST</span>
              </div>
              <span className="text-base font-black text-emerald-600">₹{pricing.finalCustomerAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CTA STRIP */}
      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 space-y-2.5">
        <button
          onClick={handleProceed}
          className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <span>Confirm & Book • ₹{totalAmount.toFixed(2)}</span>
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
