"use client";

import { useState } from "react";
import { storeAllSeats } from "../../../lib/seats";

export default function SeedSeatsPage() {
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSeed = async () => {
    if (!eventId.trim()) {
      setResult({ error: "Please enter an event ID" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const seatCount = await storeAllSeats(eventId.trim());
      setResult({ success: true, seatCount });
    } catch (error) {
      console.error("Error seeding seats:", error);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-black text-slate-900 mb-4">Seed Seats to Firestore</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Event ID
            </label>
            <input
              type="text"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="Enter event ID (e.g., EVT-2026-001)"
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-600"
              disabled={loading}
            />
          </div>

          <button
            onClick={handleSeed}
            disabled={loading || !eventId.trim()}
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Seeding..." : "Seed All Seats"}
          </button>

          {result && (
            <div className={`p-4 rounded-xl ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {result.success ? (
                <p className="text-green-800 font-bold">
                  Successfully seeded {result.seatCount} seats for event {eventId}
                </p>
              ) : (
                <p className="text-red-800 font-bold">
                  Error: {result.error}
                </p>
              )}
            </div>
          )}

          <div className="text-xs text-slate-500">
            <p className="font-bold mb-1">This will create seats for:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Block A (8 rows, 10-17 seats per row)</li>
              <li>Block A2 (6 rows, 8-13 seats per row)</li>
              <li>Block A3 (5 rows, 6-10 seats per row)</li>
              <li>Block B (8 rows, 15-22 seats per row)</li>
              <li>Block B2 (6 rows, 12-17 seats per row)</li>
              <li>Block B3 (6 rows, 10-15 seats per row)</li>
              <li>Block C (8 rows, 12-19 seats per row)</li>
              <li>Block C2 (6 rows, 8-13 seats per row)</li>
              <li>Block C3 (5 rows, 6-10 seats per row)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
