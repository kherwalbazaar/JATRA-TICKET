"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { fetchReservationStatus, PAYMENT_EXPIRED_MESSAGE } from "../../lib/reservation";

const STATUS_POLL_MS = 4000;

/**
 * Payment popup with a real UPI QR and a countdown whose clock lives on the
 * server. Closing the tab or restarting the app re-reads the same deadline.
 */
export default function PaymentQrModal({
  isOpen,
  eventId,
  block = "",
  seats = [],
  seatPrice = 0,
  reservationId = "",
  sessionId = "",
  amount = 0,
  eventName = "Jatra Show",
  initialRemainingMs = 60000,
  externalNotice = "",
  onVerified,
  onExpired,
  onRequestClose,
  isSubmitting = false,
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [upiUri, setUpiUri] = useState("");
  const [payee, setPayee] = useState({ name: "", vpa: "" });
  const [reference, setReference] = useState("");
  const [payableAmount, setPayableAmount] = useState(Number(amount) || 0);
  const [configError, setConfigError] = useState("");
  const [loadingQr, setLoadingQr] = useState(true);
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState("");
  const deadlineRef = useRef(Date.now() + initialRemainingMs);
  const expiredRef = useRef(false);
  const seatKey = useMemo(() => seats.join(","), [seats]);

  // Re-arm the local view of the server deadline whenever a new reservation opens
  useEffect(() => {
    if (!isOpen) return;
    expiredRef.current = false;
    deadlineRef.current = Date.now() + initialRemainingMs;
    setRemainingMs(initialRemainingMs);
    setNotice("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reservationId]);

  // 1. Ask the server for the payable intent (amount + reference are server side)
  useEffect(() => {
    if (!isOpen || !eventId || seats.length === 0) return;
    let cancelled = false;
    setLoadingQr(true);
    setConfigError("");
    setQrDataUrl("");

    fetch("/api/payment/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, block, seats, seatPrice, reservationId }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) {
          setConfigError(
            data?.message ||
              "A payable QR is not available on this server yet. Ask the administrator to configure the payment gateway."
          );
          return;
        }
        setUpiUri(data.upiUri);
        setPayee({ name: data.payeeName || "JATRA BAZAAR", vpa: data.payeeVpa || "" });
        setReference(data.transactionRef || "");
        if (Number(data.amount) > 0) setPayableAmount(Number(data.amount));
        if (data.expiresAt) {
          const until = Date.parse(data.expiresAt);
          if (until) {
            deadlineRef.current = until;
            setRemainingMs(Math.max(0, until - Date.now()));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setConfigError("Could not reach the payment server. Check your connection.");
      })
      .finally(() => {
        if (!cancelled) setLoadingQr(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId, block, reservationId, seatKey, seatPrice]);

  // 2. Render the QR from the server-provided UPI intent
  useEffect(() => {
    if (!upiUri) return;
    let cancelled = false;
    QRCode.toDataURL(upiUri, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setConfigError("The QR image could not be rendered on this device.");
      });
    return () => {
      cancelled = true;
    };
  }, [upiUri]);

  const fireExpired = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    deadlineRef.current = Date.now();
    setRemainingMs(0);
    setNotice(PAYMENT_EXPIRED_MESSAGE);
    onExpired?.();
  }, [onExpired]);

  // 3. Countdown, periodically re-synchronised with the authoritative server clock
  useEffect(() => {
    if (!isOpen || !reservationId) return;

    const tick = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(left);
      if (left <= 0) fireExpired();
    }, 500);

    const sync = async () => {
      const res = await fetchReservationStatus({
        eventId,
        reservationId,
        sessionId,
        seats: seatKey,
      });
      if (!res?.ok) return;
      if (res.status === "active") {
        const until = Date.parse(res.expiresAt || "") || 0;
        if (until) {
          deadlineRef.current = until;
          setRemainingMs(Math.max(0, until - Date.now()));
        }
      } else if (res.status === "expired" || res.status === "released") {
        fireExpired();
      }
    };

    sync().catch(() => {});
    const poll = setInterval(() => sync().catch(() => {}), STATUS_POLL_MS);

    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [isOpen, reservationId, eventId, sessionId, seatKey, fireExpired]);

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const expired = secondsLeft <= 0;
  const progress = useMemo(() => {
    const total = Math.max(1, initialRemainingMs);
    return Math.max(0, Math.min(100, (remainingMs / total) * 100));
  }, [remainingMs, initialRemainingMs]);

  const handleVerify = useCallback(async () => {
    if (expired || verifying) return;
    setVerifying(true);
    setNotice("");
    try {
      const res = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId, paymentRef: reference, amount: payableAmount }),
      });
      const data = await res.json().catch(() => null);
      if (data?.verified) {
        await onVerified?.({ paymentRef: reference, transactionId: data.transactionId });
      } else if (data?.pending) {
        setNotice(
          data.message ||
            "Your payment is still being confirmed by the bank. Keep this popup open and try again in a few seconds."
        );
      } else {
        setNotice(
          data?.message ||
            "We could not confirm the payment yet. Your seats stay reserved until the timer runs out."
        );
      }
    } catch (e) {
      setNotice("Verification needs the internet. Reconnect and try again.");
    } finally {
      setVerifying(false);
    }
  }, [expired, verifying, reservationId, reference, payableAmount, onVerified]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans text-slate-800 antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#12193b] via-indigo-950 to-[#12193b] p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center text-amber-400 text-sm">
                <i className="fa-solid fa-mobile-screen-button" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-tight uppercase text-slate-200">
                  Scan &amp; Pay
                </h3>
                <p className="text-[10px] font-bold text-slate-400 truncate max-w-[190px]">
                  {eventName} {block ? `• Block ${block}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRequestClose}
              aria-label="Close payment popup"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Amount + countdown */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Payable now</p>
              <p className="text-2xl font-black text-emerald-400 leading-tight">
                ₹{Number(payableAmount || 0).toFixed(2)}
              </p>
            </div>
            <div
              className={`text-center rounded-2xl px-3.5 py-2 border ${
                expired || secondsLeft <= 15
                  ? "bg-rose-500/15 border-rose-400/40"
                  : "bg-amber-400/10 border-amber-400/30"
              } ${!expired && secondsLeft <= 15 ? "animate-pulse" : ""}`}
            >
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-300">
                Seats held for
              </p>
              <p
                className={`text-lg font-black tabular-nums ${
                  expired || secondsLeft <= 15 ? "text-rose-300" : "text-amber-300"
                }`}
              >
                {`00:${String(Math.max(0, secondsLeft)).padStart(2, "0")}`}
              </p>
            </div>
          </div>

          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                secondsLeft <= 15 ? "bg-rose-400" : "bg-amber-400"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loadingQr ? (
            <div className="py-12 flex flex-col items-center gap-3 text-slate-500">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs font-bold">Preparing your payment QR…</p>
            </div>
          ) : configError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-xs font-black text-amber-900">Payment QR unavailable</p>
                <p className="text-[11px] text-amber-800 leading-snug font-medium">{configError}</p>
                <p className="text-[11px] text-amber-800 leading-snug font-medium">
                  Your seats stay held while the timer runs. You can also pay at the entry counter.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="UPI payment QR code"
                      className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                      QR
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-500">
                  {payee.name} • {payee.vpa}
                </p>
              </div>

              <ol className="space-y-2 text-[11px] text-slate-600 font-medium">
                {[
                  "Open any UPI app (Google Pay, PhonePe, Paytm, BHIM).",
                  "Scan this QR — the amount and payee are already filled in.",
                  "Complete the payment and keep the reference number.",
                  "Tap verify below. Seats release only when the timer ends.",
                ].map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 shrink-0 rounded-full bg-indigo-900 text-white text-[9px] font-black flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">
                  Booking reference
                </p>
                <input
                  value={reference}
                  onChange={(e) =>
                    setReference(e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 35))
                  }
                  inputMode="text"
                  aria-label="Payment reference"
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <p className="text-[10px] text-slate-500 font-medium">
                  Replace this with the UPI reference / RRN from your app if your bank shows a
                  different one.
                </p>
              </div>

              {(notice || externalNotice) && (
                <div
                  className={`rounded-2xl p-3 text-[11px] font-bold leading-snug border ${
                    expired || notice
                      ? "bg-rose-50 border-rose-200 text-rose-800"
                      : "bg-sky-50 border-sky-200 text-sky-800"
                  }`}
                >
                  {notice || externalNotice}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={expired || verifying || isSubmitting}
                  className={`w-full font-black text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all ${
                    expired
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.98] cursor-pointer"
                  }`}
                >
                  <i className={`fa-solid ${expired ? "fa-clock" : "fa-circle-check"} text-xs`} />
                  <span>
                    {isSubmitting
                      ? "Confirming payment…"
                      : verifying
                        ? "Checking with your bank…"
                        : "I have paid — Verify & get tickets"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onRequestClose}
                  disabled={isSubmitting}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel booking
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
