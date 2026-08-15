"use client";

import React from "react";
import BookingForm from "./BookingForm";

export { bookingTiers } from "./BookingForm";

export default function BookTicketsModal({ onClose, onProceed, initialTierId = "vip", initialQuantity = 4 }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans text-slate-800 antialiased"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <BookingForm
          onClose={onClose}
          onProceed={onProceed}
          initialTierId={initialTierId}
          initialQuantity={initialQuantity}
        />
      </div>
    </div>
  );
}