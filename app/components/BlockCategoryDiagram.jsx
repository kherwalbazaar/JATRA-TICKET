"use client";

import { useState, useEffect } from "react";
import {
  subscribeBlockCategories,
  isBlockOnline,
  blockDisplayName,
  blockChannelText,
} from "../../lib/blockCategories";
import { isHoldFresh } from "../../lib/seats";
import MovingSpotlights from "./MovingSpotlights";

function roundedPolygon(pointsStr, radius = 10) {
  const pts = pointsStr.trim().split(/\s+/).map((p) => {
    const parts = p.split(",").map(Number);
    return { x: parts[0], y: parts[1] };
  });
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const vPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const lenPrev = Math.hypot(vPrev.x, vPrev.y);
    const vNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenNext = Math.hypot(vNext.x, vNext.y);
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);
    const start = {
      x: (curr.x + (vPrev.x / lenPrev) * r).toFixed(1),
      y: (curr.y + (vPrev.y / lenPrev) * r).toFixed(1),
    };
    const end = {
      x: (curr.x + (vNext.x / lenNext) * r).toFixed(1),
      y: (curr.y + (vNext.y / lenNext) * r).toFixed(1),
    };
    if (i === 0) {
      d += `M ${start.x},${start.y} `;
    } else {
      d += `L ${start.x},${start.y} `;
    }
    d += `Q ${curr.x},${curr.y} ${end.x},${end.y} `;
  }
  return d + "Z";
}

/**
 * Interactive venue block-category diagram.
 * Click a block to select it. Colors: green=Online, amber=Counter, red=All Booked.
 */
export default function BlockCategoryDiagram({
  seatsByBlock = {},
  activeBlock = null,
  onSelectBlock,
  seatPrice = 0,
  compact = false,
  title = "Block Category Map",
}) {
  const [blockCats, setBlockCats] = useState([]);

  useEffect(() => subscribeBlockCategories(setBlockCats), []);

  const isOnlineBlock = (id) => isBlockOnline(blockCats, id);
  const blockLabel = (id) => blockDisplayName(blockCats, id);
  const subLabel = (id) => blockChannelText(blockCats, id);
  const channelColor = (id) => (isOnlineBlock(blockCats, id) ? "#dcfce7" : "#fffbeb");

  const blockFill = (id) => {
    const list = seatsByBlock[id] || [];
    const seatTaken = (s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "booked" || st === "sold") return true;
      if (st === "reserved" && isHoldFresh(s)) return true;
      return false;
    };
    if (list.length && list.every(seatTaken)) return "#ef4444";
    return isOnlineBlock(id) ? "#16a34a" : "#d97706";
  };

  const blockPrice = (id) => {
    const list = seatsByBlock[id] || [];
    const found = list.find((s) => s.price != null && Number(s.price) > 0);
    return found ? Number(found.price) : seatPrice > 0 ? seatPrice : null;
  };

  const handleClick = (id) => {
    if (!isOnlineBlock(id)) return;
    if (onSelectBlock) onSelectBlock(id);
  };

  const blockClass = (id) =>
    `block-path ${isOnlineBlock(id) ? "" : "block-off "}${
      activeBlock === id ? "block-active" : ""
    }`;

  const blockStyle = (id) => ({
    cursor: isOnlineBlock(id) ? "pointer" : "not-allowed",
    transition: "all 0.2s ease-in-out",
    opacity: activeBlock && activeBlock !== id ? 0.55 : 1,
  });

  const activeStroke = (id) => (activeBlock === id ? "#fbbf24" : "#38bdf8");
  const activeWidth = (id) => (activeBlock === id ? 4 : 1.5);

  return (
    <div
      className={`bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-lg ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <h3 className="text-center text-sm font-black text-sky-400 font-brand mb-1">
        {title}
      </h3>
      <p className="text-center text-slate-400 text-[10px] mb-2">
        Tap a <span className="text-sky-300 font-semibold">green block</span> to
        select seats
      </p>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mb-2 text-[9px] font-bold text-slate-400 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[#16a34a] inline-block" /> Online
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[#d97706] inline-block" /> Counter
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[#ef4444] inline-block" /> All
          Booked
        </span>
      </div>

      <svg
        viewBox="0 0 1000 900"
        className="w-full h-auto select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="bdiag-stageGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="1" />
          </linearGradient>
          <linearGradient
            id="bdiag-stageBorderGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#a855f7" stopOpacity="1" />
            <stop offset="50%" stopColor="#f472b6" stopOpacity="1" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="1000" height="900" fill="#0f172a" rx="20" />

        {/* STAGE */}
        <g>
          <rect
            x="370"
            y="40"
            width="260"
            height="360"
            fill="url(#bdiag-stageGradient)"
            stroke="url(#bdiag-stageBorderGradient)"
            strokeWidth="4"
            rx="14"
          />
          <MovingSpotlights idPrefix="bdiag" />
          <text
            x="500"
            y="185"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            letterSpacing="2"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85)" }}
          >
            STAGE
          </text>
          <text
            x="500"
            y="220"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="14"
            letterSpacing="4"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}
          >
            FRONT
          </text>
        </g>

        {/* BLOCK C2 (Top Left) */}
        <g
          onClick={() => handleClick("C2")}
          className={blockClass("C2")}
          style={blockStyle("C2")}
        >
          <rect
            x="40"
            y="40"
            width="310"
            height="190"
            fill={blockFill("C2")}
            stroke={activeStroke("C2")}
            strokeWidth={activeWidth("C2")}
            rx="12"
          />
          <text
            x="195"
            y="120"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("C2")}
          </text>
          <text
            x="195"
            y="150"
            textAnchor="middle"
            fill={channelColor("C2")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("C2")}
          </text>
          {blockPrice("C2") != null && (
            <text
              x="195"
              y="178"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="16"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("C2")}
            </text>
          )}
        </g>

        {/* BLOCK A2 (Top Right) */}
        <g
          onClick={() => handleClick("A2")}
          className={blockClass("A2")}
          style={blockStyle("A2")}
        >
          <rect
            x="650"
            y="40"
            width="310"
            height="190"
            fill={blockFill("A2")}
            stroke={activeStroke("A2")}
            strokeWidth={activeWidth("A2")}
            rx="12"
          />
          <text
            x="805"
            y="120"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("A2")}
          </text>
          <text
            x="805"
            y="150"
            textAnchor="middle"
            fill={channelColor("A2")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("A2")}
          </text>
          {blockPrice("A2") != null && (
            <text
              x="805"
              y="178"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="16"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("A2")}
            </text>
          )}
        </g>

        {/* BLOCK C3 (Outer Left) */}
        <g
          onClick={() => handleClick("C3")}
          className={blockClass("C3")}
          style={blockStyle("C3")}
        >
          <path
            d={roundedPolygon("40,250 170,250 170,680 40,840", 12)}
            fill={blockFill("C3")}
            stroke={activeStroke("C3")}
            strokeWidth={activeWidth("C3")}
            strokeLinejoin="round"
          />
          <text
            x="105"
            y="500"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("C3")}
          </text>
          <text
            x="105"
            y="530"
            textAnchor="middle"
            fill={channelColor("C3")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("C3")}
          </text>
          {blockPrice("C3") != null && (
            <text
              x="105"
              y="558"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="15"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("C3")}
            </text>
          )}
        </g>

        {/* BLOCK C1 (Inner Left) */}
        <g
          onClick={() => handleClick("C1")}
          className={blockClass("C1")}
          style={blockStyle("C1")}
        >
          <path
            d={roundedPolygon("190,250 350,250 350,420 190,660", 12)}
            fill={blockFill("C1")}
            stroke={activeStroke("C1")}
            strokeWidth={activeWidth("C1")}
            strokeLinejoin="round"
          />
          <text
            x="270"
            y="420"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("C1")}
          </text>
          <text
            x="270"
            y="450"
            textAnchor="middle"
            fill={channelColor("C1")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("C1")}
          </text>
          {blockPrice("C1") != null && (
            <text
              x="270"
              y="478"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="15"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("C1")}
            </text>
          )}
        </g>

        {/* BLOCK A1 (Inner Right) */}
        <g
          onClick={() => handleClick("A1")}
          className={blockClass("A1")}
          style={blockStyle("A1")}
        >
          <path
            d={roundedPolygon("650,250 810,250 810,660 650,420", 12)}
            fill={blockFill("A1")}
            stroke={activeStroke("A1")}
            strokeWidth={activeWidth("A1")}
            strokeLinejoin="round"
          />
          <text
            x="730"
            y="420"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("A1")}
          </text>
          <text
            x="730"
            y="450"
            textAnchor="middle"
            fill={channelColor("A1")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("A1")}
          </text>
          {blockPrice("A1") != null && (
            <text
              x="730"
              y="478"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="15"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("A1")}
            </text>
          )}
        </g>

        {/* BLOCK A3 (Outer Right) */}
        <g
          onClick={() => handleClick("A3")}
          className={blockClass("A3")}
          style={blockStyle("A3")}
        >
          <path
            d={roundedPolygon("830,250 960,250 960,840 830,680", 12)}
            fill={blockFill("A3")}
            stroke={activeStroke("A3")}
            strokeWidth={activeWidth("A3")}
            strokeLinejoin="round"
          />
          <text
            x="895"
            y="500"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("A3")}
          </text>
          <text
            x="895"
            y="530"
            textAnchor="middle"
            fill={channelColor("A3")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("A3")}
          </text>
          {blockPrice("A3") != null && (
            <text
              x="895"
              y="558"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="15"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("A3")}
            </text>
          )}
        </g>

        {/* BLOCK B1 (Main Center Front Trapezoid) */}
        <g
          onClick={() => handleClick("B1")}
          className={blockClass("B1")}
          style={blockStyle("B1")}
        >
          <path
            d={roundedPolygon("370,420 630,420 780,660 220,660", 12)}
            fill={blockFill("B1")}
            stroke={activeStroke("B1")}
            strokeWidth={activeWidth("B1")}
            strokeLinejoin="round"
          />
          <text
            x="500"
            y="520"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("B1")}
          </text>
          <text
            x="500"
            y="552"
            textAnchor="middle"
            fill={channelColor("B1")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("B1")}
          </text>
          {blockPrice("B1") != null && (
            <text
              x="500"
              y="582"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="16"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("B1")}
            </text>
          )}
        </g>

        {/* BLOCK B2 (Bottom Left) */}
        <g
          onClick={() => handleClick("B2")}
          className={blockClass("B2")}
          style={blockStyle("B2")}
        >
          <path
            d={roundedPolygon("200,680 480,680 480,860 60,860", 12)}
            fill={blockFill("B2")}
            stroke={activeStroke("B2")}
            strokeWidth={activeWidth("B2")}
            strokeLinejoin="round"
          />
          <text
            x="290"
            y="755"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("B2")}
          </text>
          <text
            x="290"
            y="785"
            textAnchor="middle"
            fill={channelColor("B2")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("B2")}
          </text>
          {blockPrice("B2") != null && (
            <text
              x="290"
              y="813"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="15"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("B2")}
            </text>
          )}
        </g>

        {/* BLOCK B3 (Bottom Right) */}
        <g
          onClick={() => handleClick("B3")}
          className={blockClass("B3")}
          style={blockStyle("B3")}
        >
          <path
            d={roundedPolygon("520,680 800,680 940,860 520,860", 12)}
            fill={blockFill("B3")}
            stroke={activeStroke("B3")}
            strokeWidth={activeWidth("B3")}
            strokeLinejoin="round"
          />
          <text
            x="710"
            y="755"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
            pointerEvents="none"
          >
            {blockLabel("B3")}
          </text>
          <text
            x="710"
            y="785"
            textAnchor="middle"
            fill={channelColor("B3")}
            fontSize="13"
            pointerEvents="none"
          >
            {subLabel("B3")}
          </text>
          {blockPrice("B3") != null && (
            <text
              x="710"
              y="813"
              textAnchor="middle"
              fill="#fde68a"
              fontSize="15"
              fontWeight="bold"
              pointerEvents="none"
            >
              ₹{blockPrice("B3")}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
