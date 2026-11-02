"use client";

import React from "react";

export default function ChairSvg({
  isBooked = false,
  isLocked = false,
  isReserved = false,
  isSelected = false,
  onClick,
  label,
  sizeClass = "w-4 h-5",
  disabled = false,
}) {
  const isUnavailable = isBooked || isLocked || isReserved;

  // Real-Time UI Colour Specifications:
  // Available = Green | Reserved = Orange | Booked = Red | Selected by current customer = Deep Pink
  const stroke = disabled
    ? "#CBD5E1"
    : isSelected
    ? "#9D174D"
    : isBooked
    ? "#B91C1C"
    : (isReserved || isLocked)
    ? "#C2410C"
    : "#15803D";

  const fill = disabled
    ? "#E2E8F0"
    : isSelected
    ? "#FF1493"
    : isBooked
    ? "#EF4444"
    : (isReserved || isLocked)
    ? "#F97316"
    : "#22C55E";

  const cushionFill = disabled
    ? "#CBD5E1"
    : isSelected
    ? "#DB2777"
    : isBooked
    ? "#DC2626"
    : (isReserved || isLocked)
    ? "#EA580C"
    : "#16A34A";

  const textColor = disabled
    ? "#94A3B8"
    : "#FFFFFF";

  return (
    <svg
      viewBox="7 10 86 103"
      className={`${sizeClass} transition-all duration-200 select-none ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : isBooked
          ? "cursor-not-allowed opacity-85"
          : (isReserved || isLocked)
          ? "cursor-not-allowed opacity-90"
          : isSelected
          ? "cursor-pointer active:scale-95"
          : "cursor-pointer active:scale-95"
      }`}
      onClick={!disabled && !isUnavailable ? onClick : undefined}
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
        fill={fill}
      />

      {/* Armrest - Right */}
      <path
        d="M80 54 V42 L87 46 V60 H80"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={fill}
      />

      {/* Backrest */}
      <path
        d="M20 54 V25 C20 16 26 12 50 12 C74 12 80 16 80 25 V54 Z"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={fill}
      />

      {/* Cushion Base */}
      <path
        d="M10 54 C10 50 14 48 20 48 H80 C86 48 90 50 90 54 V64 C90 68 86 70 80 70 H20 C14 70 10 68 10 64 Z"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={cushionFill}
      />

      {/* Seat Number */}
      {label ? (
        <text
          x="50"
          y="37"
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill={textColor}
          style={{ fontFamily: "'Poppins', 'Segoe UI', sans-serif" }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}
