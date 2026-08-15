"use client";

import { useState } from "react";

export default function TicketDetail({ ticket }) {
  const [copied, setCopied] = useState(false);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const qrData = `${ticket.id}-${ticket.name.toUpperCase().replace(/\s+/g, "-")}`;

  return (
    <div className="w-full bg-[#f8faff] min-h-screen relative pb-10 shadow-2xl flex flex-col overflow-hidden">
      {/* Top App Bar with Back & Share */}
      <header className="bg-[#12193b] px-4 py-3.5 text-white flex items-center justify-between sticky top-0 z-50 shadow-md">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white text-base active:scale-95 transition-transform"
        >
          <i className="fa-solid fa-arrow-left" />
        </button>

        <h2 className="text-base font-black font-brand tracking-wide">Ticket Details</h2>

        <button
          onClick={() => copy(`${ticket.name} | ${ticket.id} | ${ticket.category} | ${ticket.gate} | 22 Oct 2026 | Balanada`)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white text-base active:scale-95 transition-transform"
        >
          <i className={copied ? "fa-solid fa-check text-emerald-400" : "fa-solid fa-share-nodes"} />
        </button>
      </header>

      {/* Notification Bar */}
      <div className="bg-amber-400/90 text-slate-950 px-4 py-2 flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide shadow-inner">
        <i className="fa-regular fa-clock text-sm" />
        <span>Show this ticket at the entry gate</span>
      </div>

      <main className="p-4 space-y-4">
        {/* Event Header Summary */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80"
            alt="Banner"
            className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-100 flex-shrink-0"
          />

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 font-brand truncate uppercase tracking-tight">ADIM LAHAH MANDAWA 2026</h3>
            <div className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-600">
              <div className="flex items-center gap-1.5">
                <i className="fa-regular fa-calendar text-rose-500 text-[11px]" />
                <span>22 Oct 2026 (Thu)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="fa-regular fa-clock text-indigo-600 text-[11px]" />
                <span>8:00 PM Onwards</span>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-rose-500 text-[11px]" />
                <span className="truncate">Balanada</span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking ID Row */}
        <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-100 text-xs font-extrabold text-slate-700">
          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">BOOKING ID</span>
          <button onClick={() => copy("NJ26-00125")} className="flex items-center gap-1.5 text-indigo-900 hover:text-indigo-600">
            <span>{copied ? "Copied" : "NJ26-00125"}</span>
            <i className={`${copied ? "fa-solid fa-check text-emerald-600" : "fa-regular fa-copy"} text-xs`} />
          </button>
        </div>

        {/* Detailed Pass Ticket - Large QR Display */}
        <div className="relative bg-white rounded-3xl p-5 border-2 border-indigo-100 shadow-md text-center overflow-hidden">
          {/* Top Perforated Decorative Cutouts */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#f8faff] rounded-full border border-slate-200" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#f8faff] rounded-full border border-slate-200" />

          {/* Header */}
          <div className="mb-3">
            <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {ticket.category} • Gate Pass
            </span>
            <h3 className="text-xl font-black text-slate-900 font-brand mt-2 uppercase tracking-tight">
              ADIM OWAR JARPA OPERA
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              {ticket.name} • Entry via {ticket.gate}
            </p>
          </div>

          {/* Big Size QR Code Container */}
          <div className="relative inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200 shadow-inner my-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`}
              alt="Large QR Ticket"
              className="w-60 h-60 object-contain rounded-lg"
            />
          </div>

          {/* Prominent Serial Number Display Under QR Code */}
          <div className="mt-4 bg-slate-100 rounded-xl py-2 px-4 border border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
              Serial / Security Number
            </span>
            <p className="text-lg font-mono font-black tracking-widest text-indigo-950 select-all">
              {ticket.id}
            </p>
          </div>

          {/* Bottom Helper Note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-bold">
            <i className="fa-solid fa-circle-check" />
            <span>Valid for single entry</span>
          </div>
        </div>

        {/* Ticket Information Details Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs mb-1">
            <i className="fa-solid fa-id-card" />
            <span>Ticket Information</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Category</span>
              <span className="font-extrabold text-slate-900">{ticket.category}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Gate</span>
              <span className="font-extrabold text-emerald-700">{ticket.gate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Date</span>
              <span className="font-extrabold text-slate-900">22 Oct 2026 (Thu)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Entry Time</span>
              <span className="font-extrabold text-slate-900">6:00 PM onwards</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Event Time</span>
              <span className="font-extrabold text-slate-900">8:00 PM onwards</span>
            </div>
          </div>
        </div>

        {/* Important Security Note */}
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 flex items-start gap-2.5">
          <i className="fa-solid fa-shield-halved text-rose-500 text-base mt-0.5" />
          <div className="text-xs">
            <p className="font-black text-rose-950">Important Note</p>
            <p className="text-rose-800 font-medium text-[11px] mt-0.5 leading-snug">
              Please keep this ticket safe.
              <br />
              Do not share the screenshot publicly.
            </p>
          </div>
        </div>

        {/* Ticket Status Guide */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ticket Status Guide</h4>

          <div className="grid grid-cols-4 gap-2 text-center">
            <StatusGuide
              id="ACTIVE"
              label="ACTIVE"
              labelClass="text-emerald-600"
              desc="Ready for Entry"
              boxBorder="border-emerald-400"
            />
            <StatusGuide
              id="USED"
              label="USED"
              labelClass="text-emerald-700"
              desc="Entry Completed"
              boxBorder="border-slate-300"
              badge="border-emerald-600 text-emerald-700"
            />
            <StatusGuide
              id="EXPIRED"
              label="EXPIRED"
              labelClass="text-amber-600"
              desc="Event Ended"
              boxBorder="border-amber-300"
              badge="border-amber-600 text-amber-600"
            />
            <StatusGuide
              id="CANCELLED"
              label="CANCELLED"
              labelClass="text-red-600"
              desc="This ticket is cancelled"
              boxBorder="border-red-300"
              badge="border-red-600 text-red-600 text-[7px] px-0.5"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusGuide({ id, label, labelClass, desc, boxBorder, badge }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-12 h-12 p-1 bg-white border ${boxBorder} rounded-lg flex items-center justify-center mb-1 ${badge ? "opacity-70" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${id}`} alt={label} className={`w-full h-full object-contain ${badge ? "grayscale" : ""}`} />
        {badge && (
          <span className={`absolute inset-0 m-auto w-fit h-fit border-2 bg-white/95 ${badge} font-black px-1 rounded -rotate-12 uppercase`}>
            {label}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-black uppercase ${labelClass}`}>{label}</span>
      <span className="text-[9px] text-slate-500 font-medium leading-tight">{desc}</span>
    </div>
  );
}