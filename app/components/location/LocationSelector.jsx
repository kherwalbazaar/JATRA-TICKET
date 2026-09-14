"use client";

import { useState } from "react";

const districts = [
  {
    name: "Mayurbhanj",
    icon: "fa-solid fa-map-location-dot",
    areas: [
      "Bahanada, Khunta, Mayurbhanj",
      "Khunta, Mayurbhanj",
      "Bahanada, Mayurbhanj",
      "Baripada, Mayurbhanj",
      "Rairangpur, Mayurbhanj",
      "Karanjia, Mayurbhanj",
      "Udala, Mayurbhanj",
      "Badsahi, Mayurbhanj",
      "Bangriposi, Mayurbhanj",
      "Jashipur, Mayurbhanj",
      "Suliapada, Mayurbhanj",
      "Betnoti, Mayurbhanj",
      "Morada, Mayurbhanj",
      "Sharata, Mayurbhanj",
      "Mathani, Mayurbhanj",
    ],
  },
  {
    name: "Balasore",
    icon: "fa-solid fa-water",
    areas: [
      "Balasore, Balasore",
      "Baleshwar, Balasore",
      "Soro, Balasore",
      "Nilgiri, Balasore",
      "Basta, Balasore",
      "Jaleswar, Balasore",
      "Bhograi, Balasore",
      "Remuna, Balasore",
    ],
  },
  {
    name: "Keonjhar",
    icon: "fa-solid fa-mountain",
    areas: [
      "Keonjhar, Keonjhar",
      "Anandapur, Keonjhar",
      "Ghatgaon, Keonjhar",
      "Patna, Keonjhar",
      "Champua, Keonjhar",
      "Joda, Keonjhar",
      "Barbil, Keonjhar",
    ],
  },
  {
    name: "Sundargarh",
    icon: "fa-solid fa-tree",
    areas: [
      "Rourkela, Sundargarh",
      "Sundargarh, Sundargarh",
      "Bonai, Sundargarh",
      "Hatibandha, Sundargarh",
    ],
  },
  {
    name: "Cuttack & Bhubaneswar",
    icon: "fa-solid fa-city",
    areas: [
      "Bhubaneswar, Khordha",
      "Cuttack, Cuttack",
      "Puri, Puri",
      "Nimaparha, Puri",
    ],
  },
];

/**
 * LocationSelector — manual location picker with district/area list.
 * Used when GPS fails or user wants to pick manually.
 */
export default function LocationSelector({ currentLocation, onSelect, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDistrict, setExpandedDistrict] = useState(null);

  const filteredDistricts = searchQuery
    ? districts.map((d) => ({
        ...d,
        areas: d.areas.filter((a) =>
          a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((d) => d.areas.length > 0)
    : districts;

  return (
    <div className="bg-[#1a2347] rounded-2xl border border-white/10 overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search your area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder:text-slate-500 outline-none flex-1"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white">
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* District list */}
      <div className="max-h-[40vh] overflow-y-auto no-scrollbar">
        {filteredDistricts.map((district, di) => (
          <div key={di} className="border-b border-white/5 last:border-b-0">
            <button
              onClick={() => setExpandedDistrict(expandedDistrict === di ? null : di)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors"
            >
              <i className={`${district.icon} text-amber-400 text-xs w-5 text-center`} />
              <span className="text-xs font-bold text-white flex-1 text-left">{district.name}</span>
              <span className="text-[10px] text-slate-500 font-medium mr-1">{district.areas.length}</span>
              <i className={`fa-solid fa-chevron-right text-[8px] text-slate-500 transition-transform duration-200 ${expandedDistrict === di ? "rotate-90" : ""}`} />
            </button>

            {expandedDistrict === di && (
              <div className="pb-1">
                {district.areas.map((area, ai) => (
                  <button
                    key={ai}
                    onClick={() => onSelect(area)}
                    className={`w-full flex items-center gap-3 pl-10 pr-3 py-2 rounded-xl transition-colors text-left ${
                      currentLocation === area ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <i className="fa-solid fa-location-dot text-slate-500 text-[10px] w-5 text-center" />
                    <span className="text-xs font-semibold text-white flex-1 truncate">{area}</span>
                    {currentLocation === area && (
                      <i className="fa-solid fa-check text-amber-400 text-[10px]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {searchQuery && filteredDistricts.length === 0 && (
          <div className="px-3 py-6 text-center">
            <i className="fa-solid fa-magnifying-glass text-slate-600 text-lg mb-2" />
            <p className="text-xs text-slate-400">No locations found for &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>

      {/* Close */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={onClose}
          className="w-full text-center text-[10px] font-bold text-slate-400 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
