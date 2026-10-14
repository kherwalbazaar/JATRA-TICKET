"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  subscribeSeats,
  holdSeat,
  releaseSeatHold,
  reserveSeatsTransaction,
  BLOCK_GROUPS,
  getHoldSessionId,
  isHoldFresh,
} from "../../lib/seats";
import { calculateCustomerCharges } from "../../lib/pricing";
import {
  getSavedCustomerProfile,
  getActiveCustomerProfile,
} from "../../lib/supabase";
import {
  subscribeBlockCategories,
  blockDisplayName,
  isBlockOnline,
} from "../../lib/blockCategories";
import { fetchEvents } from "../../lib/events";
import { subscribeTicketTypes } from "../../lib/ticketTypes";
import UserSeatGrid from "./UserSeatGrid";
import BlockCategoryDiagram from "./BlockCategoryDiagram";

export const bookingTiers = [
  { id: "standing", name: "STANDING", price: 50, gate: "Gate A" },
  { id: "special", name: "SPECIAL", price: 100, gate: "Gate B" },
  { id: "vip", name: "VIP", price: 200, gate: "Gate C" },
  { id: "star", name: "STAR", price: 500, gate: "Gate D" },
];

export default function BookingForm({
  onClose,
  fullPage = false,
  initialEventId = "",
  initialEventName = "",
  initialDate = "",
  initialTime = "",
  block: initialBlock = "",
  seats: initialSeats = "",
  seatPrice: initialSeatPrice = 0,
  initialTierId = "vip",
  initialQuantity = 1,
  eventName: propEventName = "",
}) {
  const router = useRouter();

  // Resolved Event States
  const [resolvedEventId, setResolvedEventId] = useState(initialEventId || "");
  const [resolvedEventName, setResolvedEventName] = useState(
    initialEventName || propEventName || "Event"
  );
  const [eventDate, setEventDate] = useState(initialDate || "");
  const [eventTime, setEventTime] = useState(initialTime || "");

  // Seat & Block Selection States
  const [activeBlock, setActiveBlock] = useState(initialBlock || null);
  const [selectedSeats, setSelectedSeats] = useState(
    initialSeats ? initialSeats.split(",").filter(Boolean) : []
  );
  const [seatsByBlock, setSeatsByBlock] = useState({});
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [blockCats, setBlockCats] = useState([]);

  // Profile States
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Sequential Step States (1: Seat Selection, 2: Ticket Details, 3: Payment Breakdown, 4: Confirm & Book)
  const [activeStep, setActiveStep] = useState(
    initialSeats && initialSeats.split(",").filter(Boolean).length > 0 ? 2 : 1
  );

  // Payment & Submission States
  const [paymentMethod, setPaymentMethod] = useState("phonepe");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // 1. Subscribe to Live Block Categories
  useEffect(() => subscribeBlockCategories(setBlockCats), []);

  const isOnline = (id) => isBlockOnline(blockCats, id);
  const getBlockName = (id) => blockDisplayName(blockCats, id);

  // 2. Resolve Event Details if not passed
  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      if (resolvedEventId) return;
      try {
        const events = await fetchEvents();
        if (cancelled || !events || !events.length) return;
        const matched = events[0];
        setResolvedEventId(matched.key || matched.id || "");
        setResolvedEventName(matched.eventTitle || matched.name || "Event");
        setEventDate(matched.date || "");
        setEventTime(matched.time || "11:00 PM");
      } catch (e) {
        console.warn("fetchEvents notice:", e);
      }
    }
    loadEvent();
    return () => {
      cancelled = true;
    };
  }, [resolvedEventId]);

  // 3. Profile Validation & Auto-load on Mount
  useEffect(() => {
    let cancelled = false;
    async function verifyProfile() {
      setProfileLoading(true);
      const saved = getSavedCustomerProfile();
      if (saved && saved.full_name) {
        if (!cancelled) {
          setProfile(saved);
          setProfileLoading(false);
        }
        return;
      }

      const active = await getActiveCustomerProfile();
      if (!cancelled) {
        if (active && active.full_name) {
          setProfile(active);
          setProfileLoading(false);
        } else {
          setProfileLoading(false);
          // Redirect to Profile Create page
          if (typeof window !== "undefined") {
            const currentPath =
              window.location.pathname + window.location.search;
            router.push(`/profile?redirect=${encodeURIComponent(currentPath)}`);
          }
        }
      }
    }
    verifyProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 4. Live Seats Subscription
  useEffect(() => {
    if (!resolvedEventId) return;
    setLoadingSeats(true);
    let firstSnapshot = true;
    const unsubscribe = subscribeSeats(resolvedEventId, (seats) => {
      setSeatsByBlock(seats);
      if (firstSnapshot) {
        firstSnapshot = false;
        setLoadingSeats(false);
      }
    });
    return () => unsubscribe();
  }, [resolvedEventId]);

  // 5. Auto-select first online block with seats
  useEffect(() => {
    if (!activeBlock && Object.keys(seatsByBlock).length > 0) {
      const onlineWithSeats = Object.keys(seatsByBlock).find(
        (b) => (seatsByBlock[b] || []).length > 0 && isOnline(b)
      );
      if (onlineWithSeats) {
        setActiveBlock(onlineWithSeats);
      } else {
        const first = Object.keys(seatsByBlock).find(
          (b) => (seatsByBlock[b] || []).length > 0
        );
        if (first) setActiveBlock(first);
      }
    }
  }, [seatsByBlock, activeBlock, blockCats]);

  // Available block groups
  const availableBlocks = useMemo(() => {
    const fsBlocks = Object.keys(seatsByBlock)
      .filter((b) => (seatsByBlock[b] || []).length > 0)
      .sort();

    const all = [
      ...new Set([
        ...BLOCK_GROUPS.rightSide,
        ...BLOCK_GROUPS.frontCenter,
        ...BLOCK_GROUPS.leftSide,
        ...fsBlocks,
      ]),
    ];

    return all.filter(isOnline);
  }, [seatsByBlock, blockCats]);

  // Determine Seat Price
  const seatPrice = useMemo(() => {
    if (initialSeatPrice && Number(initialSeatPrice) > 0) {
      return Number(initialSeatPrice);
    }
    const list = seatsByBlock[activeBlock] || [];
    const found = list.find((s) => s.price != null && Number(s.price) > 0);
    if (found) return Number(found.price);
    return 100;
  }, [initialSeatPrice, seatsByBlock, activeBlock]);

  // Calculation rules:
  // Ticket Subtotal = Quantity × Price Per Ticket
  const quantity = selectedSeats.length;
  const ticketSubtotal = seatPrice * quantity;
  const pricing = useMemo(
    () => calculateCustomerCharges(ticketSubtotal),
    [ticketSubtotal]
  );
  const totalAmountPayable = pricing.finalCustomerAmount;

  // Step Validation States
  const isStep1Completed = quantity > 0;
  const isStep2Completed =
    isStep1Completed && profile && Boolean(profile.full_name) && quantity > 0;
  const isStep3Completed = isStep2Completed && totalAmountPayable > 0;
  const isStep4Enabled = isStep3Completed && !isSubmitting;

  // Invalidate later steps if seats are removed
  useEffect(() => {
    if (quantity === 0 && activeStep > 1) {
      setActiveStep(1);
    }
  }, [quantity, activeStep]);

  // Seat toggle handler
  const toggleSeat = useCallback(
    (key) => {
      const list = seatsByBlock[activeBlock] || [];
      const fs = list.find(
        (s) =>
          s.id === key ||
          s.seatLabel === key ||
          `${s.rowId}-${s.seatNumber}` === key ||
          `${s.rowId}${s.seatNumber}` === key
      );
      const st = String(fs?.status || "").toLowerCase();
      const sid = getHoldSessionId();

      if (fs && (st === "booked" || st === "locked")) return;
      if (fs && st === "reserved" && fs.reservedBy !== sid && isHoldFresh(fs)) {
        return;
      }

      const removing = selectedSeats.includes(key);
      if (!removing && selectedSeats.length >= 10) return;

      setSelectedSeats((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        return [...prev, key];
      });

      if (removing) {
        releaseSeatHold(resolvedEventId, activeBlock, key);
      } else {
        holdSeat(resolvedEventId, activeBlock, key);
      }
    },
    [activeBlock, selectedSeats, resolvedEventId, seatsByBlock]
  );

  const handleSelectBlock = (b) => {
    if (!isOnline(b)) return;
    if (b === activeBlock) return;
    // Release previous block holds if changing block
    selectedSeats.forEach((k) =>
      releaseSeatHold(resolvedEventId, activeBlock, k)
    );
    setSelectedSeats([]);
    setActiveBlock(b);
  };

  // Navigate to dedicated seat-selection page (diagram → block → seats → proceed)
  const goToSeatSelection = useCallback(() => {
    const params = new URLSearchParams();
    if (resolvedEventId) params.set("eventId", resolvedEventId);
    if (resolvedEventName) params.set("event", resolvedEventName);
    if (eventDate) params.set("date", eventDate);
    if (eventTime) params.set("time", eventTime);
    if (activeBlock) params.set("block", activeBlock);
    if (selectedSeats && selectedSeats.length > 0) {
      params.set("seats", selectedSeats.join(","));
    }
    if (seatPrice) params.set("seatPrice", String(seatPrice));
    const returnPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/book";
    params.set("return", returnPath);
    router.push(`/select-seats?${params.toString()}`);
  }, [
    resolvedEventId,
    resolvedEventName,
    eventDate,
    eventTime,
    activeBlock,
    selectedSeats,
    seatPrice,
    router,
  ]);

  // Step 4 Confirm & Book Submission
  const handleConfirmAndBook = async () => {
    if (!isStep4Enabled) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      // Revalidate and normalize seat keys
      const displaySeats = selectedSeats.map((key) => {
        const list = seatsByBlock[activeBlock] || [];
        const fs = list.find(
          (s) =>
            s.id === key ||
            s.seatLabel === key ||
            `${s.rowId}-${s.seatNumber}` === key ||
            `${s.rowId}${s.seatNumber}` === key
        );
        if (fs) return fs.id || `${fs.rowId}-${fs.seatNumber}`;
        if (key.includes("-")) return key;
        const m = String(key).match(/^([A-Za-z]+)(\d+)$/);
        if (m) return `${m[1].toUpperCase()}-${m[2]}`;
        return key;
      });

      const blockLabel = getBlockName(activeBlock) || activeBlock;

      // Atomic server validation and reservation (writes to Firestore and Supabase)
      const bookingResult = await reserveSeatsTransaction({
        showId: resolvedEventId,
        block: activeBlock,
        seats: displaySeats,
        customerName: profile?.full_name || "Customer",
        customerPhone: profile?.mobile || "",
        paymentMethod: paymentMethod.toUpperCase(),
        tier: {
          id: "seated",
          name: `SEATED (${blockLabel})`,
          price: seatPrice,
          gate: `Block ${blockLabel}`,
        },
        eventName: resolvedEventName,
        date: eventDate,
        time: eventTime,
        ticketAmount: pricing.ticketAmount,
        convenienceFee: pricing.convenienceFee,
        gstOnConvenienceFee: pricing.gstOnConvenienceFee,
        platformCharge: pricing.platformCharge,
        totalAmount: pricing.finalCustomerAmount,
      });

      // Clear hold session storage
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("jatra:seatHold");
        }
      } catch (e) {}

      // Display Booking Confirmation Modal
      setBookingConfirmed({
        ticketNumber:
          bookingResult?.ticketNumber ||
          bookingResult?.bookingId ||
          "JB-" + Date.now().toString().slice(-6),
        event: resolvedEventName,
        date: eventDate,
        time: eventTime,
        block: blockLabel,
        seats: displaySeats,
        amount: pricing.finalCustomerAmount,
        customerName: profile?.full_name || "",
        customerPhone: profile?.mobile || "",
        paymentMethod: paymentMethod.toUpperCase(),
      });
    } catch (err) {
      console.error("Booking confirmation error:", err);
      if (err?.code === "SEAT_COLLISION") {
        setErrorMessage(
          err.message ||
            "Seat Collision: One or more selected seats were just booked by another audience member. Please choose alternative seats."
        );
        setActiveStep(1); // Return to Step 1 so customer can pick other seats
      } else {
        setErrorMessage(
          err?.message ||
            "Failed to complete booking transaction. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`flex flex-col ${
        fullPage ? "min-h-screen" : "max-h-[96vh]"
      } bg-[#f8faff] text-slate-800`}
    >
      {/* ── Booking Confirmed Success Modal ── */}
      {bookingConfirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center space-y-4 border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <i className="fa-solid fa-circle-check text-4xl" />
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Booking Confirmed & Paid
              </span>
              <h3 className="text-xl font-black text-slate-900 font-brand">
                Tickets Booked Successfully!
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Your seats are reserved and confirmed in Supabase & system.
              </p>
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-bold uppercase text-[10px]">
                  Ticket No
                </span>
                <span className="font-black text-indigo-950 font-mono text-sm">
                  {bookingConfirmed.ticketNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Event</span>
                <span className="font-bold text-slate-900 text-right max-w-[65%] truncate">
                  {bookingConfirmed.event}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Date & Time</span>
                <span className="font-semibold text-slate-800">
                  {bookingConfirmed.date} • {bookingConfirmed.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Block & Seats</span>
                <span className="font-black text-amber-700">
                  Block {bookingConfirmed.block} ({bookingConfirmed.seats.join(", ")})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Audience</span>
                <span className="font-semibold text-slate-800">
                  {bookingConfirmed.customerName} (+91 {bookingConfirmed.customerPhone})
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800">Total Paid</span>
                <span className="font-black text-emerald-600 text-sm">
                  ₹{bookingConfirmed.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="w-full space-y-2 pt-2">
              <button
                onClick={() => router.push("/tickets")}
                className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <i className="fa-solid fa-ticket -rotate-12" />
                <span>View My Tickets</span>
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs transition-colors"
              aria-label="Back"
            >
              <i className="fa-solid fa-arrow-left" />
            </button>
          )}
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight font-brand">
              TICKET BOOKING FLOW
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold truncate max-w-[240px]">
              {resolvedEventName} &bull; {eventDate || "Upcoming"}
            </p>
          </div>
        </div>

        {/* Profile Pill Header */}
        {profile && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-800 max-w-[100px] truncate">
              {profile.full_name}
            </span>
          </div>
        )}
      </div>

      {/* ── SEQUENTIAL STEP PROGRESS INDICATOR ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-[57px] z-20 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-1 text-[11px] font-black">
          {/* Step 1: Seat Selection */}
          <button
            onClick={() => setActiveStep(1)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all cursor-pointer border ${
              activeStep === 1
                ? "bg-indigo-900 text-white border-indigo-900 shadow-xs"
                : isStep1Completed
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                activeStep === 1
                  ? "bg-white text-indigo-900"
                  : isStep1Completed
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-300 text-slate-700"
              }`}
            >
              {isStep1Completed && activeStep !== 1 ? "✓" : "1"}
            </span>
            <span className="truncate">Seats</span>
          </button>

          <i className="fa-solid fa-angle-right text-[9px] text-slate-300" />

          {/* Step 2: Ticket Details */}
          <button
            onClick={() => isStep1Completed && setActiveStep(2)}
            disabled={!isStep1Completed}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all border ${
              activeStep === 2
                ? "bg-indigo-900 text-white border-indigo-900 shadow-xs cursor-pointer"
                : isStep2Completed
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 cursor-pointer"
                : "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                activeStep === 2
                  ? "bg-white text-indigo-900"
                  : isStep2Completed
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-300 text-slate-600"
              }`}
            >
              {!isStep1Completed ? (
                <i className="fa-solid fa-lock text-[7px]" />
              ) : isStep2Completed && activeStep !== 2 ? (
                "✓"
              ) : (
                "2"
              )}
            </span>
            <span className="truncate">Details</span>
          </button>

          <i className="fa-solid fa-angle-right text-[9px] text-slate-300" />

          {/* Step 3: Payment Breakdown */}
          <button
            onClick={() => isStep2Completed && setActiveStep(3)}
            disabled={!isStep2Completed}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all border ${
              activeStep === 3
                ? "bg-indigo-900 text-white border-indigo-900 shadow-xs cursor-pointer"
                : isStep3Completed
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 cursor-pointer"
                : "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                activeStep === 3
                  ? "bg-white text-indigo-900"
                  : isStep3Completed
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-300 text-slate-600"
              }`}
            >
              {!isStep2Completed ? (
                <i className="fa-solid fa-lock text-[7px]" />
              ) : isStep3Completed && activeStep !== 3 ? (
                "✓"
              ) : (
                "3"
              )}
            </span>
            <span className="truncate">Payment</span>
          </button>

          <i className="fa-solid fa-angle-right text-[9px] text-slate-300" />

          {/* Step 4: Confirm & Book */}
          <button
            onClick={() => isStep3Completed && setActiveStep(4)}
            disabled={!isStep3Completed}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all border ${
              activeStep === 4
                ? "bg-indigo-900 text-white border-indigo-900 shadow-xs cursor-pointer"
                : "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                activeStep === 4
                  ? "bg-white text-indigo-900"
                  : "bg-slate-300 text-slate-600"
              }`}
            >
              {!isStep3Completed ? (
                <i className="fa-solid fa-lock text-[7px]" />
              ) : (
                "4"
              )}
            </span>
            <span className="truncate">Confirm</span>
          </button>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-rose-700 font-bold animate-in fade-in">
          <i className="fa-solid fa-circle-exclamation text-rose-500 text-sm flex-shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage("")}
            className="text-rose-400 hover:text-rose-700"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 p-4 sm:p-5 max-w-2xl mx-auto w-full space-y-5 pb-32">
        {/* ==============================================================
            SECTION 1: SEAT SELECTION
        ============================================================== */}
        <div
          className={`transition-all ${
            activeStep === 1
              ? "bg-transparent border-0 shadow-none ring-0"
              : isStep1Completed
              ? "bg-white rounded-3xl border border-emerald-200 shadow-xs"
              : "bg-white rounded-3xl border border-slate-200 opacity-80"
          }`}
        >
          {/* Header */}
          <div
            onClick={() => setActiveStep(1)}
            className={`flex items-center justify-between cursor-pointer ${
              activeStep === 1 ? "p-2 sm:p-3 border-0" : "p-4 border-b border-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                  isStep1Completed
                    ? "bg-emerald-600 text-white"
                    : activeStep === 1
                    ? "bg-indigo-900 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {isStep1Completed ? "✓" : "1"}
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-900 font-brand">
                  1. Seat Selection
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {isStep1Completed
                    ? `Block ${getBlockName(activeBlock) || activeBlock} • ${quantity} seat${quantity > 1 ? "s" : ""} selected`
                    : "Pick your seats on the seating map"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isStep1Completed && (
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {quantity} Selected
                </span>
              )}
              <i
                className={`fa-solid fa-chevron-${
                  activeStep === 1 ? "up" : "down"
                } text-xs text-slate-400`}
              />
            </div>
          </div>

          {/* Section Body */}
          {activeStep === 1 && (
            <div className="p-0 sm:p-1 space-y-4">
              {/* Interactive Stage & Block Category Diagram */}
              <div className="rounded-2xl overflow-hidden shadow-xs">
                <BlockCategoryDiagram
                  seatsByBlock={seatsByBlock}
                  activeBlock={activeBlock}
                  onSelectBlock={handleSelectBlock}
                  seatPrice={seatPrice}
                  compact={true}
                  title="Stage & Block Map"
                />
              </div>

              {/* Real Database Seat Row Grid (No Background) */}
              {activeBlock && (
                <div className="w-full">
                  <UserSeatGrid
                    showId={resolvedEventId}
                    eventId={resolvedEventId}
                    activeBlock={activeBlock}
                    selected={selectedSeats}
                    onToggleSeat={toggleSeat}
                    seatsByBlock={seatsByBlock}
                    loading={loadingSeats}
                    seatPrice={seatPrice}
                  />
                </div>
              )}

              {/* Selected Seats Summary & Proceed to Step 2 */}
              {quantity > 0 && (
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-emerald-950 font-brand">
                        Block {getBlockName(activeBlock) || activeBlock} &bull; {quantity} Seat{quantity > 1 ? "s" : ""} Selected
                      </p>
                      <p className="text-[10px] text-emerald-700 font-bold">
                        ₹{seatPrice} / seat &bull; Ticket Subtotal: ₹{ticketSubtotal}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <span>Continue</span>
                      <i className="fa-solid fa-arrow-right text-[10px]" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedSeats.map((s) => (
                      <span
                        key={s}
                        className="bg-white text-emerald-900 border border-emerald-300 text-xs font-black px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5"
                      >
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => toggleSeat(s)}
                          className="text-emerald-500 hover:text-rose-600 font-bold text-xs ml-0.5 cursor-pointer"
                          title="Deselect seat"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==============================================================
            SECTION 2: TICKET DETAILS & QUANTITY
        ============================================================== */}
        <div
          className={`bg-white rounded-3xl border transition-all ${
            !isStep1Completed
              ? "border-slate-200 bg-slate-50/60 opacity-60"
              : activeStep === 2
              ? "border-indigo-600 shadow-md ring-2 ring-indigo-500/10"
              : isStep2Completed
              ? "border-emerald-200 shadow-xs"
              : "border-slate-200"
          }`}
        >
          {/* Header */}
          <div
            onClick={() => isStep1Completed && setActiveStep(2)}
            className={`p-4 flex items-center justify-between ${
              isStep1Completed ? "cursor-pointer" : "cursor-not-allowed"
            } border-b border-slate-100`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                  !isStep1Completed
                    ? "bg-slate-200 text-slate-400"
                    : isStep2Completed
                    ? "bg-emerald-600 text-white"
                    : activeStep === 2
                    ? "bg-indigo-900 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {!isStep1Completed ? (
                  <i className="fa-solid fa-lock text-[9px]" />
                ) : isStep2Completed ? (
                  "✓"
                ) : (
                  "2"
                )}
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-900 font-brand">
                  2. Ticket Details & Quantity
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {!isStep1Completed
                    ? "Complete seat selection to unlock"
                    : `Ticket subtotal: ₹${ticketSubtotal} &bull; Profile linked`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isStep2Completed && (
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Verified
                </span>
              )}
              <i
                className={`fa-solid fa-chevron-${
                  activeStep === 2 ? "up" : "down"
                } text-xs text-slate-400`}
              />
            </div>
          </div>

          {/* Section Body */}
          {activeStep === 2 && isStep1Completed && (
            <div className="p-4 space-y-4">
              {/* Ticket Breakdown Card */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                      Category
                    </span>
                    <h3 className="text-sm font-black text-slate-900 font-brand mt-1">
                      SEATED (Block {getBlockName(activeBlock) || activeBlock})
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                      Price Per Ticket
                    </p>
                    <p className="text-base font-black text-slate-900 font-brand">
                      ₹{seatPrice}
                    </p>
                  </div>
                </div>

                <div className="border-t border-indigo-100 pt-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-600 font-semibold">
                      Quantity:
                    </span>{" "}
                    <span className="font-black text-slate-900 font-brand">
                      {quantity} Ticket{quantity > 1 ? "s" : ""}
                    </span>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Seats: {selectedSeats.join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Subtotal
                    </span>
                    <span className="text-base font-black text-indigo-900 font-brand">
                      ₹{ticketSubtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Profile Details (Loaded Automatically) */}
              <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
                  <span className="text-xs font-black uppercase tracking-wide">
                    Saved Customer Profile Loaded
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Full Name
                    </span>
                    <span className="font-black text-slate-900 text-xs">
                      {profile?.full_name || "—"}
                    </span>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Mobile Number
                    </span>
                    <span className="font-black text-slate-900 text-xs">
                      +91 {profile?.mobile || "—"}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-emerald-700 font-medium">
                  &bull; Loaded automatically from your profile. No need to fill details again.
                </p>
              </div>

              {/* Step 2 Completion Button */}
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="w-full bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold text-xs py-3 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <span>Proceed to Payment Breakdown</span>
                <i className="fa-solid fa-chevron-right text-[10px]" />
              </button>
            </div>
          )}
        </div>

        {/* ==============================================================
            SECTION 3: AUTOMATIC PAYMENT BREAKDOWN
        ============================================================== */}
        <div
          className={`bg-white rounded-3xl border transition-all ${
            !isStep2Completed
              ? "border-slate-200 bg-slate-50/60 opacity-60"
              : activeStep === 3
              ? "border-indigo-600 shadow-md ring-2 ring-indigo-500/10"
              : isStep3Completed
              ? "border-emerald-200 shadow-xs"
              : "border-slate-200"
          }`}
        >
          {/* Header */}
          <div
            onClick={() => isStep2Completed && setActiveStep(3)}
            className={`p-4 flex items-center justify-between ${
              isStep2Completed ? "cursor-pointer" : "cursor-not-allowed"
            } border-b border-slate-100`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                  !isStep2Completed
                    ? "bg-slate-200 text-slate-400"
                    : isStep3Completed
                    ? "bg-emerald-600 text-white"
                    : activeStep === 3
                    ? "bg-indigo-900 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {!isStep2Completed ? (
                  <i className="fa-solid fa-lock text-[9px]" />
                ) : isStep3Completed ? (
                  "✓"
                ) : (
                  "3"
                )}
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-900 font-brand">
                  3. Payment Breakdown
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {!isStep2Completed
                    ? "Complete previous step to calculate"
                    : `Total Payable: ₹${totalAmountPayable.toFixed(2)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isStep3Completed && (
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Calculated
                </span>
              )}
              <i
                className={`fa-solid fa-chevron-${
                  activeStep === 3 ? "up" : "down"
                } text-xs text-slate-400`}
              />
            </div>
          </div>

          {/* Section Body */}
          {activeStep === 3 && isStep2Completed && (
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                {/* Itemized Calculation */}
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    Ticket Subtotal ({quantity} &times; ₹{seatPrice})
                  </span>
                  <span className="font-bold text-slate-900">
                    ₹{pricing.ticketAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>Convenience Fee</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      (2.70%)
                    </span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    ₹{pricing.convenienceFee.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>GST on Convenience Fee</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      (18%)
                    </span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    ₹{pricing.gstOnConvenienceFee.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Platform Charge</span>
                  <span className="font-semibold text-slate-800">
                    ₹{pricing.platformCharge.toFixed(2)}
                  </span>
                </div>

                {/* Total Payable */}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-900 block font-brand">
                      Total Amount Payable
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold">
                      All fees & GST included &bull; Instant confirmation
                    </span>
                  </div>
                  <span className="text-lg font-black text-emerald-600 font-brand">
                    ₹{totalAmountPayable.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Step 3 Completion Button */}
              <button
                type="button"
                onClick={() => setActiveStep(4)}
                className="w-full bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold text-xs py-3 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <span>Proceed to Confirm & Book</span>
                <i className="fa-solid fa-chevron-right text-[10px]" />
              </button>
            </div>
          )}
        </div>

        {/* ==============================================================
            SECTION 4: CONFIRM & BOOK
        ============================================================== */}
        <div
          className={`bg-white rounded-3xl border transition-all ${
            !isStep3Completed
              ? "border-slate-200 bg-slate-50/60 opacity-60"
              : activeStep === 4
              ? "border-indigo-600 shadow-md ring-2 ring-indigo-500/10"
              : "border-slate-200"
          }`}
        >
          {/* Header */}
          <div
            onClick={() => isStep3Completed && setActiveStep(4)}
            className={`p-4 flex items-center justify-between ${
              isStep3Completed ? "cursor-pointer" : "cursor-not-allowed"
            } border-b border-slate-100`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                  !isStep3Completed
                    ? "bg-slate-200 text-slate-400"
                    : activeStep === 4
                    ? "bg-indigo-900 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {!isStep3Completed ? (
                  <i className="fa-solid fa-lock text-[9px]" />
                ) : (
                  "4"
                )}
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-900 font-brand">
                  4. Confirm & Book
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {!isStep3Completed
                    ? "Complete previous steps to unlock payment"
                    : "Select payment method and finalize ticket booking"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <i
                className={`fa-solid fa-chevron-${
                  activeStep === 4 ? "up" : "down"
                } text-xs text-slate-400`}
              />
            </div>
          </div>

          {/* Section Body */}
          {activeStep === 4 && isStep3Completed && (
            <div className="p-4 space-y-4">
              {/* Payment Methods */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Select Payment Method:
                </p>
                <div className="space-y-2">
                  {[
                    {
                      id: "phonepe",
                      name: "PhonePe UPI",
                      badge: "Fastest",
                      icon: "fa-mobile-screen-button text-purple-600",
                    },
                    {
                      id: "gpay",
                      name: "Google Pay",
                      badge: "UPI",
                      icon: "fa-google-pay text-sky-600",
                    },
                    {
                      id: "paytm",
                      name: "Paytm / UPI",
                      badge: "UPI",
                      icon: "fa-wallet text-blue-600",
                    },
                    {
                      id: "qr",
                      name: "Dynamic UPI QR",
                      badge: "Scan & Pay",
                      icon: "fa-qrcode text-slate-700",
                    },
                  ].map((m) => (
                    <label
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        paymentMethod === m.id
                          ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-sm">
                          <i className={`fa-solid ${m.icon}`} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 leading-tight">
                            {m.name}
                          </p>
                          <span className="text-[9px] font-bold text-slate-400">
                            {m.badge}
                          </span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={paymentMethod === m.id}
                        readOnly
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Safety notice */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 text-[10px] text-slate-500 font-medium">
                <i className="fa-solid fa-shield-halved text-emerald-600 text-xs" />
                <span>
                  100% Secure reservation verified atomically via Supabase & system.
                </span>
              </div>

              {/* Confirm & Book Action Button */}
              <button
                type="button"
                onClick={handleConfirmAndBook}
                disabled={!isStep4Enabled || isSubmitting}
                className="w-full bg-gradient-to-r from-purple-700 via-indigo-800 to-indigo-900 hover:brightness-105 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-sm" />
                    <span>Verifying Seats & Confirming Booking...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-ticket -rotate-12 text-sm" />
                    <span>
                      Confirm & Book &bull; ₹{totalAmountPayable.toFixed(2)}
                    </span>
                    <i className="fa-solid fa-chevron-right text-xs ml-0.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Action Strip (Always visible when activeStep < 4 and seats are selected) */}
      {isStep1Completed && !bookingConfirmed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/90 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Payable ({quantity} Seat{quantity > 1 ? "s" : ""})
              </span>
              <span className="text-base font-black text-emerald-600 font-brand">
                ₹{totalAmountPayable.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => {
                if (activeStep < 4) {
                  setActiveStep((s) => s + 1);
                } else {
                  handleConfirmAndBook();
                }
              }}
              disabled={isSubmitting}
              className="bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs py-3 px-5 rounded-2xl shadow-md flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
            >
              <span>
                {activeStep === 1
                  ? "Continue to Details"
                  : activeStep === 2
                  ? "Continue to Payment"
                  : activeStep === 3
                  ? "Continue to Confirm"
                  : isSubmitting
                  ? "Confirming..."
                  : `Confirm & Book • ₹${totalAmountPayable.toFixed(2)}`}
              </span>
              <i className="fa-solid fa-chevron-right text-[9px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
