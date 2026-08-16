"use client";

import React from "react";

export default function ChairSvg({ isBooked = false, isSelected = false, onClick, label, sizeClass = "w-10 h-12" }) {
  const stroke = isBooked ? "#9CA3AF" : isSelected ? "#B45309" : "#065F46";
  return (
    <svg
      viewBox="0 0 100 120"
      className={`${sizeClass} transition-all duration-200 select-none ${
        isBooked ? "cursor-not-allowed opacity-80" : isSelected ? "cursor-pointer hover:scale-105" : "cursor-pointer hover:scale-105 active:scale-95"
      }`}
      onClick={!isBooked ? onClick : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Chair Legs */}
      <path
        d="M26 68 V110 H34 V76 H66 V110 H74 V68"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Armrest - Left */}
      <path
        d="M20 54 V42 L13 46 V60 H20"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={isBooked ? "#D1D5DB" : isSelected ? "#FBBF24" : "#4ADE80"}
      />

      {/* Armrest - Right */}
      <path
        d="M80 54 V42 L87 46 V60 H80"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={isBooked ? "#D1D5DB" : isSelected ? "#FBBF24" : "#4ADE80"}
      />

      {/* Backrest */}
      <path
        d="M20 54 V25 C20 16 26 12 50 12 C74 12 80 16 80 25 V54 Z"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={isBooked ? "#D1D5DB" : isSelected ? "#FBBF24" : "#4ADE80"}
      />

      {/* Cushion Base */}
      <path
        d="M10 54 C10 50 14 48 20 48 H80 C86 48 90 50 90 54 V64 C90 68 86 70 80 70 H20 C14 70 10 68 10 64 Z"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={isBooked ? "#9CA3AF" : isSelected ? "#F59E0B" : "#22C55E"}
      />

      {/* Seat Number */}
      {label ? (
        <text
          x="50"
          y="37"
          textAnchor="middle"
          fontSize="20"
          fontWeight="900"
          fill={isBooked ? "#6B7280" : isSelected ? "#7C2D12" : "#065F46"}
          style={{ fontFamily: "'Poppins', 'Segoe UI', sans-serif" }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}
