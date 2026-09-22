"use client";

import { useState } from "react";
import { collection, addDoc, getDocs, query, deleteDoc, doc } from "firebase/firestore";
import { firestore } from "../../../lib/firebase";

const DUMMY_EVENTS = [
  {
    name: "ADIM LAHAH MANDAWA",
    partyName: "Adim Lahah Mandawa",
    organizationName: "ADIM LAHAH MANDAWA",
    month: "OCT",
    day: "1",
    year: "2026",
    location: "Balanada Ground, Khunta, Mayurbhanj",
    banner: "/jarpa.png",
    time: "08:30 PM - 04:30 AM",
    entryTime: "07:45 PM",
    startTime: "08:30 PM",
    about: "Adim Lahah Mandawa is a grand Jatra performance featuring traditional folk art, music, and cultural storytelling. Experience the vibrant colors and rhythms of Odisha's rich theatrical heritage.",
    language: "Odia",
    duration: "8 Hours",
    audience: "All Age",
    committee: "Adim Lahah Mandawa Committee",
    address: "Bahanada, Khunta, Mayurbhanj, Odisha - 757035",
    phone: "+91 94370 12345",
    managingDirector: "Sri Prakash Chandra Sahu",
    trailer: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    credits: {
      writer: "Maheswar Soren",
      director: "Dasarath Singh",
      music: "Bhubaneswar Mishra",
      singers: ["Ardhendu Giri", "Malabika Sanyal"],
    },
    cast: [
      { name: "Rajesh Kumar", photo: "https://i.pravatar.cc/150?img=11" },
      { name: "Sunita Sahu", photo: "https://i.pravatar.cc/150?img=5" },
      { name: "Bikram Oraon", photo: "https://i.pravatar.cc/150?img=12" },
      { name: "Mamata Behera", photo: "https://i.pravatar.cc/150?img=9" },
      { name: "Suresh Nayak", photo: "https://i.pravatar.cc/150?img=13" },
      { name: "Purnima Munda", photo: "https://i.pravatar.cc/150?img=16" },
    ],
    banners: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&auto=format&fit=crop&q=80",
    ],
  },
  {
    name: "RAMRAJ GAYAN MOHAL",
    partyName: "Ramraj Opera",
    organizationName: "Ramraj Opera",
    month: "OCT",
    day: "23",
    year: "2026",
    location: "Bahanada, Khunta, Mayurbhanj",
    banner: "/ramraj.png",
    time: "10:00 PM - 05:00 AM",
    entryTime: "09:15 PM",
    startTime: "10:00 PM",
    about: "Ramraj Opera presents a spectacular Jatra show with talented artists, beautiful costumes, and mesmerizing performances that captivate the audience through the night.",
    language: "Odia",
    duration: "7 Hours",
    audience: "All Age",
    committee: "Ramraj Gayan Mohal",
    address: "Bahanada, Khunta, Mayurbhanj, Odisha - 757035",
    phone: "+91 94370 67890",
    managingDirector: "Sri Ramesh Chandra Naik",
    trailer: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    credits: {
      writer: "Maheswar Soren",
      director: "Dasarath Singh",
      music: "Bhubaneswar Mishra",
      singers: ["Ardhendu Giri", "Malabika Sanyal"],
    },
    cast: [
      { name: "Rajesh Kumar", photo: "https://i.pravatar.cc/150?img=11" },
      { name: "Sunita Sahu", photo: "https://i.pravatar.cc/150?img=5" },
      { name: "Bikram Oraon", photo: "https://i.pravatar.cc/150?img=12" },
      { name: "Mamata Behera", photo: "https://i.pravatar.cc/150?img=9" },
      { name: "Suresh Nayak", photo: "https://i.pravatar.cc/150?img=13" },
      { name: "Purnima Munda", photo: "https://i.pravatar.cc/150?img=16" },
    ],
    banners: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&auto=format&fit=crop&q=80",
    ],
  },
];

export default function SeedEventsPage() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const seedEvents = async () => {
    setLoading(true);
    setStatus("Seeding events...");
    try {
      for (const ev of DUMMY_EVENTS) {
        await addDoc(collection(firestore, "events"), ev);
      }
      setStatus("✅ Events seeded successfully!");
    } catch (err) {
      setStatus("❌ Error: " + err.message);
    }
    setLoading(false);
  };

  const clearEvents = async () => {
    setLoading(true);
    setStatus("Clearing events...");
    try {
      const snap = await getDocs(query(collection(firestore, "events")));
      for (const d of snap.docs) {
        await deleteDoc(doc(firestore, "events", d.id));
      }
      setStatus("✅ Events cleared!");
    } catch (err) {
      setStatus("❌ Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-md mx-auto bg-white rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-black text-slate-900">Seed Events to Firestore</h1>
        <p className="text-sm text-slate-500">Store dummy event data into Firestore database</p>

        <button
          onClick={seedEvents}
          disabled={loading}
          className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Working..." : "Seed Events"}
        </button>

        <button
          onClick={clearEvents}
          disabled={loading}
          className="w-full bg-red-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Working..." : "Clear All Events"}
        </button>

        {status && (
          <div className="bg-slate-100 rounded-xl p-3 text-sm text-slate-700 font-medium">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
