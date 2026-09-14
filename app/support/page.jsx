"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";

const helpTopics = [
  { icon: "fa-ticket", title: "Booking Help", desc: "How to book, modify or cancel tickets", color: "text-rose-500 bg-rose-50 border-rose-100" },
  { icon: "fa-credit-card", title: "Payment Issues", desc: "UPI, online & cash payment problems", color: "text-sky-600 bg-sky-50 border-sky-100" },
  { icon: "fa-rotate-left", title: "Refund / Cancellation", desc: "Refund status & cancellation policy", color: "text-amber-600 bg-amber-50 border-amber-100" },
  { icon: "fa-qrcode", title: "Gate Entry", desc: "QR scanning & gate pass verification", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { icon: "fa-mobile-screen-button", title: "Technical Issue", desc: "App / website errors & login help", color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
  { icon: "fa-headset", title: "Other Queries", desc: "Anything else? We are here to help", color: "text-purple-600 bg-purple-50 border-purple-100" },
];

const faqs = [
  { q: "How do I book tickets online?", a: "Open the app, select your ticket type and quantity, fill the holder details, choose a payment method and proceed. You will get an instant digital QR ticket." },
  { q: "Can I cancel my ticket and get a refund?", a: "Yes. Tickets can be cancelled before the event date. Refunds are processed within 3–5 working days to the original payment method." },
  { q: "What should I show at the gate?", a: "Open the ticket from My Tickets and scan the QR code at the entry gate. The QR is valid for single entry only." },
  { q: "Which payment methods are accepted?", a: "We accept UPI / QR (Google Pay, PhonePe, Paytm), online card payments, and cash at the ticket counter." },
];

export default function SupportPage() {
  const [open, setOpen] = useState(0);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        {/* Top App Header */}
        <Header />

        <div className="flex-1 p-4 space-y-4">
          {/* Page Title */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-brand">Support Center</h2>
            <p className="text-xs text-slate-500 font-medium">We are here to help you 24x7</p>
          </div>

          {/* Hero Contact Card */}
          <div className="bg-gradient-to-br from-[#12193b] via-[#1e2756] to-[#12193b] text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl shadow-lg">
                <i className="fa-solid fa-headset" />
              </div>
              <div>
                <h3 className="text-base font-black font-brand">Need Help?</h3>
                <p className="text-[11px] text-slate-300 font-medium">Our team responds within 15 minutes</p>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-1 gap-2">
              <a href="tel:+919876543210" className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-phone text-amber-400" />
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">Call Support</p>
                  <p className="font-black text-white">+91 98765 43210</p>
                </div>
              </a>
              <a href="mailto:support@adimlahahmandawa.com" className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-envelope text-amber-400" />
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">Email</p>
                  <p className="font-black text-white">support@adimlahahmandawa.com</p>
                </div>
              </a>
              <a href="https://wa.me/919876543210" className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 hover:bg-white/20 transition-colors">
                <i className="fa-brands fa-whatsapp text-amber-400" />
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">WhatsApp</p>
                  <p className="font-black text-white">+91 98765 43210</p>
                </div>
              </a>
              <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5">
                <i className="fa-solid fa-location-dot text-amber-400" />
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">Office</p>
                  <p className="font-black text-white">Balanada, Khunta, Mayurbhanj, Odisha</p>
                </div>
              </div>
            </div>
          </div>

          {/* Help Topics */}
          <div>
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2.5 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-question text-rose-500" /> Help Topics
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {helpTopics.map((t) => (
                <button
                  key={t.title}
                  className="bg-white rounded-2xl p-3 border border-slate-100 shadow-xs text-left hover:border-rose-300 hover:-translate-y-0.5 transition-all"
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm ${t.color}`}>
                    <i className={`fa-solid ${t.icon}`} />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 mt-2">{t.title}</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-snug mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2.5 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-question text-rose-500" /> Frequently Asked Questions
            </h3>
            <div className="space-y-2">
              {faqs.map((f, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                  <button
                    onClick={() => setOpen(open === i ? -1 : i)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left"
                  >
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      {f.q}
                    </span>
                    <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${open === i ? "rotate-180" : ""}`} />
                  </button>
                  {open === i && (
                    <div className="px-3.5 pb-3 pl-10 text-[11px] text-slate-600 font-medium leading-relaxed">
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center text-sm">
                <i className="fa-solid fa-ticket" />
              </div>
              <div>
                <p className="text-xs font-black text-rose-950">Ready to book your ticket?</p>
                <p className="text-[10px] text-rose-800 font-medium">Get started in under a minute</p>
              </div>
            </div>
            <Link
              href="/book"
              className="flex-shrink-0 bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md active:scale-95 transition-transform"
            >
              Book Now
            </Link>
          </div>
        </div>

        {/* Fixed Bottom Navigation Bar */}
        <BottomNav active="support" />
      </div>
    </div>
  );
}