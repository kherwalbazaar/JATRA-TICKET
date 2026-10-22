"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";

const SUPPORT_PHONE = "+91 9583252256";
const SUPPORT_TEL = "+919583252256";
const SUPPORT_WHATSAPP_URL =
  "https://wa.me/919583252256?text=Hi%20Jatra%20Bazaar%2C%20I%20need%20help%20with%20booking%20tickets";

const helpTopics = [
  {
    id: "topic-a",
    letter: "Topic A",
    title: "How to Book a Ticket?",
    icon: "fa-ticket",
    color: "text-rose-600 bg-rose-50 border-rose-200",
    desc: "Complete walkthrough to choose shows, select seats & confirm booking",
    steps: [
      "Browse the current or upcoming live shows from the Events page.",
      "Open the show details and view the interactive stage and auditorium seating map.",
      "If you are not logged in, complete the quick mobile OTP verification.",
      "Select your preferred available seats in your chosen block (e.g. Block B1).",
      "Review the ticket quantity, seat numbers, ticket pricing, and subtotal.",
      "Proceed to checkout and complete your payment securely via UPI, PhonePe, or Card.",
      "Your confirmed digital QR ticket will be generated instantly in 'My Tickets'."
    ],
    tip: "Seats are held temporarily during checkout. Complete payment before the timer expires to secure your seats.",
    action: {
      label: "Browse Events & Book",
      href: "/events",
      icon: "fa-arrow-right"
    }
  },
  {
    id: "topic-b",
    letter: "Topic B",
    title: "How to Make Payment?",
    icon: "fa-credit-card",
    color: "text-sky-600 bg-sky-50 border-sky-200",
    desc: "Payment methods, UPI, PhonePe, online cards & payment verification",
    steps: [
      "Select your show and choose your desired available seats.",
      "Review the displayed payment breakdown including ticket price and taxes.",
      "Choose PhonePe, UPI QR code, or Card as your preferred payment method.",
      "Authorize the transaction in your UPI app (PhonePe, Google Pay, BHIM) or card gateway.",
      "Wait for instant verification on the payment screen — do not hit refresh or back.",
      "Once payment is confirmed by the gateway, your ticket is immediately issued."
    ],
    tip: "Never share your UPI PIN or bank OTP with anyone. JATRA BAZAAR never asks for sensitive banking credentials.",
    action: {
      label: "View Available Shows",
      href: "/events",
      icon: "fa-ticket"
    }
  },
  {
    id: "topic-c",
    letter: "Topic C",
    title: "Where Can I Find My Ticket?",
    icon: "fa-qrcode",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    desc: "Locating your digital QR ticket, seat numbers & entry gate pass",
    steps: [
      "Log in with your registered 10-digit mobile number.",
      "Tap the 'Tickets' tab in the bottom navigation bar or visit the Tickets page.",
      "Select your event booking from the list to view its complete details.",
      "View your digital QR ticket pass with seat numbers, block name, and gate details.",
      "Present this QR pass directly at the auditorium entry gate scanner for admission."
    ],
    tip: "You can take a screenshot of your confirmed ticket QR code for offline presentation at the entry gate.",
    action: {
      label: "Open My Tickets",
      href: "/tickets",
      icon: "fa-arrow-right"
    }
  },
  {
    id: "topic-d",
    letter: "Topic D",
    title: "How to Cancel a Ticket?",
    icon: "fa-rotate-left",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    desc: "Cancellation rules, eligibility windows & refund processing",
    steps: [
      "Open 'My Tickets' from the bottom navigation bar.",
      "Select the specific show booking you wish to review.",
      "Check whether the booking is eligible for cancellation according to the show's cutoff time.",
      "If permitted, follow the on-screen cancellation confirmation steps.",
      "Eligible refunds are processed back to the original payment method within 3–5 working days."
    ],
    tip: "Tickets cannot be cancelled once scanned at the entry gate or after the show cancellation deadline.",
    action: {
      label: "Check My Tickets",
      href: "/tickets",
      icon: "fa-arrow-right"
    }
  },
  {
    id: "topic-e",
    letter: "Topic E",
    title: "Check Booking Status",
    icon: "fa-clipboard-check",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    desc: "Verify whether your ticket booking is confirmed or pending",
    steps: [
      "Log in to your account with your registered mobile number.",
      "Open your booking history in 'My Tickets'.",
      "Confirmed tickets show an active green 'CONFIRMED' badge and an active entry QR code.",
      "If your bank payment was deducted but shows pending, the status updates automatically once the gateway verifies."
    ],
    tip: "In rare cases of bank network delays, confirmation may take up to 10 minutes to reflect.",
    action: {
      label: "View Booking History",
      href: "/tickets",
      icon: "fa-arrow-right"
    }
  },
  {
    id: "topic-f",
    letter: "Topic F",
    title: "Login or Profile Help",
    icon: "fa-user-check",
    color: "text-purple-600 bg-purple-50 border-purple-200",
    desc: "1-Click Google sign-in, profile update & keeping your account secure",
    steps: [
      "Click 'Continue with Google' to sign in securely with your Google Account.",
      "Your verified name, email address, and profile photo are connected instantly.",
      "Add your 10-digit mobile number to receive ticket confirmations and entry QR passes.",
      "Having an updated profile ensures faster 1-tap bookings without re-entering details."
    ],
    tip: "Sign in with the same Google account so all your booked tickets and event history stay unified in one place.",
    action: {
      label: "Go to Profile",
      href: "/profile",
      icon: "fa-user"
    }
  },
  {
    id: "topic-g",
    letter: "Topic G",
    title: "Other Help & Direct Support",
    icon: "fa-headset",
    color: "text-teal-600 bg-teal-50 border-teal-200",
    desc: "Contact our dedicated customer support team directly",
    steps: [
      "Need immediate assistance with seat reservations, show schedules, or venue directions?",
      "Our JATRA BAZAAR customer care team is available to assist you directly.",
      `Call us directly at ${SUPPORT_PHONE} or message us on WhatsApp.`
    ],
    tip: "Have your booking ID or registered mobile phone number ready when calling for expedited assistance.",
    action: {
      label: `Call ${SUPPORT_PHONE}`,
      href: `tel:${SUPPORT_TEL}`,
      icon: "fa-phone",
      secondaryAction: {
        label: "WhatsApp Us",
        href: SUPPORT_WHATSAPP_URL,
        icon: "fa-brands fa-whatsapp"
      }
    }
  }
];

const faqs = [
  {
    q: "How do I book tickets online?",
    a: "Open the app, select your show and available seats on the stage map, fill your holder details, choose UPI/PhonePe or Card, and proceed. You will receive an instant digital QR ticket."
  },
  {
    q: "Can I cancel my ticket and get a refund?",
    a: "Yes, eligible tickets can be cancelled before the event cancellation cutoff. Refunds are credited back to the original payment source within 3–5 working days."
  },
  {
    q: "What should I show at the entry gate?",
    a: "Open your ticket pass from My Tickets and show the digital QR code at the entry gate. The QR is scanned by gate staff for single entry admission."
  },
  {
    q: "Which payment methods are accepted?",
    a: "We accept PhonePe, Google Pay, BHIM, all UPI apps, online credit/debit cards, net banking, and cash at official ticket counters."
  }
];

export default function SupportPage() {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);

  const activeTopicData = helpTopics.find((t) => t.id === selectedTopic);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        {/* Top App Header */}
        <Header />

        <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
          {/* Page Title */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-brand">Support Center</h2>
            <p className="text-xs text-slate-500 font-medium">We are here to help you 24x7</p>
          </div>

          {/* Hero Contact Card with updated 9583252256 */}
          <div className="bg-gradient-to-br from-[#12193b] via-[#1e2756] to-[#12193b] text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-300 text-slate-950 flex items-center justify-center text-xl shadow-lg">
                <i className="fa-solid fa-headset" />
              </div>
              <div>
                <h3 className="text-base font-black font-brand">Need Help?</h3>
                <p className="text-[11px] text-slate-300 font-medium">Our team responds within 15 minutes</p>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Direct Call Support */}
              <a
                href={`tel:${SUPPORT_TEL}`}
                className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 hover:bg-white/20 transition-all active:scale-98"
                title={`Call ${SUPPORT_PHONE}`}
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <i className="fa-solid fa-phone text-sm" />
                </div>
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">Call Support</p>
                  <p className="font-black text-white">{SUPPORT_PHONE}</p>
                </div>
              </a>

              {/* Direct WhatsApp Support */}
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 hover:bg-white/20 transition-all active:scale-98"
                title={`WhatsApp ${SUPPORT_PHONE}`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <i className="fa-brands fa-whatsapp text-base" />
                </div>
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">WhatsApp</p>
                  <p className="font-black text-white">{SUPPORT_PHONE}</p>
                </div>
              </a>

              {/* Email Support */}
              <a
                href="mailto:support@jatrabazaar.com"
                className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 hover:bg-white/20 transition-all active:scale-98"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <i className="fa-solid fa-envelope text-sm" />
                </div>
                <div className="text-xs truncate">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">Email</p>
                  <p className="font-black text-white truncate">support@jatrabazaar.com</p>
                </div>
              </a>

              {/* Office Address */}
              <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <i className="fa-solid fa-location-dot text-sm" />
                </div>
                <div className="text-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-300 tracking-wider">Office</p>
                  <p className="font-black text-white text-[11px]">Bahanada, Khunta, Mayurbhanj, Odisha</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Button-Based Help Guide Section */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-book-open" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 font-brand">
                    Instant Guided Help
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Select any topic for instant automated steps & answers
                  </p>
                </div>
              </div>

              {selectedTopic && (
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left text-[9px]" />
                  <span>All Topics</span>
                </button>
              )}
            </div>

            {/* View A: Selected Topic Detailed Answer */}
            {activeTopicData ? (
              <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                {/* Topic Header Badge */}
                <div className="flex items-start justify-between gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-base ${activeTopicData.color}`}>
                      <i className={`fa-solid ${activeTopicData.icon}`} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md inline-block mb-0.5">
                        {activeTopicData.letter}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 font-brand">
                        {activeTopicData.title}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Step-by-Step Instructions
                  </p>
                  <ol className="space-y-2">
                    {activeTopicData.steps.map((step, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-slate-700 bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs font-medium leading-relaxed"
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Pro-Tip Box */}
                {activeTopicData.tip && (
                  <div className="flex items-start gap-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-900 font-medium">
                    <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5 text-xs flex-shrink-0" />
                    <span>{activeTopicData.tip}</span>
                  </div>
                )}

                {/* Guided Navigation Action Buttons */}
                <div className="pt-1 flex flex-wrap gap-2">
                  {activeTopicData.action?.href.startsWith("/") ? (
                    <Link
                      href={activeTopicData.action.href}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-transform active:scale-95"
                    >
                      <span>{activeTopicData.action.label}</span>
                      <i className={`fa-solid ${activeTopicData.action.icon || "fa-arrow-right"} text-[10px]`} />
                    </Link>
                  ) : (
                    <a
                      href={activeTopicData.action?.href}
                      className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-transform active:scale-95"
                    >
                      <span>{activeTopicData.action?.label}</span>
                      <i className={`fa-solid ${activeTopicData.action?.icon || "fa-phone"} text-[10px]`} />
                    </a>
                  )}

                  {activeTopicData.action?.secondaryAction && (
                    <a
                      href={activeTopicData.action.secondaryAction.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-transform active:scale-95"
                    >
                      <span>{activeTopicData.action.secondaryAction.label}</span>
                      <i className="fa-brands fa-whatsapp text-sm" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>← Back to Topics</span>
                  </button>
                </div>
              </div>
            ) : (
              /* View B: Predefined Topics List (Buttons) */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {helpTopics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopic(topic.id)}
                    className="bg-white rounded-2xl p-3 border border-slate-200 hover:border-indigo-400 hover:shadow-md text-left transition-all group flex flex-col justify-between cursor-pointer active:scale-98"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm ${topic.color} group-hover:scale-105 transition-transform`}>
                          <i className={`fa-solid ${topic.icon}`} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {topic.letter}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {topic.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium leading-snug mt-1 line-clamp-2">
                        {topic.desc}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-indigo-600">
                      <span>View Answer</span>
                      <i className="fa-solid fa-angle-right text-[9px] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Frequently Asked Questions Accordion */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-900 font-brand flex items-center gap-1.5">
              <i className="fa-solid fa-circle-question text-rose-500" /> Frequently Asked Questions
            </h3>
            <div className="space-y-2">
              {faqs.map((f, i) => (
                <div key={i} className="bg-slate-50/70 rounded-xl border border-slate-200/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left cursor-pointer"
                  >
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      {f.q}
                    </span>
                    <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-3.5 pb-3 pl-10 text-[11px] text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-2">
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
              href="/events"
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