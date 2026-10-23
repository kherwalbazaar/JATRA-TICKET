"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("orderId") || "";
  const initialStatus = searchParams.get("status") || "pending";
  const errorMessage = searchParams.get("error") || "";

  const [booking, setBooking] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [checking, setChecking] = useState(false);

  const fetchStatus = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/payment/status?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.success && data.booking) {
        setBooking(data.booking);
        setTickets(data.tickets || []);
        if (data.booking.payment_status === "Successful") {
          setCurrentStatus("success");
        } else if (data.booking.payment_status === "Failed") {
          setCurrentStatus("failed");
        } else {
          setCurrentStatus("pending");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch order status:", err);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [orderId]);

  useEffect(() => {
    if (currentStatus === "success") {
      const timer = setTimeout(() => {
        router.push("/tickets");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentStatus, router]);

  return (
    <div className="bg-[#f8faff] min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col items-center justify-center space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500">Verifying payment details...</p>
          </div>
        ) : currentStatus === "success" ? (
          /* ── SUCCESS STATE ── */
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full shadow-xl border border-slate-100 flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Payment Verified & Confirmed
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight font-brand">
                Booking Successful!
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Your online ticket booking has been successfully confirmed.
              </p>
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Ticket Number</span>
                <span className="font-mono font-black text-indigo-950 text-sm">
                  {booking?.ticket_number || orderId}
                </span>
              </div>
              {booking && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Event</span>
                    <span className="font-bold text-slate-900 text-right max-w-[65%] truncate">
                      {booking.event_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Date & Time</span>
                    <span className="font-semibold text-slate-800">
                      {booking.date} • {booking.time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Block & Seats</span>
                    <span className="font-black text-amber-700">
                      Block {booking.block} ({Array.isArray(booking.seats) ? booking.seats.join(", ") : booking.seat_number})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Customer</span>
                    <span className="font-semibold text-slate-800">
                      {booking.customer_name} (+91 {booking.customer_phone})
                    </span>
                  </div>
                  {booking.gateway_transaction_id && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Txn Reference</span>
                      <span className="font-mono text-[10px] text-slate-600 font-bold">
                        {booking.gateway_transaction_id}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-800">Total Paid</span>
                    <span className="font-black text-emerald-600 text-base">
                      ₹{Number(booking.amount || booking.final_customer_amount).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="w-full space-y-2 pt-2">
              <button
                onClick={() => router.push("/tickets")}
                className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <i className="fa-solid fa-ticket text-base" />
                <span>Go to My Tickets</span>
              </button>

              <button
                onClick={() => {
                  const targetId = booking?.ticket_number || (tickets[0]?.ticket_id) || orderId;
                  router.push(`/tickets/${encodeURIComponent(targetId)}`);
                }}
                className="w-full bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold text-xs py-3 rounded-xl shadow-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-qrcode text-base" />
                <span>Open Digital Ticket Pass (QR Code)</span>
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : currentStatus === "failed" ? (
          /* ── FAILED STATE ── */
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full shadow-xl border border-slate-100 flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                Payment Failed or Cancelled
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight font-brand">
                Transaction Incomplete
              </h2>
              <p className="text-xs text-rose-600 font-bold">
                {errorMessage || "The payment could not be processed or was cancelled."}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                No tickets were issued. Any temporary seat holds have been released.
              </p>
            </div>

            <div className="w-full space-y-2 pt-4">
              <button
                onClick={() => router.push(booking?.event_id ? `/seats?eventId=${booking.event_id}` : "/")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <i className="fa-solid fa-rotate-right" />
                <span>Choose Seats & Try Again</span>
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : (
          /* ── PENDING STATE ── */
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full shadow-xl border border-slate-100 flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
              <i className="fa-solid fa-clock text-4xl" />
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Awaiting Bank Confirmation
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight font-brand">
                Payment Processing
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Your payment is pending confirmation from the bank or UPI gateway.
              </p>
              <p className="text-[11px] text-amber-600 font-bold">
                Your seats remain temporarily reserved while we confirm payment. Tickets will be issued as soon as confirmation arrives.
              </p>
            </div>

            <div className="w-full space-y-2 pt-4">
              <button
                onClick={fetchStatus}
                disabled={checking}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                {checking ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Checking Status...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-arrows-rotate" />
                    <span>Check Status Now</span>
                  </>
                )}
              </button>

              <button
                onClick={() => router.push("/tickets")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors"
              >
                Go to My Tickets
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav active="tickets" />
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading payment status...</div>}>
      <StatusContent />
    </Suspense>
  );
}
