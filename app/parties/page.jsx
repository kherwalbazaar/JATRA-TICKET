"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import { subscribeParties, DEFAULT_PARTIES, isCommitteeName } from "../../lib/parties";
import { subscribeEvents } from "../../lib/events";

export default function PartiesPage() {
  const [parties, setParties] = useState(DEFAULT_PARTIES);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const unsub = subscribeParties((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setParties(list.filter((p) => p && !isCommitteeName(p.name)));
        }
        setLoading(false);
      });
      return () => unsub();
    } catch {
      setLoading(false);
      return () => {};
    }
  }, []);

  useEffect(() => {
    try {
      const unsub = subscribeEvents((list) => {
        if (Array.isArray(list)) setEvents(list);
      });
      return () => unsub();
    } catch {
      return () => {};
    }
  }, []);

  const handlePartyClick = (party) => {
    if (!party) return;
    try {
      sessionStorage.setItem(`party_${party.id}`, JSON.stringify(party));
    } catch {}
    window.location.href = `/parties/${encodeURIComponent(party.id)}`;
  };

  const filteredParties = useMemo(() => {
    const validParties = parties.filter((p) => p && !isCommitteeName(p.name));
    if (!searchQuery.trim()) return validParties;
    const q = searchQuery.toLowerCase();
    return validParties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.genre && p.genre.toLowerCase().includes(q))
    );
  }, [parties, searchQuery]);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        <Header showBack={true} title="All Opera Parties" />

        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-brand">Opera Parties</h2>
              <p className="text-xs text-slate-500 font-medium">Explore all traditional jatra &amp; opera troupe parties</p>
            </div>
            <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 shadow-xs">
              {parties.length} Parties
            </span>
          </div>

          {/* Search Box */}
          <div className="mt-3 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search by party name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>

        {/* Parties Grid */}
        <div className="px-4 flex-1 mt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading opera parties...</p>
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="fa-solid fa-masks-theater text-4xl text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">No parties matching &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-4">
              {filteredParties.map((party) => (
                <div
                  key={party.id || party.name}
                  onClick={() => handlePartyClick(party)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handlePartyClick(party);
                    }
                  }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col p-3 hover:shadow-md hover:border-indigo-200 transition-all group cursor-pointer active:scale-[0.99]"
                >
                  {/* Party Logo / Image Container */}
                  <div className="w-full aspect-[5/3] rounded-lg overflow-hidden bg-slate-100 relative mb-2.5 border border-slate-200/60 shadow-xs flex items-center justify-center">
                    {party.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={party.logo}
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      aria-hidden="true"
                      className={`w-full h-full ${party.logo ? "hidden" : "flex"} items-center justify-center bg-gradient-to-tr ${party.color || "from-indigo-600 to-purple-600"} text-white font-black text-xl uppercase select-none`}
                    >
                      {party.name.slice(0, 2)}
                    </div>

                    {party.activeShows > 0 ? (
                      <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-xs">
                        {party.activeShows} Live
                      </span>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 bg-slate-800/80 backdrop-blur-xs text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full shadow-xs">
                        0 Shows
                      </span>
                    )}
                  </div>

                  {/* Party Info */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xs font-black text-slate-900 font-brand leading-tight line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                      {party.name}
                    </h3>

                    {party.location && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mb-2 truncate">
                        <i className="fa-solid fa-location-dot text-rose-500 text-[8px] flex-shrink-0" />
                        <span className="truncate">{party.location}</span>
                      </div>
                    )}

                    {/* View Shows / Browse Shows Action Button */}
                    <div className="mt-auto pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePartyClick(party);
                        }}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-[10px] py-1.5 rounded-xl shadow-xs active:scale-95 transition-transform flex items-center justify-center gap-1 hover:brightness-110 cursor-pointer"
                      >
                        <i className="fa-solid fa-ticket text-[9px]" />
                        <span>{party.activeShows > 0 ? "View Shows" : "Browse Shows"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <BottomNav active="events" />
      </div>
    </div>
  );
}
