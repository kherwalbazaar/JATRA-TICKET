"use client";

import { useState, useEffect, useRef } from "react";
import {
  subscribeBlockCategories,
  isBlockOnline,
  blockDisplayName,
} from "../../lib/blockCategories";
import { subscribeTicketTypes, getPriceForRow } from "../../lib/ticketTypes";
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
 * Label anchors per block inside the 1000x900 viewBox.
 * `maxW` is the widest a line may get without crossing its block polygon,
 * `max` the largest size the vertical gap to the next line allows,
 * `init` a known-safe size used until the real font is measured.
 */
export const BLOCK_LABEL_LAYOUT = {
  C2: {
    x: 195,
    name: { y: 105, maxW: 282, max: 44, init: 32 },
    channel: { y: 142, maxW: 282, max: 30, init: 20 },
    price: { y: 180, maxW: 282, max: 34, init: 24 },
  },
  A2: {
    x: 805,
    name: { y: 105, maxW: 282, max: 44, init: 32 },
    channel: { y: 142, maxW: 282, max: 30, init: 20 },
    price: { y: 180, maxW: 282, max: 34, init: 24 },
  },
  C3: {
    x: 105,
    name: { y: 490, maxW: 118, max: 30, init: 28, spacing: -0.2 },
    channel: { y: 528, maxW: 118, max: 26, init: 20 },
    price: { y: 566, maxW: 118, max: 22, init: 20 },
  },
  A3: {
    x: 895,
    name: { y: 490, maxW: 118, max: 30, init: 28, spacing: -0.2 },
    channel: { y: 528, maxW: 118, max: 26, init: 20 },
    price: { y: 566, maxW: 118, max: 22, init: 20 },
  },
  C1: {
    x: 270,
    priceX: 265,
    name: { y: 380, maxW: 142, max: 36, init: 32 },
    channel: { y: 418, maxW: 142, max: 28, init: 20 },
    price: { y: 456, maxW: 120, max: 26, init: 22 },
  },
  A1: {
    x: 730,
    priceX: 735,
    name: { y: 380, maxW: 142, max: 36, init: 32 },
    channel: { y: 418, maxW: 142, max: 28, init: 20 },
    price: { y: 456, maxW: 120, max: 26, init: 22 },
  },
  B1: {
    x: 500,
    name: { y: 505, maxW: 300, max: 58, init: 38 },
    channel: { y: 548, maxW: 400, max: 34, init: 22 },
    price: { y: 590, maxW: 440, max: 38, init: 28 },
  },
  B2: {
    x: 290,
    name: { y: 742, maxW: 270, max: 46, init: 32 },
    channel: { y: 780, maxW: 280, max: 30, init: 20 },
    price: { y: 818, maxW: 300, max: 32, init: 24 },
  },
  B3: {
    x: 710,
    name: { y: 742, maxW: 270, max: 46, init: 32 },
    channel: { y: 780, maxW: 280, max: 30, init: 20 },
    price: { y: 818, maxW: 300, max: 32, init: 24 },
  },
};

const FIT_MIN_FONT = 15;

/** Bare block name for the diagram — "C2", not "Block C2". */
export function diagramBlockLabel(blockCats, id) {
  const raw = blockDisplayName(blockCats, id) || id;
  return raw.replace(/^block\s+/i, "");
}

const isSeatTaken = (s) => {
  const st = String(s.status || "").toLowerCase();
  if (st === "booked" || st === "sold") return true;
  return st === "reserved" && isHoldFresh(s);
};

/** True only once seats for the block are loaded and every one of them is gone. */
export function isBlockSoldOut(id, seatsByBlock) {
  const list = seatsByBlock[id] || [];
  return list.length > 0 && list.every(isSeatTaken);
}

export function blockStatusText(id, seatsByBlock) {
  return isBlockSoldOut(id, seatsByBlock) ? "Not Available" : "Available";
}

/** Availability colour: the block fill already flags Online vs Counter. */
export function blockStatusColor(id, seatsByBlock) {
  return isBlockSoldOut(id, seatsByBlock) ? "#fee2e2" : "#bbf7d0";
}

/** Unique seat prices for a block, e.g. Star 200 + VIP 150 -> [200, 150]. */
export function diagramBlockPrices(id, seatsByBlock, ticketTypes, seatPrice = 0) {
  const list = seatsByBlock[id] || [];
  const priceSet = new Set();

  if (list.length > 0) {
    list.forEach((s) => {
      const rawP = Number(s.price);
      if (!isNaN(rawP) && rawP > 0) {
        priceSet.add(rawP);
      } else {
        const rowPrice = getPriceForRow(s.rowId || s.row, ticketTypes);
        if (rowPrice && Number(rowPrice) > 0) {
          priceSet.add(Number(rowPrice));
        }
      }
    });
  }

  if (priceSet.size > 0) {
    return Array.from(priceSet).sort((a, b) => b - a);
  }

  // Default category tier fallbacks when seats for a block are not loaded yet
  if (id === "B1") return [200, 150]; // Star (A-E) 200 & VIP (F-K) 150
  if (id === "B2" || id === "B3") return [150, 100];
  if (id === "C3" || id === "A3") return [100, 80];
  if (seatPrice > 0) return [seatPrice];
  return [200];
}

export function diagramBlockPriceText(id, seatsByBlock, ticketTypes, seatPrice = 0) {
  const prices = diagramBlockPrices(id, seatsByBlock, ticketTypes, seatPrice);
  if (!prices || prices.length === 0) return null;
  if (prices.length === 1) return `₹${prices[0]}`;
  if (prices.length === 2) return `₹${prices[0]} & ₹${prices[1]}`;
  return prices.map((p) => `₹${p}`).join(" & ");
}

/**
 * SVG text that grows to the largest size still fitting its block, measured with
 * the real rendered font. Sizes live in viewBox units, so they scale with screen width.
 */
export function FitLabel({ text, x, y, maxW, max, init, spacing = 0.5, fill, weight }) {
  const ref = useRef(null);
  const [size, setSize] = useState(init);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.getComputedTextLength !== "function") return;
    let fitted = init;
    el.setAttribute("font-size", String(max));
    const widthAtMax = el.getComputedTextLength();
    if (widthAtMax <= maxW) {
      fitted = max;
    } else {
      fitted = Math.max(FIT_MIN_FONT, Math.floor((max * maxW) / widthAtMax));
      el.setAttribute("font-size", String(fitted));
      // letter-spacing is absolute, so the proportional guess can still overshoot
      if (el.getComputedTextLength() > maxW) fitted -= 2;
    }
    setSize(fitted);
  }, [text, maxW, max, init]);

  return (
    <text
      ref={ref}
      x={x}
      y={y}
      textAnchor="middle"
      fill={fill}
      fontSize={size}
      fontWeight={weight}
      letterSpacing={spacing}
      style={{ textShadow: "0 2px 4px rgba(0,0,0,0.85)" }}
      pointerEvents="none"
    >
      {text}
    </text>
  );
}

/**
 * The three auto-fitted lines drawn inside every block: name, Online/Counter, price.
 * Shared by the block diagram and the /seats map so both stay in sync.
 */
export function BlockLabels({ layout, name, status, statusFill, price }) {
  return (
    <>
      <FitLabel text={name} x={layout.x} fill="#ffffff" weight={900} {...layout.name} />
      <FitLabel
        text={status}
        x={layout.x}
        fill={statusFill}
        weight={900}
        {...layout.channel}
      />
      {price != null && (
        <FitLabel
          text={price}
          x={layout.priceX ?? layout.x}
          fill="#fef08a"
          weight={900}
          {...layout.price}
        />
      )}
    </>
  );
}

/**
 * Interactive venue block-category diagram.
 * Click a block to select it. Colors: green=Online, amber=Counter, red=Not Available.
 */
export default function BlockCategoryDiagram({
  seatsByBlock = {},
  activeBlock = null,
  onSelectBlock,
  onCounterBlockClick,
  seatPrice = 0,
  compact = false,
  title = "Block Category Map",
  eventId = "",
  ticketTypes: propTicketTypes = null,
}) {
  const [blockCats, setBlockCats] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);

  useEffect(() => subscribeBlockCategories(setBlockCats), []);
  useEffect(() => {
    return subscribeTicketTypes(setTicketTypes, eventId);
  }, [eventId]);

  const isOnlineBlock = (id) => isBlockOnline(blockCats, id);
  const blockLabel = (id) => diagramBlockLabel(blockCats, id);

  const blockFill = (id) => {
    if (isBlockSoldOut(id, seatsByBlock)) return "#ef4444";
    return isOnlineBlock(id) ? "#16a34a" : "#d97706";
  };

  const blockPriceText = (id) =>
    diagramBlockPriceText(id, seatsByBlock, propTicketTypes || ticketTypes, seatPrice);

  const renderBlockLabels = (id) => (
    <BlockLabels
      layout={BLOCK_LABEL_LAYOUT[id]}
      name={blockLabel(id)}
      status={blockStatusText(id, seatsByBlock)}
      statusFill={blockStatusColor(id, seatsByBlock)}
      price={blockPriceText(id)}
    />
  );

  const handleClick = (id) => {
    if (!isOnlineBlock(id)) {
      if (onCounterBlockClick) {
        onCounterBlockClick(id);
      }
      return;
    }
    if (onSelectBlock) onSelectBlock(id);
  };

  const blockClass = (id) =>
    `block-path ${isOnlineBlock(id) ? "" : "block-off "}${
      activeBlock === id ? "block-active" : ""
    }`;

  const blockStyle = (id) => ({
    cursor: isOnlineBlock(id) ? "pointer" : "not-allowed",
    transition: "all 0.2s ease-in-out",
    opacity: activeBlock && activeBlock !== id ? 0.4 : 1,
  });

  const activeStroke = (id) => (activeBlock === id ? "#fbbf24" : "#38bdf8");
  const activeWidth = (id) => (activeBlock === id ? 5 : 1.5);

  return (
    <div className="w-full bg-transparent p-0">
      {/* Legend Bar (Fills left to right with background) */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 mb-2.5 flex items-center justify-around text-xs font-bold text-slate-200 shadow-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#16a34a] inline-block shadow-xs" />
          <span>Online</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#d97706] inline-block shadow-xs" />
          <span>Counter</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#ef4444] inline-block shadow-xs" />
          <span>Not Available</span>
        </span>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-md border border-slate-700/80 bg-[#0f172a]">
        <svg
          viewBox="0 0 1000 900"
          className="w-full h-auto select-none block"
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
          {renderBlockLabels("C2")}
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
          {renderBlockLabels("A2")}
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
          {renderBlockLabels("C3")}
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
          {renderBlockLabels("C1")}
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
          {renderBlockLabels("A1")}
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
          {renderBlockLabels("A3")}
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
          {renderBlockLabels("B1")}
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
          {renderBlockLabels("B2")}
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
          {renderBlockLabels("B3")}
        </g>
      </svg>
    </div>
  </div>
);
}
