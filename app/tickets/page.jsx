"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";
import {
  fetchBookings,
  subscribeBookings,
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

// Split a booking into one ticket per seat so each seat gets its own card,
// QR code and ticket id, ensuring each ticket has its own used/active status.
function expandTickets(list, usedCodesSet = new Set(), ticketEntries = [], eventsMap = {}) {
  const entriesCountByParent = new Map();
  ticketEntries.forEach((e) => {
    const rawNum = String(e.parentTicketNumber || e.ticketNumber || e.ticketId || "").toUpperCase();
    const base = rawNum.replace(/-\d+$/, "");
    if (base) {
      entriesCountByParent.set(base, (entriesCountByParent.get(base) || 0) + 1);
    }
  });

  return list.flatMap((rawB) => {
    const evt = eventsMap[rawB.eventId] || null;
    const effectiveDate = evt?.date || rawB.date;
    const effectiveTime = evt?.time || rawB.time;
    const effectiveEventName = evt?.eventTitle || evt?.name || evt?.title || rawB.eventName;

    const b = {
      ...rawB,
      date: effectiveDate,
      time: effectiveTime,
      eventName: effectiveEventName,
    };

    const seats = Array.isArray(b.seats) ? b.seats.filter(Boolean) : [];
    const count = seats.length || Number(b.quantity) || 1;
    const baseTicketNumber = b.ticketNumber;
    const baseUpper = String(baseTicketNumber || "").toUpperCase();
    const entriesForThisBooking = entriesCountByParent.get(baseUpper) || 0;

    const bUsedTickets = (Array.isArray(b.usedTickets) ? b.usedTickets : []).map((s) => String(s).toUpperCase());
    const bUsedSeats = (Array.isArray(b.usedSeats) ? b.usedSeats : []).map((s) => String(s).toUpperCase());

    let effectiveUsedCount = Number(b.usedCount || 0);
    if (!effectiveUsedCount && (bUsedTickets.length || bUsedSeats.length)) {
      effectiveUsedCount = Math.max(bUsedTickets.length, bUsedSeats.length);
    }
    if (!effectiveUsedCount && entriesForThisBooking > 0) {
      effectiveUsedCount = Math.min(entriesForThisBooking, count);
    }
    if (!effectiveUsedCount && String(b.status || "").toLowerCase() === "used" && entriesForThisBooking === 1) {
      effectiveUsedCount = 1;
    }

    if (count <= 1) {
      const seat = seats[0] || null;
      const derivedStatus = getTicketStatus(b, usedCodesSet, b);
      return [
        {
          ...b,
          seat,
          seatIndex: seat ? 1 : null,
          seatCount: seat ? 1 : null,
          baseTicketNumber,
          derivedStatus,
        },
      ];
    }

    return Array.from({ length: count }, (_, i) => {
      const seat = seats[i] || null;
      const perSeatTicketNumber = `${baseTicketNumber}-${i + 1}`;
      const upperTicketNumber = perSeatTicketNumber.toUpperCase();
      const upperSeat = seat ? String(seat).toUpperCase() : "";

      const item = {
        ...b,
        seat,
        seatIndex: i + 1,
        seatCount: count,
        baseTicketNumber,
        ticketNumber: perSeatTicketNumber,
      };

      let isThisSeatUsed = false;
      if (usedCodesSet.has(upperTicketNumber) || bUsedTickets.includes(upperTicketNumber)) {
        isThisSeatUsed = true;
      } else if (upperSeat && bUsedSeats.includes(upperSeat)) {
        isThisSeatUsed = true;
      } else if (effectiveUsedCount > 0 && i < effectiveUsedCount) {
        isThisSeatUsed = true;
      }

      const rawStatus = String(b.status || "").toLowerCase();
      let derivedStatus = "upcoming";
      if (rawStatus === "cancelled" || rawStatus === "canceled" || rawStatus === "refunded") {
        derivedStatus = "cancelled";
      } else if (isThisSeatUsed) {
        derivedStatus = "used";
      } else if (rawStatus === "expired" || isEventDateExpired(b.date, b.time)) {
        derivedStatus = "expired";
      } else {
        derivedStatus = "upcoming";
      }

      item.derivedStatus = derivedStatus;
      return item;
    });
  });
}

// Unique React key — one booking expands to several per-seat tickets that
// all share the same Firestore doc id (`key`).
function ticketKey(t) {
  return `${t.key || t.id || t.baseTicketNumber || t.ticketNumber}-${t.seatIndex || 0}-${t.seat || "0"}`;
}

export default function TicketsPage() {
  const [tab, setTab] = useState("upcoming");
  const [copied, setCopied] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [ticketEntries, setTicketEntries] = useState([]);
  const [eventsMap, setEventsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubBookings = () => {};
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

  const allTickets = useMemo(() => {
    return expandTickets(bookings, usedCodesSet, ticketEntries, eventsMap);
  }, [bookings, usedCodesSet, ticketEntries, eventsMap]);

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

  const latestBooking = upcomingTickets[0];

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

        <div className="p-4 space-y-3.5 flex-1">
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
            <>
              {latestBooking && (
                <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 space-y-3">
                  <div className="flex gap-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80"
                      alt="Event Banner"
                      className="w-20 h-20 rounded-xl object-cover ring-1 ring-slate-100 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md uppercase">Booking ID</span>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(latestBooking.baseTicketNumber || latestBooking.ticketNumber);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1500);
                            } catch {}
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900"
                        >
                          <span>{copied ? "Copied" : (latestBooking.baseTicketNumber || latestBooking.ticketNumber)}</span>
                          <i className={`${copied ? "fa-solid fa-check text-emerald-600" : "fa-regular fa-copy"} text-xs`} />
                        </button>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 font-brand truncate uppercase tracking-tight">{latestBooking.eventName || "Event Booking"}</h3>
                      <div className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-600">
                        <div className="flex items-center gap-1.5 truncate">
                          <i className="fa-regular fa-calendar text-rose-500 text-[11px]" />
                          <span>{latestBooking.date}</span>
                          <span className="text-slate-300">•</span>
                          <i className="fa-regular fa-clock text-indigo-600 text-[11px]" />
                          <span>{latestBooking.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <i className="fa-solid fa-location-dot text-rose-500 text-[11px]" />
                          <span className="truncate">{latestBooking.assignedGate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50/80 rounded-xl p-2 text-center border border-slate-100">
                    <div>
                      <span className="text-sm font-black text-slate-900 leading-tight block">{upcomingTickets.length}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Tickets</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-purple-900 leading-tight block">{latestBooking.ticketTypeName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Category</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-indigo-900 leading-tight block">{latestBooking.assignedGate}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Entry Gate</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-emerald-600 leading-tight block">₹{latestBooking.amount}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Total Amount</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 max-w-md mx-auto w-full">
                {upcomingTickets.map((ticket, index) => (
                  <Link
                    key={ticketKey(ticket)}
                    href={`/tickets/${ticket.ticketNumber}`}
                    className={`relative rounded-2xl p-3 shadow-md border border-white/20 flex items-center justify-between gap-3 overflow-hidden text-white bg-gradient-to-br ${cardGradients[index % cardGradients.length]} transition-transform active:scale-[0.98]`}
                  >
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-white/10" />
                    <div className="absolute right-14 bottom-1 opacity-20">
                      <i className="fa-solid fa-ticket-simple text-5xl -rotate-12" />
                    </div>

                    <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-white/25 backdrop-blur text-white font-black text-xs flex items-center justify-center flex-shrink-0 ring-1 ring-white/30">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-regular fa-circle-user text-white/80 text-sm" />
                          <h4 className="text-xs font-black text-white truncate drop-shadow">{ticket.eventName || "Ticket Holder"}</h4>
                        </div>
                        <p className="text-[11px] font-bold text-white/80 mt-0.5">
                          {ticket.ticketTypeName} <span className="text-white/40">•</span> {ticket.assignedGate}
                          {ticket.seat ? (
                            <>
                              {" "}<span className="text-white/40">•</span>{" "}
                              <span className="bg-white/25 px-1 rounded">Seat {ticket.seat}</span>
                            </>
                          ) : null}
                        </p>
                        <p className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow">
                          Ticket ID: {ticket.ticketNumber}
                          {ticket.seatCount ? <span className="font-bold text-white/70"> ({ticket.seatIndex}/{ticket.seatCount})</span> : null}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white mt-1 bg-white/20 backdrop-blur px-1.5 py-0.5 rounded-md ring-1 ring-white/30">
                          <i className="fa-solid fa-circle-check text-xs" />
                          <span>ACTIVE <span className="font-semibold text-white/75 text-[9px]">- Ready for entry</span></span>
                        </span>
                      </div>
                    </div>

                    <div className="relative w-16 h-16 p-1 bg-white/90 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ring-2 ring-white/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ticketQrUrl(ticket, 150)} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  </Link>
                ))}
              </div>
            </>
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
          href={`/tickets/${ticket.ticketNumber}`}
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
                  {ticket.eventName || "Ticket Holder"}
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
                Ticket ID: {ticket.ticketNumber}
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
