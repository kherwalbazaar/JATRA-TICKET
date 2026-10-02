"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import {
  fetchBookings,
  subscribeBookings,
  subscribeAllTickets,
  subscribeTicketEntries,
  getTicketStatus,
  isEventDateExpired,
} from "../../lib/bookings";
import { subscribeEvents } from "../../lib/events";
import { ticketQrUrl } from "../../lib/ticket-qr";

const cardGradients = [
  "bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500",
  "bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-700",
  "bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600",
  "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
  "bg-gradient-to-br from-lime-500 via-emerald-500 to-teal-600",
  "bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600",
];

function buildBookingTicketGroups(bookings, storedTickets = [], usedCodesSet = new Set(), ticketEntries = [], eventsMap = {}) {
  const ticketsByBookingId = new Map();
  storedTickets.forEach((t) => {
    const bId = String(t.bookingId || t.baseTicketNumber || "").toUpperCase();
    if (bId) {
      if (!ticketsByBookingId.has(bId)) {
        ticketsByBookingId.set(bId, []);
      }
      ticketsByBookingId.get(bId).push(t);
    }
  });

  return bookings.map((rawB) => {
    const evt = eventsMap[rawB.eventId] || null;
    const effectiveDate = evt?.date || rawB.date;
    const effectiveTime = evt?.time || rawB.time;
    const effectiveEventName = evt?.eventTitle || evt?.name || evt?.title || rawB.eventName;

    const b = {
      ...rawB,
      bookingId: rawB.bookingId || rawB.ticketNumber,
      date: effectiveDate,
      time: effectiveTime,
      eventName: effectiveEventName,
    };

    const bIdUpper = String(b.bookingId || "").toUpperCase();
    let ticketsForBooking = ticketsByBookingId.get(bIdUpper) || [];

    // If no records in tickets collection (legacy booking), synthesize them:
    if (ticketsForBooking.length === 0) {
      const seats = Array.isArray(b.seats) ? b.seats.filter(Boolean) : [];
      const count = seats.length || Number(b.quantity) || 1;
      const bUsedTickets = (Array.isArray(b.usedTickets) ? b.usedTickets : []).map((s) => String(s).toUpperCase());
      const bUsedSeats = (Array.isArray(b.usedSeats) ? b.usedSeats : []).map((s) => String(s).toUpperCase());
      const effectiveUsedCount = Number(b.usedCount || 0);

      ticketsForBooking = Array.from({ length: count }, (_, i) => {
        const seat = seats[i] || null;
        const ticketId = count === 1 ? b.ticketNumber : `${b.ticketNumber}-${i + 1}`;
        const upperTicketId = ticketId.toUpperCase();
        const upperSeat = seat ? String(seat).toUpperCase() : "";

        let isUsed = false;
        if (usedCodesSet.has(upperTicketId) || bUsedTickets.includes(upperTicketId)) {
          isUsed = true;
        } else if (upperSeat && bUsedSeats.includes(upperSeat)) {
          isUsed = true;
        } else if (effectiveUsedCount > 0 && i < effectiveUsedCount) {
          isUsed = true;
        } else if (count === 1 && (b.status === "Checked-in" || b.status === "Used")) {
          isUsed = true;
        }

        let status = "ACTIVE";
        if (b.status === "Cancelled" || b.status === "Refunded") {
          status = "CANCELLED";
        } else if (isUsed) {
          status = "ENTERED";
        }

        return {
          ...b,
          ticketId,
          ticketNumber: ticketId,
          seat,
          seatIndex: i + 1,
          seatCount: count,
          ticketIndex: i + 1,
          totalTickets: count,
          serialNumber: ticketId,
          qrToken: ticketId,
          status,
          derivedStatus: isUsed ? "used" : status === "CANCELLED" ? "cancelled" : isEventDateExpired(b.date, b.time) ? "expired" : "upcoming",
        };
      });
    } else {
      // Map stored tickets
      ticketsForBooking = ticketsForBooking.map((t, idx) => {
        const derived = getTicketStatus(t, usedCodesSet, b);
        return {
          ...t,
          ticketNumber: t.ticketId,
          seatIndex: t.ticketIndex || idx + 1,
          seatCount: ticketsForBooking.length,
          derivedStatus: derived,
        };
      });
    }

    // Sort tickets by sequence
    ticketsForBooking.sort((a, b) => (a.seatIndex || a.ticketIndex || 0) - (b.seatIndex || b.ticketIndex || 0));

    const enteredCount = ticketsForBooking.filter((t) => t.derivedStatus === "used" || t.status === "ENTERED").length;
    const totalCount = ticketsForBooking.length;
    const remainingCount = Math.max(0, totalCount - enteredCount);

    return {
      booking: b,
      tickets: ticketsForBooking,
      totalCount,
      enteredCount,
      remainingCount,
      allEntered: enteredCount === totalCount && totalCount > 0,
    };
  });
}

// Unique React key — one booking expands to several per-seat tickets that
// all share the same Firestore doc id (`key`).
function ticketKey(t) {
  return `${t.key || t.id || t.baseTicketNumber || t.ticketNumber}-${t.ticketIndex || t.seatIndex || 0}-${t.seat || "0"}`;
}

export default function TicketsPage() {
  const [tab, setTab] = useState("upcoming");
  const [copied, setCopied] = useState("");
  const [bookings, setBookings] = useState([]);
  const [storedTickets, setStoredTickets] = useState([]);
  const [ticketEntries, setTicketEntries] = useState([]);
  const [eventsMap, setEventsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubBookings = () => {};
    let unsubTickets = () => {};
    let unsubEntries = () => {};
    let unsubEvents = () => {};

    try {
      unsubBookings = subscribeBookings((data) => {
        setBookings(data || []);
        setLoading(false);
      });
    } catch (err) {
      console.error("Failed to subscribe to bookings:", err);
      fetchBookings()
        .then((data) => setBookings(data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    try {
      unsubTickets = subscribeAllTickets((tList) => {
        setStoredTickets(tList || []);
      });
    } catch (err) {
      console.warn("Failed to subscribe to tickets:", err);
    }

    try {
      unsubEntries = subscribeTicketEntries((entries) => {
        setTicketEntries(entries || []);
      });
    } catch (err) {
      console.warn("Failed to subscribe to ticketEntries:", err);
    }

    try {
      unsubEvents = subscribeEvents((list) => {
        const map = {};
        (list || []).forEach((e) => {
          if (e.key) map[e.key] = e;
          if (e.id) map[e.id] = e;
        });
        setEventsMap(map);
      });
    } catch (err) {
      console.warn("Failed to subscribe to events in TicketsPage:", err);
    }

    return () => {
      unsubBookings();
      unsubTickets();
      unsubEntries();
      unsubEvents();
    };
  }, []);

  const usedCodesSet = useMemo(() => {
    const set = new Set();
    ticketEntries.forEach((entry) => {
      const status = String(entry.status || entry.entryStatus || "").toLowerCase();
      const result = String(entry.scanResult || "").toUpperCase();
      if (status === "entered" || result === "SUCCESS" || !status) {
        if (entry.ticketNumber) set.add(String(entry.ticketNumber).toUpperCase());
        if (entry.ticketId) set.add(String(entry.ticketId).toUpperCase());
        if (entry.bookingId) set.add(String(entry.bookingId).toUpperCase());
      }
    });
    return set;
  }, [ticketEntries]);

  const bookingGroups = useMemo(() => {
    return buildBookingTicketGroups(bookings, storedTickets, usedCodesSet, ticketEntries, eventsMap);
  }, [bookings, storedTickets, usedCodesSet, ticketEntries, eventsMap]);

  const allTickets = useMemo(() => {
    return bookingGroups.flatMap((g) => g.tickets);
  }, [bookingGroups]);

  const upcomingTickets = useMemo(
    () => allTickets.filter((b) => b.derivedStatus === "upcoming"),
    [allTickets],
  );
  const usedTickets = useMemo(
    () => allTickets.filter((b) => b.derivedStatus === "used"),
    [allTickets],
  );
  const expiredTickets = useMemo(
    () => allTickets.filter((b) => b.derivedStatus === "expired"),
    [allTickets],
  );
  const cancelledTickets = useMemo(
    () => allTickets.filter((b) => b.derivedStatus === "cancelled"),
    [allTickets],
  );

  const STATUS_TAB = [
    { key: "upcoming", label: "Upcoming", count: upcomingTickets.length },
    { key: "used", label: "Used", count: usedTickets.length },
    { key: "expired", label: "Expired", count: expiredTickets.length },
    { key: "cancelled", label: "Cancelled", count: cancelledTickets.length },
  ];

  const currentList =
    tab === "upcoming"
      ? upcomingTickets
      : tab === "used"
        ? usedTickets
        : tab === "expired"
          ? expiredTickets
          : cancelledTickets;

  const activeBookingGroups = useMemo(() => {
    return bookingGroups.filter((g) => g.tickets.some((t) => t.derivedStatus === "upcoming"));
  }, [bookingGroups]);

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id || text);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <div className="bg-[#f8faff] min-h-screen relative pb-24 shadow-2xl flex flex-col overflow-hidden">
        <Header />

        <div className="p-4 pb-0 space-y-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-brand">My Tickets</h2>
            <p className="text-xs text-slate-500 font-medium">View and manage all your tickets</p>
          </div>

          <div className="flex items-center bg-slate-200/70 p-1 rounded-2xl text-xs font-bold gap-1">
            {STATUS_TAB.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 px-1 rounded-xl transition-all text-center whitespace-nowrap text-[11px] sm:text-xs ${
                  tab === t.key
                    ? "bg-[#12193b] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}{" "}
                <span className={tab === t.key ? "text-amber-400 text-[10px]" : "text-[10px] opacity-70"}>
                  ({t.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4 flex-1">
          {loading ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">Loading tickets...</p>
            </div>
          ) : currentList.length === 0 ? (
            tab === "upcoming" && usedTickets.length > 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-md mx-auto">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
                  <i className="fa-solid fa-circle-check" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-brand">No Upcoming Tickets</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
                  All your booked tickets have already been scanned / checked in.
                </p>
                <button
                  onClick={() => setTab("used")}
                  className="bg-[#12193b] hover:bg-[#1a2350] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-ticket" />
                  <span>
                    View {usedTickets.length} Used Ticket{usedTickets.length > 1 ? "s" : ""}
                  </span>
                </button>
              </div>
            ) : tab === "expired" && usedTickets.length > 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-md mx-auto">
                <i className="fa-regular fa-calendar-check text-4xl text-slate-300 mb-3" />
                <h3 className="text-base font-black text-slate-900 font-brand">No Expired Tickets</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
                  Looking for your scanned event tickets?
                </p>
                <button
                  onClick={() => setTab("used")}
                  className="bg-[#12193b] hover:bg-[#1a2350] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-ticket" />
                  <span>
                    View {usedTickets.length} Used Ticket{usedTickets.length > 1 ? "s" : ""}
                  </span>
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fa-solid fa-ticket text-4xl text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium">No {tab} tickets</p>
              </div>
            )
          ) : tab === "upcoming" ? (
            <div className="space-y-6 max-w-md mx-auto w-full">
              {activeBookingGroups.map((group) => {
                const b = group.booking;
                const bookingId = b.bookingId || b.ticketNumber;
                return (
                  <div
                    key={bookingId}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-3.5"
                  >
                    {/* Booking Summary Card */}
                    <div className="bg-[#12193b] text-white rounded-2xl p-4 shadow-md space-y-3 relative overflow-hidden">
                      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-md">
                              Booking ID
                            </span>
                            <button
                              onClick={() => copyToClipboard(bookingId, bookingId)}
                              className="flex items-center gap-1 text-xs font-bold text-slate-200 hover:text-white"
                              title="Copy Booking ID"
                            >
                              <span className="font-mono">{copied === bookingId ? "Copied!" : bookingId}</span>
                              <i
                                className={`${
                                  copied === bookingId ? "fa-solid fa-check text-emerald-400" : "fa-regular fa-copy"
                                } text-xs`}
                              />
                            </button>
                          </div>
                          <h3 className="text-sm font-black text-white font-brand uppercase tracking-tight truncate">
                            {b.eventName || "Jatra Event"}
                          </h3>
                          <p className="text-xs text-slate-300 font-semibold mt-0.5 truncate">
                            {b.customerName || b.attendeeName || "Customer"}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-base font-black text-emerald-400 block">₹{b.amount}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Total Amount</span>
                        </div>
                      </div>

                      {/* Booking Metadata Grid */}
                      <div className="grid grid-cols-3 divide-x divide-white/10 bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
                        <div>
                          <span className="text-sm font-black text-white block">
                            {group.totalCount} {group.totalCount === 1 ? "Ticket" : "Tickets"}
                          </span>
                          <span className="text-[10px] text-slate-300 font-medium">Quantity</span>
                        </div>
                        <div>
                          <span className="text-sm font-black text-amber-300 block truncate px-1">
                            {b.ticketTypeName || "SEATED"}
                            {b.block ? ` • ${b.block}` : ""}
                          </span>
                          <span className="text-[10px] text-slate-300 font-medium">Block / Cat</span>
                        </div>
                        <div>
                          <span className="text-sm font-black text-indigo-200 block truncate px-1">
                            {b.assignedGate || "Gate 1"}
                          </span>
                          <span className="text-[10px] text-slate-300 font-medium">Entry Gate</span>
                        </div>
                      </div>

                      {/* Entry Status Progress */}
                      <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <div className="flex items-center gap-1.5 text-slate-300 text-[11px] uppercase tracking-wider">
                            <i className="fa-solid fa-door-open text-xs text-amber-400" />
                            <span>Entry Status</span>
                          </div>
                          <div>
                            {group.allEntered ? (
                              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                                <i className="fa-solid fa-circle-check" />
                                <span>✓ ALL TICKETS ENTERED</span>
                              </span>
                            ) : (
                              <span className="text-white font-extrabold">
                                {group.enteredCount} / {group.totalCount} TICKETS ENTERED
                                <span className="text-slate-300 font-normal ml-1.5 text-[11px]">
                                  • Remaining: <strong className="text-amber-300">{group.remainingCount}</strong>
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              group.allEntered ? "bg-emerald-400" : "bg-gradient-to-r from-amber-400 to-rose-400"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((group.enteredCount / Math.max(1, group.totalCount)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Individual Tickets inside this Booking */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                          Individual Tickets ({group.tickets.length})
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Click ticket for entry QR pass</span>
                      </div>

                      {group.tickets.map((ticket, ticketIdx) => {
                        const isEntered = ticket.derivedStatus === "used" || ticket.status === "ENTERED";
                        const isCancelled = ticket.derivedStatus === "cancelled" || ticket.status === "CANCELLED";

                        return (
                          <Link
                            key={ticketKey(ticket)}
                            href={`/tickets/${ticket.ticketId || ticket.ticketNumber}`}
                            className={`relative rounded-2xl p-3 shadow-sm border flex items-center justify-between gap-3 overflow-hidden transition-all active:scale-[0.98] ${
                              isEntered
                                ? "bg-slate-100 border-slate-200 text-slate-700"
                                : isCancelled
                                  ? "bg-slate-800 text-white border-slate-700 opacity-75"
                                  : `text-white bg-gradient-to-br ${
                                      cardGradients[ticketIdx % cardGradients.length]
                                    } border-white/20 shadow-md`
                            }`}
                          >
                            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                            <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

                            <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center flex-shrink-0 ring-1 ${
                                  isEntered
                                    ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                                    : isCancelled
                                      ? "bg-slate-700 text-slate-300 ring-slate-600"
                                      : "bg-white/25 backdrop-blur text-white ring-white/30"
                                }`}
                              >
                                {ticket.ticketIndex || ticket.seatIndex || ticketIdx + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <i
                                    className={`fa-regular fa-circle-user text-sm ${
                                      isEntered ? "text-slate-500" : "text-white/80"
                                    }`}
                                  />
                                  <h4
                                    className={`text-xs font-black truncate drop-shadow-xs ${
                                      isEntered ? "text-slate-800" : "text-white"
                                    }`}
                                  >
                                    {ticket.customerName || ticket.eventName || "Ticket Holder"}
                                  </h4>
                                </div>

                                <p
                                  className={`text-[11px] font-bold mt-0.5 ${
                                    isEntered ? "text-slate-600" : "text-white/90"
                                  }`}
                                >
                                  {ticket.ticketTypeName || "SEATED"}
                                  {ticket.block ? ` • ${ticket.block}` : ""}
                                  {ticket.seat ? (
                                    <>
                                      {" "}•{" "}
                                      <span
                                        className={
                                          isEntered
                                            ? "bg-slate-200 px-1 rounded text-slate-800"
                                            : "bg-white/25 px-1 rounded text-white"
                                        }
                                      >
                                        Seat {ticket.seat}
                                      </span>
                                    </>
                                  ) : null}
                                </p>

                                <p
                                  className={`text-[11px] font-extrabold mt-0.5 ${
                                    isEntered ? "text-slate-700" : "text-white"
                                  }`}
                                >
                                  Ticket ID: {ticket.ticketId || ticket.ticketNumber}
                                </p>

                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  {isEntered ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                      <i className="fa-solid fa-circle-check text-emerald-600" />
                                      <span>
                                        ✓ ENTERED{" "}
                                        {ticket.scannedAt || ticket.usedAt
                                          ? `• ${
                                              ticket.scanTime ||
                                              new Date(ticket.scannedAt || ticket.usedAt).toLocaleTimeString("en-IN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: true,
                                              })
                                            }`
                                          : ""}
                                      </span>
                                    </span>
                                  ) : isCancelled ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-300 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded-md">
                                      <i className="fa-solid fa-ban text-red-400" />
                                      <span>✕ CANCELLED</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-white/20 backdrop-blur px-2 py-0.5 rounded-md ring-1 ring-white/30">
                                      <i className="fa-solid fa-circle-check text-emerald-300 text-xs" />
                                      <span>
                                        ✓ ACTIVE{" "}
                                        <span className="font-semibold text-white/75 text-[9px]">
                                          • Ready for entry
                                        </span>
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="relative w-16 h-16 p-1 bg-white/95 rounded-xl shadow-md flex-shrink-0 flex items-center justify-center ring-2 ring-white/40">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={ticketQrUrl(ticket, 150)}
                                alt="QR Code"
                                className={`w-full h-full object-contain ${
                                  isEntered ? "grayscale opacity-50" : isCancelled ? "grayscale opacity-40" : ""
                                }`}
                              />
                              {isEntered && (
                                <span className="absolute inset-0 m-auto w-fit h-fit border-2 border-emerald-600 bg-white/95 text-emerald-700 text-[8px] font-black px-1 rounded -rotate-12 uppercase select-none">
                                  ENTERED
                                </span>
                              )}
                              {isCancelled && (
                                <span className="absolute inset-0 m-auto w-fit h-fit border-2 border-red-600 bg-white/95 text-red-600 text-[8px] font-black px-1 rounded -rotate-12 uppercase select-none">
                                  CANCELLED
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <TicketStatusList list={currentList} tab={tab} />
          )}
        </div>

        <BottomNav active="tickets" />
      </div>
    </div>
  );
}

function TicketStatusList({ list, tab }) {
  const statusConfig = {
    used: {
      label: "USED",
      textClass: "text-emerald-700",
      badge: "border-red-500 bg-white/95 text-red-500",
      pill: "text-red-600 bg-red-50 ring-red-200",
      icon: "fa-solid fa-circle-check",
      note: "Entry Completed — Ticket has been scanned",
      gradient: "bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200",
    },
    expired: {
      label: "EXPIRED",
      textClass: "text-amber-700",
      badge: "border-amber-600 bg-white/95 text-amber-600",
      pill: "text-amber-700 bg-amber-50 ring-amber-200",
      icon: "fa-solid fa-clock-rotate-left",
      note: "Event Ended — Ticket validity has expired",
      gradient: "bg-gradient-to-br from-slate-200 via-amber-50/50 to-slate-200",
    },
    cancelled: {
      label: "CANCELLED",
      textClass: "text-white",
      badge: "border-red-600 bg-white/95 text-red-600",
      pill: "text-red-600 bg-red-50 ring-red-200",
      icon: "fa-solid fa-ban",
      note: "This ticket has been cancelled",
      gradient: "bg-gradient-to-br from-slate-600 to-slate-800",
    },
  }[tab] || {
    label: "USED",
    textClass: "text-slate-700",
    badge: "border-slate-500 bg-white/95 text-slate-600",
    pill: "text-slate-600 bg-slate-100 ring-slate-200",
    icon: "fa-solid fa-ticket",
    note: "",
    gradient: "bg-gradient-to-br from-slate-200 to-slate-300",
  };

  return (
    <div className="space-y-2.5 max-w-md mx-auto w-full">
      {list.map((ticket) => (
        <Link
          key={ticketKey(ticket)}
          href={`/tickets/${ticket.ticketId || ticket.ticketNumber}`}
          className={`relative rounded-2xl p-3 shadow-md border border-white/20 flex items-center justify-between gap-3 overflow-hidden text-slate-800 bg-gradient-to-br ${statusConfig.gradient} ${tab === "cancelled" ? "opacity-90 text-white" : ""} transition-transform active:scale-[0.98] block`}
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

          <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
            <span
              className={`w-6 h-6 rounded-full bg-white/50 backdrop-blur ${
                tab === "cancelled" ? "text-white" : "text-slate-600"
              } font-black text-xs flex items-center justify-center flex-shrink-0 ring-1 ring-white/30`}
            >
              <i className="fa-solid fa-user text-[10px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <i
                  className={`fa-regular fa-circle-user ${
                    tab === "cancelled" ? "text-white/80" : "text-slate-500"
                  } text-sm`}
                />
                <h4
                  className={`text-xs font-black ${
                    tab === "cancelled" ? "text-white" : "text-slate-800"
                  } truncate drop-shadow-xs`}
                >
                  {ticket.customerName || ticket.eventName || "Ticket Holder"}
                </h4>
              </div>
              <p
                className={`text-[11px] font-bold ${
                  tab === "cancelled" ? "text-white/80" : "text-slate-600"
                } mt-0.5`}
              >
                {ticket.ticketTypeName}{" "}
                <span className={tab === "cancelled" ? "text-white/40" : "text-slate-300"}>•</span>{" "}
                {ticket.assignedGate}
                {ticket.seat ? (
                  <>
                    {" "}
                    <span className={tab === "cancelled" ? "text-white/40" : "text-slate-300"}>•</span>{" "}
                    <span
                      className={
                        tab === "cancelled"
                          ? "bg-white/20 text-white px-1 rounded"
                          : "bg-slate-200/70 text-slate-800 px-1 rounded"
                      }
                    >
                      Seat {ticket.seat}
                    </span>
                  </>
                ) : null}{" "}
                <span className={tab === "cancelled" ? "text-white/40" : "text-slate-300"}>•</span> {ticket.date}
              </p>
              <p
                className={`text-[11px] font-extrabold ${
                  tab === "cancelled" ? "text-white" : "text-slate-700"
                } mt-0.5 drop-shadow-xs`}
              >
                Ticket ID: {ticket.ticketId || ticket.ticketNumber}
                {ticket.seatCount ? (
                  <span
                    className={
                      tab === "cancelled"
                        ? "font-bold text-white/70"
                        : "font-bold text-slate-500"
                    }
                  >
                    {" "}
                    ({ticket.seatIndex}/{ticket.seatCount})
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 ${statusConfig.pill}`}
                >
                  <i className={`${statusConfig.icon} text-xs`} />
                  <span>{statusConfig.label}</span>
                </span>
                {ticket.usedAt && (
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Scanned {new Date(ticket.usedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            className={`relative w-16 h-16 p-1 bg-white/90 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ring-2 ${
              tab === "cancelled" ? "ring-white/40" : "ring-slate-300"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ticketQrUrl(ticket, 150)}
              alt="QR Code"
              className={`w-full h-full object-contain ${
                tab === "cancelled" ? "grayscale opacity-50" : tab === "used" ? "grayscale opacity-60" : "grayscale opacity-75"
              }`}
            />
            <span
              className={`absolute inset-0 m-auto w-fit h-fit border-2 ${statusConfig.badge} text-[8px] font-black px-1 rounded -rotate-12 uppercase select-none`}
            >
              {statusConfig.label}
            </span>
          </div>
        </Link>
      ))}
      <p className="text-center text-[11px] text-slate-400 font-medium pt-1">
        {statusConfig.note}
      </p>
    </div>
  );
}
