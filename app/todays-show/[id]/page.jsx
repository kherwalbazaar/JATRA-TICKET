"use client";

import { useState, use } from "react";
import Link from "next/link";

const showsData = {
  "1": {
    name: "ADIM OWAR JARPA OPERA",
    partyName: "Adim Opera Group",
    banner: "/jarpa.png",
    date: "14 Sept 2026",
    time: "10:00 PM - 05:00 AM",
    location: "Bahanada, Khunta, Mayurbhanj",
    committee: "Adim Owat Jarpa Opera Committee",
    about: "Adim Owat Jarpa Opera is a legendary Santali jatra party known for its powerful performances and traditional music. This grand production brings together the finest artists to showcase the rich cultural heritage of the Santali community.",
    language: "Santali",
    duration: "10:00 PM - 05:00 AM",
    trailer: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    credits: {
      writer: "Kashray Soren",
      director: "Dasarath Singh",
      music: "Mr. Sawan",
      singers: ["Devi", "Sunder", "Malla"],
      danceMaster: "Rajesh Murmu",
    },
    cast: [
      { name: "Pela Dada", photo: "/jarpa.png" },
      { name: "Soni Devi", photo: "/ramraj.png" },
      { name: "Raju Kumar", photo: "/jarpa.png" },
      { name: "Lata Murmu", photo: "/ramraj.png" },
    ],
    gallery: ["/jarpa.png", "/ramraj.png", "/pela-dada.png"],
  },
  "2": {
    name: "RAMRAJ GAYAN MOHAL",
    partyName: "Ramraj Opera",
    banner: "/ramraj.png",
    date: "23 Oct 2026",
    time: "10:00 PM - 05:00 AM",
    location: "Bahanada, Khunta, Mayurbhanj",
    committee: "Ramraj Opera Committee",
    about: "Ramraj Gayan Mohal is a spectacular jatra show featuring traditional Santali and Santali performances with modern storytelling.",
    language: "Santali",
    duration: "10:00 PM - 05:00 AM",
    trailer: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    credits: {
      writer: "Birsa Munda",
      director: "Ramesh Hansda",
      music: "Suresh Oraon",
      singers: ["Anita", "Rakesh"],
      danceMaster: "Mangal Singh",
    },
    cast: [
      { name: "Ramraj", photo: "/ramraj.png" },
      { name: "Sita Devi", photo: "/jarpa.png" },
      { name: "Lakhan", photo: "/ramraj.png" },
    ],
    gallery: ["/ramraj.png", "/jarpa.png"],
  },
  "3": {
    name: "PELA DADA - Ele Ele Ginj Bujhaw",
    partyName: "Adim Owat Jarpa Opera",
    banner: "/pela-dada.png",
    date: "15 Aug 2026",
    time: "10:00 PM - 05:00 AM",
    location: "Suliapada, Mayurbhanj",
    committee: "Adim Owat Jarpa Opera Committee",
    about: "Pela Dada is a grand Santali jatra opera featuring powerful performances, traditional music, and captivating dance. This big budget production brings together the finest artists of Odisha to showcase the rich cultural heritage of the Santali community. Written by Kashray Soren and directed by Dasarath Singh, this show promises an unforgettable night of entertainment.",
    language: "Santali",
    duration: "10:00 PM - 05:00 AM",
    trailer: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    credits: {
      writer: "Kashray Soren",
      director: "Dasarath Singh",
      music: "Mr. Sawan",
      singers: ["Devi", "Sunder", "Malla"],
      danceMaster: "Rajesh Murmu",
    },
    cast: [
      { name: "Pela Dada", photo: "/pela-dada.png" },
      { name: "Soni Devi", photo: "/jarpa.png" },
      { name: "Raju Kumar", photo: "/ramraj.png" },
      { name: "Lata Murmu", photo: "/pela-dada.png" },
      { name: "Bikash Soren", photo: "/jarpa.png" },
      { name: "Gita Tudu", photo: "/ramraj.png" },
    ],
    gallery: ["/pela-dada.png", "/jarpa.png", "/ramraj.png"],
  },
};

export default function ShowDetailPage({ params }) {
  const { id } = use(params);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const showData = showsData[id] || showsData["1"];

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-6 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#12193b] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <Link href="/todays-show" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-xs" />
          </Link>
          <h2 className="text-lg font-black font-brand truncate">Show Details</h2>
        </div>

        {/* Banner */}
        <div className="w-full h-[220px] overflow-hidden bg-slate-900">
          <img src={showData.banner} alt={showData.name} className="w-full h-full object-cover" />
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Title & Basic Info */}
          <div>
            <h1 className="text-lg font-black text-slate-900 font-brand">{showData.name}</h1>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">{showData.partyName}</p>
          </div>

          {/* Date, Time, Location, Committee */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <i className="fa-regular fa-calendar text-rose-500 w-4" />
              <span>{showData.date}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <i className="fa-regular fa-clock text-indigo-500 w-4" />
              <span>{showData.time}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <i className="fa-solid fa-location-dot text-rose-500 w-4" />
              <span>{showData.location}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <i className="fa-solid fa-users text-indigo-500 w-4" />
              <span>{showData.committee}</span>
            </div>
          </div>

          {/* About */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">About Jatra</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">{showData.about}</p>
          </div>

          {/* Show Guide */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Show Guide</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-xl p-2 text-center">
                <i className="fa-solid fa-language text-indigo-500 text-lg" />
                <p className="text-[10px] font-bold text-slate-900 mt-1">Language</p>
                <p className="text-[10px] text-slate-600">{showData.language}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 text-center">
                <i className="fa-solid fa-clock text-rose-500 text-lg" />
                <p className="text-[10px] font-bold text-slate-900 mt-1">Duration</p>
                <p className="text-[10px] text-slate-600">{showData.duration}</p>
              </div>
            </div>
          </div>

          {/* Trailer */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Trailer</h3>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900">
              <iframe
                src={showData.trailer}
                title="Trailer"
                className="absolute inset-0 w-full h-full"
                allowFullScreen
              />
            </div>
          </div>

          {/* Creative Credits */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Creative Credits</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">Writer</span>
                <span className="text-slate-900 font-bold">{showData.credits.writer}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">Director</span>
                <span className="text-slate-900 font-bold">{showData.credits.director}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">Music</span>
                <span className="text-slate-900 font-bold">{showData.credits.music}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">Singers</span>
                <span className="text-slate-900 font-bold">{showData.credits.singers.join(", ")}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">Dance Master</span>
                <span className="text-slate-900 font-bold">{showData.credits.danceMaster}</span>
              </div>
            </div>
          </div>

          {/* Cast & Crew */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Cast & Crew</h3>
            <div className="grid grid-cols-4 gap-3">
              {showData.cast.map((member, i) => (
                <div key={i} className="flex flex-col items-center">
                  <img src={member.photo} alt={member.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-100" />
                  <p className="text-[9px] font-bold text-slate-900 mt-1 text-center truncate w-full">{member.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Gallery</h3>
            <div className="grid grid-cols-2 gap-2">
              {showData.gallery.map((img, i) => (
                <img key={i} src={img} alt={`Gallery ${i + 1}`} className="w-full h-28 rounded-xl object-cover" />
              ))}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 font-brand mb-2">Terms & Conditions</h3>
            <div className={`text-[10px] text-slate-600 leading-relaxed space-y-2 ${!showAllTerms ? "max-h-20 overflow-hidden relative" : ""}`}>
              <p><strong>1. Acceptance of Terms</strong> - By accessing or using the Ama Jatra platform, you agree to be bound by these Terms and Conditions.</p>
              <p><strong>2. Eligibility</strong> - You must be at least 18 years of age to create an account and purchase tickets.</p>
              <p><strong>3. Ticket Purchases</strong> - All ticket purchases are subject to availability. Prices are in INR and inclusive of GST.</p>
              <p><strong>4. Booking Confirmation</strong> - A booking is confirmed only after successful payment. Your e-ticket with QR code will be available in My Tickets.</p>
              <p><strong>5. Refund & Cancellation</strong> - Tickets are non-refundable except in cases of show cancellation by the organiser.</p>
              <p><strong>6. Ticket Transfers</strong> - Tickets are non-transferable and linked to the purchasing account.</p>
              <p><strong>7. Entry Conditions</strong> - Ticket holders must present QR code at the venue for scanning.</p>
              <p><strong>8. Promo Codes</strong> - Only one promo code per transaction. Valid for limited time.</p>
              <p><strong>9. Intellectual Property</strong> - All content is property of Ama Jatra and protected by copyright laws.</p>
              <p><strong>10. Limitation of Liability</strong> - Ama Jatra shall not be liable for indirect damages.</p>
              <p><strong>11. Governing Law</strong> - Governed by laws of India. Jurisdiction in Bhubaneswar, Odisha.</p>
              <p><strong>12. Changes to Terms</strong> - We reserve the right to modify these Terms at any time.</p>
              {!showAllTerms && (
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
            <button onClick={() => setShowAllTerms(!showAllTerms)} className="text-[10px] font-bold text-indigo-600 mt-2">
              {showAllTerms ? "Show Less" : "Read More"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
