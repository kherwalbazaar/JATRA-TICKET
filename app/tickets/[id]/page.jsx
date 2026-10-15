"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import {
  fetchBookingByTicketNumber,
  subscribeBookingByTicketNumber,
  subscribeTicketEntries,
  getTicketStatus,
  fetchTicketById,
  subscribeTicketById,
} from "../../../lib/bookings";
import { fetchEvents } from "../../../lib/events";
import { ticketQrUrl } from "../../../lib/ticket-qr";

function formatSeatNumber(seatStr) {
  if (!seatStr) return "";
  const s = String(seatStr).trim();
  const m = s.match(/(?:[A-Za-z0-9]+-)?([A-Za-z]+)-?(\d+)$/);
  if (m) {
    return `${m[1].toUpperCase()}${m[2]}`;
  }
  return s;
}

function formatEntryTime(rawTime, rawTimestamp) {
  if (rawTime && typeof rawTime === "string") {
    const t = rawTime.trim();
    const match = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const meridiem = match[3];
      if (meridiem) {
        return `${h}:${m} ${meridiem.toUpperCase()}`;
      }
      const suffix = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${suffix}`;
    }
    if (t.length > 0 && !/invalid/i.test(t)) return t;
  }
  if (rawTimestamp) {
    const d = new Date(rawTimestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }
  return null;
}

export default function TicketDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [screenshotAlert, setScreenshotAlert] = useState(false);
  const [isScreenProtected, setIsScreenProtected] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubBooking = () => {};
    let unsubEntries = () => {};
    let latestBookingData = null;
    let currentEntriesSet = new Set();
    let currentEntriesMap = new Map();

    // id can be a booking number (NJ26-00001) or a per-seat ticket
    // number (NJ26-00001-2) — resolve base booking number.
    const baseNumber = String(id).replace(/-\d+$/, "");

    let eventsMap = {};

    fetchEvents()
      .then((list) => {
        if (!active || !Array.isArray(list)) return;
        const map = {};
        list.forEach((e) => {
          if (e.key) map[e.key] = e;
          if (e.id) map[e.id] = e;
          if (e.eventId) map[e.eventId] = e;
          if (e.eventTitle) map[e.eventTitle.toLowerCase().trim()] = e;
          if (e.name) map[e.name.toLowerCase().trim()] = e;
          if (e.title) map[e.title.toLowerCase().trim()] = e;
        });
        eventsMap = map;
        updateTicketState();
      })
      .catch(() => {});

    function updateTicketState() {
      if (!active) return;
      const data = latestBookingData;
      if (!data) {
        setTicket(null);
        setLoading(false);
        return;
      }

      const evtKey = (data.eventId || "").trim();
      const evtNameKey = (data.eventName || "").toLowerCase().trim();
      const evt =
        eventsMap[evtKey] ||
        (evtNameKey ? eventsMap[evtNameKey] : null) ||
        (Object.values(eventsMap)[0] || null);

      const effectiveDate = evt?.date || data.date;
      const effectiveTime = evt?.time || data.time;
      const effectiveEventName = evt?.eventTitle || evt?.name || evt?.title || data.eventName;
      const effectivePartyName =
        evt?.partyName ||
        data.partyName ||
        data.party_name ||
        evt?.organizer ||
        "";

      let seat = data.seat || null;
      let seatIndex = data.seatIndex || null;
      let seatCount = data.totalTickets || data.seatCount || 0;

      const seats = Array.isArray(data.seats) ? data.seats.filter(Boolean) : [];
      const m = String(id).match(/^(.+)-(\d+)$/);
      if (m && !seat) {
        const idx = Number(m[2]) - 1;
        if (seats[idx]) {
          seat = seats[idx];
          seatIndex = idx + 1;
          seatCount = seats.length;
        } else {
          seatIndex = idx + 1;
          seatCount = Number(data.quantity) || 1;
        }
      } else if (!seat && seats.length === 1) {
        seat = seats[0];
        seatIndex = 1;
        seatCount = 1;
      } else if (!seat && seats.length > 1) {
        seat = seats[0];
        seatIndex = 1;
        seatCount = seats.length;
      }

      const matchedEntry =
        currentEntriesMap.get(String(id).toUpperCase()) ||
        currentEntriesMap.get(String(data.ticketId || "").toUpperCase()) ||
        currentEntriesMap.get(String(data.ticketNumber || "").toUpperCase()) ||
        currentEntriesMap.get(String(data.bookingId || "").toUpperCase()) ||
        null;

      const effectiveScannedAt =
        matchedEntry?.scanned_at ||
        matchedEntry?.scannedAt ||
        data.scanned_at ||
        data.scannedAt ||
        data.used_at ||
        data.usedAt ||
        null;

      const effectiveScanTime =
        matchedEntry?.scan_time ||
        matchedEntry?.scanTime ||
        data.scan_time ||
        data.scanTime ||
        data.entryTime ||
        "";

      const effectiveScannedBy =
        matchedEntry?.scanned_by ||
        matchedEntry?.scannedBy ||
        data.scanned_by ||
        data.scannedBy ||
        "";

      const itemTicket = {
        ...data,
        date: effectiveDate,
        time: effectiveTime,
        eventName: effectiveEventName,
        partyName: effectivePartyName,
        seat,
        seatIndex,
        seatCount,
        serial: data.serialNumber || String(id),
        ticketId: data.ticketId || String(id),
        ticketNumber: data.ticketId || String(id),
        bookingId: data.bookingId || data.ticketNumber || baseNumber,
        baseTicketNumber: data.bookingId || data.ticketNumber || baseNumber,
        scannedAt: effectiveScannedAt,
        scanned_at: effectiveScannedAt,
        scanTime: effectiveScanTime,
        scan_time: effectiveScanTime,
        scannedBy: effectiveScannedBy,
        scanned_by: effectiveScannedBy,
        usedAt: effectiveScannedAt,
        entryTime: effectiveScanTime,
      };

      const parentBooking = {
        ...data,
        date: effectiveDate,
        time: effectiveTime,
        eventName: effectiveEventName,
        partyName: effectivePartyName,
        scannedAt: effectiveScannedAt,
        usedAt: effectiveScannedAt,
      };

      setTicket({
        ...itemTicket,
        derivedStatus: getTicketStatus(itemTicket, currentEntriesSet, parentBooking),
      });
      setLoading(false);
    }

    try {
      unsubBooking = subscribeTicketById(id, (tData) => {
        if (tData) {
          latestBookingData = tData;
          updateTicketState();
        } else {
          fetchBookingByTicketNumber(baseNumber).then((bData) => {
            latestBookingData = bData;
            updateTicketState();
          });
        }
      });
    } catch (err) {
      console.warn("Ticket subscription failed, fallback to booking:", err);
      unsubBooking = subscribeBookingByTicketNumber(baseNumber, (data) => {
        latestBookingData = data;
        updateTicketState();
      });
    }

    try {
      unsubEntries = subscribeTicketEntries((entries) => {
        const set = new Set();
        const map = new Map();
        entries.forEach((entry) => {
          const status = String(entry.status || entry.entryStatus || "").toLowerCase();
          const result = String(entry.scanResult || "").toUpperCase();
          if (status === "entered" || result === "SUCCESS" || !status) {
            const tNum = String(entry.ticketNumber || entry.ticket_number || "").toUpperCase();
            const tId = String(entry.ticketId || entry.ticket_id || entry.id || "").toUpperCase();
            const bId = String(entry.bookingId || entry.booking_id || "").toUpperCase();
            if (tNum) { set.add(tNum); map.set(tNum, entry); }
            if (tId) { set.add(tId); map.set(tId, entry); }
            if (bId) { set.add(bId); map.set(bId, entry); }
          }
        });
        currentEntriesSet = set;
        currentEntriesMap = map;
        updateTicketState();
      });
    } catch (err) {
      console.warn("Entries subscription failed:", err);
    }

    return () => {
      active = false;
      unsubBooking();
      unsubEntries();
    };
  }, [id]);

  useEffect(() => {
    // 1. Android Capacitor Native FLAG_SECURE
    try {
      if (typeof window !== "undefined" && window.AndroidSecurity?.setScreenshotAllowed) {
        window.AndroidSecurity.setScreenshotAllowed(false);
      }
    } catch {}

    let alertTimer = null;
    const triggerScreenshotAlert = () => {
      setScreenshotAlert(true);
      if (alertTimer) clearTimeout(alertTimer);
      alertTimer = setTimeout(() => {
        setScreenshotAlert(false);
      }, 3500);
    };

    // 2. Prevent right-click / context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerScreenshotAlert();
    };

    // 3. Prevent dragging images / elements
    const handleDragStart = (e) => {
      e.preventDefault();
    };

    // 4. Intercept PrintScreen and screenshot key combinations
    const handleKeyDown = (e) => {
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        setIsScreenProtected(true);
        triggerScreenshotAlert();
        try {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText("Screenshots are restricted on this ticket for security reasons.");
          }
        } catch {}
        setTimeout(() => setIsScreenProtected(false), 2000);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        triggerScreenshotAlert();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        triggerScreenshotAlert();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setIsScreenProtected(true);
        triggerScreenshotAlert();
        setTimeout(() => setIsScreenProtected(false), 2000);
        return;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        try {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText("");
          }
        } catch {}
        setIsScreenProtected(true);
        triggerScreenshotAlert();
        setTimeout(() => setIsScreenProtected(false), 2000);
      }
    };

    // 5. Blur/Protect ticket when window loses focus (app switching, snipping tool, screen recorders)
    const handleBlur = () => {
      setIsScreenProtected(true);
    };

    const handleFocus = () => {
      setIsScreenProtected(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsScreenProtected(true);
      } else {
        setIsScreenProtected(false);
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("dragstart", handleDragStart);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      try {
        if (typeof window !== "undefined" && window.AndroidSecurity?.setScreenshotAllowed) {
          window.AndroidSecurity.setScreenshotAllowed(true);
        }
      } catch {}
      if (alertTimer) clearTimeout(alertTimer);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (loading) {
    return (
      <div className="bg-[#f8faff] min-h-screen flex items-center justify-center">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-[#f8faff] min-h-screen flex flex-col items-center justify-center">
        <i className="fa-solid fa-ticket-slash text-4xl text-slate-300 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Ticket not found</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-indigo-600 font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const status = ticket.derivedStatus || "upcoming";

  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <style>{`
        @media print {
          body, html, main, #__next {
            display: none !important;
            visibility: hidden !important;
          }
        }
        .ticket-secure-screen {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
      `}</style>

      {/* Screen Protection Shield Overlay (App switching / screen capture) */}
      {isScreenProtected && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none text-white">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4">
            <i className="fa-solid fa-camera-slash text-2xl text-rose-400" />
          </div>
          <h3 className="text-lg font-black tracking-wide font-brand uppercase text-rose-400">
            Screenshot Restricted
          </h3>
          <p className="text-xs text-slate-300 mt-2 max-w-xs font-medium leading-relaxed">
            Screenshots and screen recording are disabled on this ticket for security and anti-fraud verification.
          </p>
          <p className="text-[11px] text-slate-500 mt-3 font-semibold">
            Return to app to view your live ticket pass
          </p>
        </div>
      )}

      {/* Floating Warning Toast when screenshot/print is attempted */}
      {screenshotAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-rose-400 flex items-center gap-3">
          <i className="fa-solid fa-ban text-lg text-white flex-shrink-0" />
          <div className="text-xs font-bold leading-tight">
            <span className="block font-black uppercase text-[10px] tracking-wider text-rose-200">
              Security Policy
            </span>
            Screenshots are not allowed on this ticket pass.
          </div>
        </div>
      )}

      <div className="w-full bg-[#f8faff] min-h-screen relative pb-10 shadow-2xl flex flex-col overflow-hidden select-none ticket-secure-screen">
        <Header
          showBack
          showShare
          title="Ticket Details"
          onShare={() =>
            copy(
              `${ticket.eventName || ticket.ticketTypeName} | ${ticket.serial || ticket.ticketNumber} | ${ticket.assignedGate}${ticket.seat ? ` | Seat ${formatSeatNumber(ticket.seat)}` : ""} | ${ticket.date}`,
            )
          }
        />

        {status === "used" ? (
          <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide shadow-inner">
            <i className="fa-solid fa-circle-check text-sm" />
            <span>✓ ENTRY USED • This ticket has already been used</span>
          </div>
        ) : status === "expired" ? (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide shadow-inner">
            <i className="fa-solid fa-clock-rotate-left text-sm" />
            <span>Event Ended • Ticket Expired</span>
          </div>
        ) : status === "cancelled" ? (
          <div className="bg-rose-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide shadow-inner">
            <i className="fa-solid fa-ban text-sm" />
            <span>✕ CANCELLED TICKET • This ticket is not valid for entry</span>
          </div>
        ) : (
          <div className="bg-emerald-500 text-slate-950 px-4 py-2 flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide shadow-inner">
            <i className="fa-solid fa-circle-check text-sm" />
            <span>✓ ACTIVE • Ready for entry • Show at gate</span>
          </div>
        )}

        <main className="p-4 space-y-4">
          <div className="relative bg-white rounded-3xl p-5 border-2 border-indigo-100 shadow-md text-center overflow-hidden">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#f8faff] rounded-full border border-slate-200" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#f8faff] rounded-full border border-slate-200" />

            <div className="mb-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-widest uppercase font-brand block bg-gradient-to-r from-amber-500 via-rose-600 to-indigo-600 bg-clip-text text-transparent">
                GATE PASS
              </h2>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 font-brand mt-1 uppercase tracking-tight">
                {ticket.partyName || ticket.eventName || "EVENT TICKET"}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Entry via {ticket.assignedGate}
                {ticket.seat ? (
                  <>
                    {" "}• <span className="font-black text-indigo-700">Seat {formatSeatNumber(ticket.seat)}</span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="relative inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200 shadow-inner my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ticketQrUrl(ticket, 300)}
                alt="Large QR Ticket"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-60 h-60 object-contain rounded-lg pointer-events-none select-none ${
                  status === "used"
                    ? "grayscale opacity-50"
                    : status === "expired"
                      ? "grayscale opacity-50"
                      : status === "cancelled"
                        ? "grayscale opacity-30"
                        : ""
                }`}
              />
              {status !== "upcoming" && (
                <span
                  className={`absolute inset-0 m-auto w-fit h-fit border-4 ${
                    status === "used"
                      ? "border-red-500 bg-white/95 text-red-600"
                      : status === "expired"
                        ? "border-amber-600 bg-white/95 text-amber-600"
                        : "border-red-600 bg-white/95 text-red-600"
                  } text-2xl font-black px-4 py-1.5 rounded-xl -rotate-12 uppercase shadow-xl tracking-wider select-none`}
                >
                  {status === "used" ? "USED" : status === "expired" ? "EXPIRED" : "CANCELLED"}
                </span>
              )}
            </div>

            <div className="mt-4 bg-slate-100 rounded-xl py-2 px-4 border border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                Serial / Security Number
              </span>
              <p className="text-lg font-mono font-black tracking-widest text-indigo-950 select-all">
                {ticket.ticketId || ticket.serial || ticket.ticketNumber}
              </p>
            </div>

            <div className="mt-4 flex flex-col items-center justify-center gap-1 text-xs font-bold">
              {status === "used" ? (
                <>
                  <div className="flex items-center gap-1.5 text-red-600 font-extrabold">
                    <i className="fa-solid fa-circle-check text-emerald-600" />
                    <span>✓ ENTRY USED — This ticket has already been used</span>
                  </div>
                  {(ticket.scannedAt || ticket.usedAt) && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Scanned at {new Date(ticket.scannedAt || ticket.usedAt).toLocaleString("en-IN")}
                      {ticket.scannedBy ? ` by ${ticket.scannedBy}` : ""}
                    </span>
                  )}
                </>
              ) : status === "expired" ? (
                <div className="flex items-center gap-1.5 text-amber-600 font-extrabold">
                  <i className="fa-solid fa-clock-rotate-left" />
                  <span>Event Ended — Validity Expired</span>
                </div>
              ) : status === "cancelled" ? (
                <div className="flex items-center gap-1.5 text-rose-600 font-extrabold">
                  <i className="fa-solid fa-ban" />
                  <span>Ticket Cancelled</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <i className="fa-solid fa-circle-check" />
                  <span>✓ Valid for single entry</span>
                </div>
              )}
            </div>
          </div>

          {/* Centered Booking ID & Ticket ID */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center justify-center text-center bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 font-black uppercase tracking-wider text-[9px] block">
                BOOKING ID
              </span>
              <span className="font-mono font-black text-slate-900 text-xs sm:text-sm tracking-tight truncate mt-0.5">
                {ticket.bookingId || ticket.baseTicketNumber}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center text-center bg-indigo-50/60 px-3.5 py-2.5 rounded-xl border border-indigo-200 shadow-2xs">
              <span className="text-indigo-600 font-black uppercase tracking-wider text-[9px] block">
                TICKET ID
              </span>
              <span className="font-mono font-black text-indigo-950 text-xs sm:text-sm tracking-tight truncate mt-0.5">
                {ticket.ticketId || ticket.ticketNumber}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs mb-1">
              <i className="fa-solid fa-id-card" />
              <span>Ticket Information</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Event</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[60%] text-right">
                  {ticket.eventName || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Category</span>
                <span className="font-extrabold text-slate-900">{ticket.ticketTypeName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Block</span>
                <span className="font-extrabold text-emerald-700">
                  {ticket.block || ticket.assignedGate}
                </span>
              </div>
              {ticket.seat ? (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Seat</span>
                  <span className="font-extrabold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {formatSeatNumber(ticket.seat)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Gate</span>
                <span className="font-extrabold text-emerald-700">{ticket.assignedGate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Date</span>
                <span className="font-extrabold text-slate-900">{ticket.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">
                  {status === "used" ? "Entry Time" : "Time"}
                </span>
                <span
                  className={`font-extrabold ${
                    status === "used" ? "text-emerald-700" : "text-slate-900"
                  }`}
                >
                  {status === "used"
                    ? formatEntryTime(
                        ticket.scanTime || ticket.entryTime,
                        ticket.scannedAt || ticket.usedAt
                      ) || ticket.time
                    : ticket.time}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 flex items-start gap-2.5">
            <i className="fa-solid fa-shield-halved text-rose-500 text-base mt-0.5" />
            <div className="text-xs">
              <p className="font-black text-rose-950 flex items-center gap-1.5">
                <span>Security Notice</span>
                <span className="bg-rose-200 text-rose-800 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
                  No Screenshots
                </span>
              </p>
              <p className="text-rose-800 font-medium text-[11px] mt-0.5 leading-snug">
                Screenshots are not allowed on this ticket pass.
                <br />
                Please present this live ticket directly at the entry gate.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ticket Status Guide</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { id: "ACTIVE", label: "ACTIVE", labelClass: "text-emerald-600", desc: "Ready for Entry", boxBorder: "border-emerald-400", badge: null },
                { id: "USED", label: "USED", labelClass: "text-emerald-700", desc: "Entry Completed", boxBorder: "border-slate-300", badge: "border-emerald-600 text-emerald-700" },
                { id: "EXPIRED", label: "EXPIRED", labelClass: "text-amber-600", desc: "Event Ended", boxBorder: "border-amber-300", badge: "border-amber-600 text-amber-600" },
                { id: "CANCELLED", label: "CANCELLED", labelClass: "text-red-600", desc: "Cancelled", boxBorder: "border-red-300", badge: "border-red-600 text-red-600 text-[7px] px-0.5" },
              ].map((s) => (
                <div key={s.id} className="flex flex-col items-center">
                  <div
                    className={`relative w-12 h-12 p-1 bg-white border ${s.boxBorder} rounded-lg flex items-center justify-center mb-1 ${
                      s.badge ? "opacity-70" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${s.id}`}
                      alt={s.label}
                      className={`w-full h-full object-contain ${s.badge ? "grayscale" : ""}`}
                    />
                    {s.badge && (
                      <span className={`absolute inset-0 m-auto w-fit h-fit border-2 bg-white/95 ${s.badge} font-black px-1 rounded -rotate-12 uppercase`}>
                        {s.label}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-black uppercase ${s.labelClass}`}>{s.label}</span>
                  <span className="text-[9px] text-slate-500 font-medium leading-tight">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
