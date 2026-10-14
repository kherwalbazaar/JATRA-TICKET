"use client";

import React from "react";

/**
 * MovingSpotlights: Realistic theatrical stage spotlights animation for JATRA BAZAAR.
 * Renders multiple sweeping royal blue, ice blue, and soft white light beams
 * originating from an overhead lighting rig and sweeping across the auditorium stage floor.
 *
 * Fully responsive, lightweight (pure CSS transforms), respects prefers-reduced-motion,
 * with pointer-events: none to avoid interfering with booking or seat clicks.
 */
export default function MovingSpotlights({
  idPrefix = "stage",
  stageX = 370,
  stageY = 40,
  stageWidth = 260,
  stageHeight = 360,
  stageRx = 14,
}) {
  const clipId = `${idPrefix}-spotlight-stageClip`;

  // Overhead spotlight emitter positions across the stage
  const spotlights = [
    { id: 1, x: 405, y: 48, color: "deepBlue", initialRotate: -12, animClass: "spotlight-beam-1" },
    { id: 2, x: 445, y: 48, color: "cyan", initialRotate: 10, animClass: "spotlight-beam-2" },
    { id: 3, x: 485, y: 48, color: "pureWhite", initialRotate: -6, animClass: "spotlight-beam-3" },
    { id: 4, x: 515, y: 48, color: "softWhite", initialRotate: 8, animClass: "spotlight-beam-4" },
    { id: 5, x: 555, y: 48, color: "royalBlue", initialRotate: -10, animClass: "spotlight-beam-5" },
    { id: 6, x: 595, y: 48, color: "cobalt", initialRotate: 12, animClass: "spotlight-beam-6" },
  ];

  return (
    <>
      <defs>
        {/* Confine spotlights strictly to the rounded stage area */}
        <clipPath id={clipId}>
          <rect
            x={stageX}
            y={stageY}
            width={stageWidth}
            height={stageHeight}
            rx={stageRx}
          />
        </clipPath>

        {/* 1. Deep Blue Gradient */}
        <linearGradient
          id={`${idPrefix}-beam-deepBlue`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="8%" stopColor="#93c5fd" stopOpacity="0.7" />
          <stop offset="35%" stopColor="#2563eb" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#1d4ed8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.0" />
        </linearGradient>

        {/* 2. Ice Cyan Gradient */}
        <linearGradient
          id={`${idPrefix}-beam-cyan`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="10%" stopColor="#7dd3fc" stopOpacity="0.75" />
          <stop offset="35%" stopColor="#0284c7" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#0369a1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#075985" stopOpacity="0.0" />
        </linearGradient>

        {/* 3. Pure White Gradient */}
        <linearGradient
          id={`${idPrefix}-beam-pureWhite`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="12%" stopColor="#f8fafc" stopOpacity="0.7" />
          <stop offset="40%" stopColor="#e2e8f0" stopOpacity="0.4" />
          <stop offset="75%" stopColor="#94a3b8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#64748b" stopOpacity="0.0" />
        </linearGradient>

        {/* 4. Soft White/Blue Gradient */}
        <linearGradient
          id={`${idPrefix}-beam-softWhite`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="12%" stopColor="#e0f2fe" stopOpacity="0.7" />
          <stop offset="38%" stopColor="#60a5fa" stopOpacity="0.4" />
          <stop offset="75%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.0" />
        </linearGradient>

        {/* 5. Royal Blue Gradient */}
        <linearGradient
          id={`${idPrefix}-beam-royalBlue`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="10%" stopColor="#60a5fa" stopOpacity="0.7" />
          <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#1e40af" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#172554" stopOpacity="0.0" />
        </linearGradient>

        {/* 6. Cobalt Midnight Gradient */}
        <linearGradient
          id={`${idPrefix}-beam-cobalt`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="10%" stopColor="#818cf8" stopOpacity="0.65" />
          <stop offset="40%" stopColor="#4338ca" stopOpacity="0.35" />
          <stop offset="75%" stopColor="#312e81" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.0" />
        </linearGradient>

        {/* Floor landing pools */}
        <radialGradient
          id={`${idPrefix}-floor-pool`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="30%" stopColor="#60a5fa" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#2563eb" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1e40af" stopOpacity="0.0" />
        </radialGradient>

        {/* Stage ambient atmosphere glow */}
        <linearGradient
          id={`${idPrefix}-stage-ambient`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
          <stop offset="40%" stopColor="#6366f1" stopOpacity="0.12" />
          <stop offset="85%" stopColor="#1e1b4b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.35" />
        </linearGradient>

        {/* Keyframe styles scoped to moving spotlights */}
        <style>{`
          @keyframes stage-sweep-1 {
            0%, 100% { transform: rotate(-16deg); opacity: 0.55; }
            50% { transform: rotate(14deg); opacity: 0.85; }
          }
          @keyframes stage-sweep-2 {
            0%, 100% { transform: rotate(15deg); opacity: 0.75; }
            50% { transform: rotate(-18deg); opacity: 0.5; }
          }
          @keyframes stage-sweep-3 {
            0%, 100% { transform: rotate(-12deg); opacity: 0.65; }
            50% { transform: rotate(16deg); opacity: 0.95; }
          }
          @keyframes stage-sweep-4 {
            0%, 100% { transform: rotate(14deg); opacity: 0.9; }
            50% { transform: rotate(-10deg); opacity: 0.6; }
          }
          @keyframes stage-sweep-5 {
            0%, 100% { transform: rotate(-15deg); opacity: 0.55; }
            50% { transform: rotate(18deg); opacity: 0.85; }
          }
          @keyframes stage-sweep-6 {
            0%, 100% { transform: rotate(18deg); opacity: 0.8; }
            50% { transform: rotate(-14deg); opacity: 0.5; }
          }
          @keyframes stage-ambient-pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.85; }
          }
          @keyframes lens-flare-pulse {
            0%, 100% { transform: scale(1); opacity: 0.75; }
            50% { transform: scale(1.3); opacity: 1; }
          }

          .spotlight-beam-1 {
            transform-origin: 405px 48px;
            animation: stage-sweep-1 7.4s ease-in-out infinite;
          }
          .spotlight-beam-2 {
            transform-origin: 445px 48px;
            animation: stage-sweep-2 8.6s ease-in-out infinite -2.2s;
          }
          .spotlight-beam-3 {
            transform-origin: 485px 48px;
            animation: stage-sweep-3 6.9s ease-in-out infinite -4.1s;
          }
          .spotlight-beam-4 {
            transform-origin: 515px 48px;
            animation: stage-sweep-4 7.3s ease-in-out infinite -1.5s;
          }
          .spotlight-beam-5 {
            transform-origin: 555px 48px;
            animation: stage-sweep-5 8.1s ease-in-out infinite -3.6s;
          }
          .spotlight-beam-6 {
            transform-origin: 595px 48px;
            animation: stage-sweep-6 7.7s ease-in-out infinite -5.3s;
          }
          .ambient-pulse-layer {
            animation: stage-ambient-pulse 6s ease-in-out infinite;
          }
          .lens-pulse {
            animation: lens-flare-pulse 2.5s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          @media (prefers-reduced-motion: reduce) {
            .spotlight-beam-1,
            .spotlight-beam-2,
            .spotlight-beam-3,
            .spotlight-beam-4,
            .spotlight-beam-5,
            .spotlight-beam-6,
            .ambient-pulse-layer,
            .lens-pulse {
              animation: none !important;
            }
          }
        `}</style>
      </defs>

      {/* Clipped Lighting Group - Conical light beams sweeping inside the stage */}
      <g
        clipPath={`url(#${clipId})`}
        pointerEvents="none"
        style={{ mixBlendMode: "screen" }}
      >
        {/* Soft atmospheric stage haze layer */}
        <rect
          x={stageX}
          y={stageY}
          width={stageWidth}
          height={stageHeight}
          fill={`url(#${idPrefix}-stage-ambient)`}
          className="ambient-pulse-layer"
        />

        {/* Sweeping Light Beams */}
        {spotlights.map((s) => (
          <g key={s.id} className={s.animClass}>
            {/* Wide Conical Light Beam */}
            <polygon
              points={`${s.x - 4},${s.y} ${s.x + 4},${s.y} ${s.x + 46},390 ${s.x - 46},390`}
              fill={`url(#${idPrefix}-beam-${s.color})`}
            />

            {/* Inner Core Light Beam (bright high-intensity center) */}
            <polygon
              points={`${s.x - 2},${s.y} ${s.x + 2},${s.y} ${s.x + 20},385 ${s.x - 20},385`}
              fill="#ffffff"
              opacity="0.3"
            />

            {/* Stage Floor Light Pool Reflection */}
            <ellipse
              cx={s.x}
              cy={378}
              rx={46}
              ry={15}
              fill={`url(#${idPrefix}-floor-pool)`}
              opacity="0.75"
            />
          </g>
        ))}

        {/* Stage Floor Light Line */}
        <line
          x1={stageX + 15}
          y1={stageY + stageHeight - 12}
          x2={stageX + stageWidth - 15}
          y2={stageY + stageHeight - 12}
          stroke="#60a5fa"
          strokeWidth="2"
          opacity="0.35"
        />
      </g>

      {/* Overhead Lighting Rig & Spotlight Fixtures (clipped inside stage top) */}
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        {/* Overhead Truss Rig Bar */}
        <line
          x1={stageX + 10}
          y1={44}
          x2={stageX + stageWidth - 10}
          y2={44}
          stroke="#0f172a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <line
          x1={stageX + 12}
          y1={44}
          x2={stageX + stageWidth - 12}
          y2={44}
          stroke="#475569"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Spotlight Emitter Fixtures & Lenses */}
        {spotlights.map((s) => (
          <g key={`fixture-${s.id}`}>
            {/* Lamp Housing Bracket */}
            <rect
              x={s.x - 6}
              y={42}
              width={12}
              height={7}
              rx={2}
              fill="#090d16"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Outer Lens Glow Halo */}
            <circle
              cx={s.x}
              cy={49}
              r={7}
              fill={s.color.toLowerCase().includes("white") ? "#ffffff" : "#60a5fa"}
              opacity="0.4"
              className="lens-pulse"
            />

            {/* Glowing Lamp Bulb Core */}
            <circle
              cx={s.x}
              cy={49}
              r={3.5}
              fill="#ffffff"
            />
          </g>
        ))}
      </g>
    </>
  );
}
