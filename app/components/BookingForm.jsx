"use client";

import React, { useEffect, useState } from "react";

export const bookingTiers = [
  { id: "general", name: "GENERAL", price: 50, gate: "Gate A", available: 1200, icon: "fa-users", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { id: "premium", name: "PREMIUM", price: 100, gate: "Gate B", available: 850, icon: "fa-star", iconBg: "bg-sky-50", iconColor: "text-sky-600" },
  { id: "vip", name: "VIP", price: 200, gate: "Gate C", available: 420, icon: "fa-crown", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
  { id: "vvip", name: "VVIP", price: 500, gate: "Gate D", available: 80, icon: "fa-gem", iconBg: "bg-orange-50", iconColor: "text-orange-500" },
];

export default function BookingForm({ onClose, onProceed, initialTierId = "vip", initialQuantity = 4, fullPage = false }) {
  const [selectedTier, setSelectedTier] = useState(bookingTiers.find((t) => t.id === initialTierId) ?? bookingTiers[2]);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [sameAsBooking, setSameAsBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");

  const [holders, setHolders] = useState([
    { name: "Balakram Tudu", mobile: "9876543210" },
    { name: "Rakesh Murmu", mobile: "7654321098" },
    { name: "Sanjay Hansda", mobile: "8012345678" },
    { name: "Gita Tudu", mobile: "9098765432" },
  ]);

  const [contact, setContact] = useState({
    name: "Balakram Tudu",
    mobile: "9876543210",
    email: "balakramtudu@gmail.com",
  });

  useEffect(() => {
    if (quantity > holders.length) {
      const added = Array.from({ length: quantity - holders.length }, () => ({ name: "", mobile: "" }));
      setHolders((prev) => [...prev, ...added]);
    } else {
      setHolders((prev) => prev.slice(0, quantity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleQuantityChange = (newQty) => {
    if (newQty < 1 || newQty > 10) return;
    setQuantity(newQty);
    setHolders((prev) => {
      if (newQty > prev.length) {
        const added = Array.from({ length: newQty - prev.length }, () => ({ name: "", mobile: "" }));
        return [...prev, ...added];
      }
      return prev.slice(0, newQty);
    });
  };

  const handleHolderChange = (index, field, value) => {
    setHolders((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleRemoveHolder = (index) => {
    if (quantity <= 1) return;
    const updated = holders.filter((_, i) => i !== index);
    setHolders(updated);
    setQuantity(updated.length);
  };

  const totalAmount = selectedTier.price * quantity;

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
            <p className="text-[11px] font-semibold text-slate-400">Fill the details and select your tickets</p>
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
        {/* EVENT SUMMARY & LIVE COUNTDOWN CARD */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3 justify-between">
          <div className="flex gap-3 items-center flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80"
              alt="Event"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-1 ring-slate-100 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate uppercase tracking-tight">
                ADIM LAHAH MANDAWA 2026
              </h3>
              <div className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-rose-500 text-xs" />
                  <span>22 Oct 2026 (Thu)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-regular fa-clock text-indigo-600 text-xs" />
                  <span>8:00 PM Onwards</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-location-dot text-rose-500 text-xs" />
                  <span className="truncate">Balanada</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-2.5 flex flex-col justify-center text-center sm:min-w-[140px]">
            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">
              <i className="fa-solid fa-tag text-[9px]" />
              <span>Event Starts In</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-purple-950 font-mono tracking-wider flex items-center justify-center gap-1">
              <span>05</span>:<span>12</span>:<span>48</span>:<span>30</span>
            </div>
            <div className="flex justify-between text-[8px] font-bold text-slate-400 px-2 mt-0.5 uppercase">
              <span>Days</span><span>Hrs</span><span>Mins</span><span>Secs</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: SELECT TICKET TYPE */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">1</span>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Select Ticket Type</h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {bookingTiers.map((tier) => {
              const isSelected = selectedTier.id === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={`relative rounded-2xl p-3 text-center border-2 transition-all flex flex-col items-center justify-between ${
                    isSelected
                      ? "border-purple-600 bg-purple-50/40 shadow-sm"
                      : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px]">
                      <i className="fa-solid fa-check" />
                    </div>
                  )}

                  <div className={`w-7 h-7 rounded-xl ${tier.iconBg} flex items-center justify-center text-sm mb-1.5`}>
                    <i className={`fa-solid ${tier.icon} ${tier.iconColor}`} />
                  </div>

                  <span className="text-[10px] font-black text-slate-800 tracking-tight">{tier.name}</span>
                  <span className="text-base font-black text-slate-900 my-0.5">₹{tier.price}</span>
                  <span className="text-[10px] font-semibold text-slate-500">{tier.gate}</span>

                  <span className={`text-[9px] font-extrabold mt-1 ${tier.available < 100 ? "text-amber-600" : "text-emerald-600"}`}>
                    {tier.available} Available
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: SELECT QUANTITY */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">2</span>
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Select Quantity</h4>
                <p className="text-[10px] text-slate-400 font-medium">How many tickets do you want to book?</p>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
                className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-opacity"
              >
                <i className="fa-solid fa-minus text-xs" />
              </button>
              <span className="w-8 text-center text-sm font-black text-slate-900 font-mono">{quantity}</span>
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= 10}
                className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-opacity"
              >
                <i className="fa-solid fa-plus text-xs" />
              </button>
            </div>
          </div>

          <div className="bg-purple-50/60 border border-purple-100 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] font-semibold text-purple-900">
            <i className="fa-solid fa-users text-purple-600 text-xs" />
            <span>You can book maximum 10 tickets in one booking.</span>
          </div>
        </div>

        {/* SECTION 3: TICKET HOLDER DETAILS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">3</span>
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Ticket Holder Details</h4>
                <p className="text-[10px] text-slate-400 font-medium">Enter details of each ticket holder</p>
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600">
              <input
                type="checkbox"
                checked={sameAsBooking}
                onChange={(e) => setSameAsBooking(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Same as booking details</span>
            </label>
          </div>

          <div className="space-y-2">
            {holders.map((holder, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0 relative">
                  <label className="absolute -top-1.5 left-2 bg-white px-1 text-[8px] font-bold text-slate-400 uppercase">Name *</label>
                  <input
                    type="text"
                    value={holder.name}
                    onChange={(e) => handleHolderChange(idx, "name", e.target.value)}
                    placeholder="Full Name"
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="flex-1 min-w-0 relative">
                  <label className="absolute -top-1.5 left-2 bg-white px-1 text-[8px] font-bold text-slate-400 uppercase">Mobile (Optional)</label>
                  <input
                    type="tel"
                    value={holder.mobile}
                    onChange={(e) => handleHolderChange(idx, "mobile", e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
                  />
                </div>

                {idx === 0 ? (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-1 rounded-lg border border-emerald-200">
                    Primary
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveHolder(idx)}
                    className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                  >
                    <i className="fa-regular fa-trash-can text-xs" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {quantity < 10 && (
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity + 1)}
              className="w-full py-2.5 bg-white border border-purple-300 text-purple-700 font-extrabold text-xs rounded-xl hover:bg-purple-50/50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <i className="fa-solid fa-plus text-[10px]" />
              <span>Add More Ticket Holder</span>
            </button>
          )}
        </div>

        {/* SECTION 4: CONTACT & PAYMENT */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center">4</span>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Contact & Payment</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Contact Details</h5>

              <div className="space-y-2">
                <div className="relative">
                  <label className="absolute -top-1.5 left-2 bg-slate-50 px-1 text-[8px] font-bold text-slate-400 uppercase">Your Name *</label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="relative">
                  <label className="absolute -top-1.5 left-2 bg-slate-50 px-1 text-[8px] font-bold text-slate-400 uppercase">Mobile Number *</label>
                  <input
                    type="tel"
                    value={contact.mobile}
                    onChange={(e) => setContact({ ...contact, mobile: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="relative">
                  <label className="absolute -top-1.5 left-2 bg-slate-50 px-1 text-[8px] font-bold text-slate-400 uppercase">Email (Optional)</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
              <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-2">Payment Method</h5>

              {[
                { key: "upi", icon: "fa-brands fa-google-pay text-purple-700 text-base", title: "UPI / QR", desc: "Pay using any UPI app" },
                { key: "online", icon: "fa-solid fa-credit-card text-slate-700 text-sm", title: "Online Payment", desc: "Pay securely using card / net banking" },
                { key: "cash", icon: "fa-solid fa-money-bill-wave text-emerald-600 text-sm", title: "Cash at Counter", desc: "Pay at ticket counter" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  onClick={() => setPaymentMethod(opt.key)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === opt.key ? "border-purple-600 bg-purple-50/40 shadow-xs" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <i className={opt.icon} />
                    <div>
                      <p className="text-xs font-black text-slate-900 leading-tight">{opt.title}</p>
                      <p className="text-[9px] text-slate-500 font-medium">{opt.desc}</p>
                    </div>
                  </div>
                  <input type="radio" checked={paymentMethod === opt.key} readOnly className="text-purple-600 focus:ring-purple-500" />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SUMMARY & CTA STRIP */}
      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50 rounded-xl p-2 flex-1 text-center border border-slate-100">
            <div>
              <span className="text-[8px] uppercase font-bold text-slate-400 block">Ticket Type</span>
              <span className="text-xs font-black text-slate-900 truncate">{selectedTier.name}</span>
            </div>
            <div>
              <span className="text-[8px] uppercase font-bold text-slate-400 block">Quantity</span>
              <span className="text-xs font-black text-slate-900">{quantity}</span>
            </div>
            <div>
              <span className="text-[8px] uppercase font-bold text-slate-400 block">Ticket Price</span>
              <span className="text-xs font-black text-slate-900">₹{selectedTier.price}</span>
            </div>
            <div>
              <span className="text-[8px] uppercase font-bold text-slate-400 block">Total Amount</span>
              <span className="text-xs font-black text-emerald-600">₹{totalAmount}</span>
            </div>
          </div>

          <button
            onClick={() => onProceed?.({ tier: selectedTier, quantity, holders, contact, paymentMethod, totalAmount })}
            className="bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-xs py-3 px-5 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform flex-shrink-0"
          >
            <span>Proceed to Payment</span>
            <i className="fa-solid fa-chevron-right text-[10px]" />
          </button>
        </div>

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