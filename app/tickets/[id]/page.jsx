"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { fetchBookingByTicketNumber } from "../../../lib/bookings";

export default function TicketDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchBookingByTicketNumber(id);
      setTicket(data);
      setLoading(false);
    }
    load();
  }, [id]);

  const [copied, setCopied] = useState(false);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (loading) {
    return (
      <div className="bg-[#f8faff] min-h-screen flex items-center justify-center">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-[#f8faff] min-h-screen flex flex-col items-center justify-center">
        <i className="fa-solid fa-ticket-slash text-4xl text-slate-300 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Ticket not found</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-indigo-600 font-bold">Go Back</button>
      </div>
    );
  }

  const qrData = `${ticket.ticketNumber}-${ticket.ticketTypeName.toUpperCase().replace(/\s+/g, "-")}`;

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="w-full bg-[#f8faff] min-h-screen relative pb-10 shadow-2xl flex flex-col overflow-hidden">
        <Header
          showBack
          showShare
          title="Ticket Details"
          onShare={() => copy(`${ticket.ticketTypeName} | ${ticket.ticketNumber} | ${ticket.assignedGate} | ${ticket.date}`)}
        />

        <div className="bg-amber-400/90 text-slate-950 px-4 py-2 flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide shadow-inner">
          <i className="fa-regular fa-clock text-sm" />
          <span>Show this ticket at the entry gate</span>
        </div>

        <main className="p-4 space-y-4">
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80"
              alt="Banner"
              className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-100 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-900 font-brand truncate uppercase tracking-tight">Event Booking</h3>
              <div className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-rose-500 text-[11px]" />
                  <span>{ticket.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-regular fa-clock text-indigo-600 text-[11px]" />
                  <span>{ticket.time}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-location-dot text-rose-500 text-[11px]" />
                  <span className="truncate">{ticket.assignedGate}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-100 text-xs font-extrabold text-slate-700">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">BOOKING ID</span>
            <button onClick={() => copy(ticket.ticketNumber)} className="flex items-center gap-1.5 text-indigo-900 hover:text-indigo-600">
              <span>{copied ? "Copied" : ticket.ticketNumber}</span>
              <i className={`${copied ? "fa-solid fa-check text-emerald-600" : "fa-regular fa-copy"} text-xs`} />
            </button>
          </div>

          <div className="relative bg-white rounded-3xl p-5 border-2 border-indigo-100 shadow-md text-center overflow-hidden">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#f8faff] rounded-full border border-slate-200" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#f8faff] rounded-full border border-slate-200" />

            <div className="mb-3">
              <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                {ticket.ticketTypeName} • Gate Pass
              </span>
              <h3 className="text-xl font-black text-slate-900 font-brand mt-2 uppercase tracking-tight">
                EVENT TICKET
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Entry via {ticket.assignedGate}
              </p>
            </div>

            <div className="relative inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200 shadow-inner my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`}
                alt="Large QR Ticket"
                className="w-60 h-60 object-contain rounded-lg"
              />
            </div>

            <div className="mt-4 bg-slate-100 rounded-xl py-2 px-4 border border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                Serial / Security Number
              </span>
              <p className="text-lg font-mono font-black tracking-widest text-indigo-950 select-all">
                {ticket.ticketNumber}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-bold">
              <i className="fa-solid fa-circle-check" />
              <span>Valid for single entry</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs mb-1">
              <i className="fa-solid fa-id-card" />
              <span>Ticket Information</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Category</span>
                <span className="font-extrabold text-slate-900">{ticket.ticketTypeName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Gate</span>
                <span className="font-extrabold text-emerald-700">{ticket.assignedGate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Date</span>
                <span className="font-extrabold text-slate-900">{ticket.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Time</span>
                <span className="font-extrabold text-slate-900">{ticket.time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Seats</span>
                <span className="font-extrabold text-slate-900">{ticket.seats || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Quantity</span>
                <span className="font-extrabold text-slate-900">{ticket.quantity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Amount Paid</span>
                <span className="font-extrabold text-emerald-600">₹{ticket.amount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment</span>
                <span className="font-extrabold text-slate-900">{ticket.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Status</span>
                <span className={`font-extrabold ${ticket.status === "Confirmed" ? "text-emerald-600" : "text-slate-900"}`}>{ticket.status}</span>
              </div>
            </div>
          </div>

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

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ticket Status Guide</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { id: "ACTIVE", label: "ACTIVE", labelClass: "text-emerald-600", desc: "Ready for Entry", boxBorder: "border-emerald-400", badge: null },
                { id: "USED", label: "USED", labelClass: "text-emerald-700", desc: "Entry Completed", boxBorder: "border-slate-300", badge: "border-emerald-600 text-emerald-700" },
                { id: "EXPIRED", label: "EXPIRED", labelClass: "text-amber-600", desc: "Event Ended", boxBorder: "border-amber-300", badge: "border-amber-600 text-amber-600" },
                { id: "CANCELLED", label: "CANCELLED", labelClass: "text-red-600", desc: "Cancelled", boxBorder: "border-red-300", badge: "border-red-600 text-red-600 text-[7px] px-0.5" },
              ].map((s) => (
                <div key={s.id} className="flex flex-col items-center">
                  <div className={`relative w-12 h-12 p-1 bg-white border ${s.boxBorder} rounded-lg flex items-center justify-center mb-1 ${s.badge ? "opacity-70" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${s.id}`} alt={s.label} className={`w-full h-full object-contain ${s.badge ? "grayscale" : ""}`} />
                    {s.badge && (
                      <span className={`absolute inset-0 m-auto w-fit h-fit border-2 bg-white/95 ${s.badge} font-black px-1 rounded -rotate-12 uppercase`}>
                        {s.label}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-black uppercase ${s.labelClass}`}>{s.label}</span>
                  <span className="text-[9px] text-slate-500 font-medium leading-tight">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
