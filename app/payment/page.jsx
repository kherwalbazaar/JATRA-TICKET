"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { calculateCustomerCharges } from "../../lib/pricing";
import {
  subscribeBlockCategories,
  blockDisplayName,
  isBlockOnline,
} from "../../lib/blockCategories";
import { getHoldSessionId } from "../../lib/seats";
import { getSavedCustomerProfile } from "../../lib/supabase";
import LoginRequiredModal from "../components/LoginRequiredModal";
import FakePaymentModal from "../components/FakePaymentModal";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "";
  const eventName = searchParams.get("event") ?? "";
  const date = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";
  const block = searchParams.get("block") ?? "";
  const seats = searchParams.get("seats") ?? "";
  const seatPrice = Number(searchParams.get("seatPrice")) || 100;
  const customerName = searchParams.get("customerName") ?? "";
  const customerPhone = searchParams.get("customerPhone") ?? "";
  const [paymentMethod, setPaymentMethod] = useState("instant");
  const seatList = seats ? seats.split(",").filter(Boolean) : [];
  const seatCount = seatList.length;
  const rawTicketAmount = seatPrice * seatCount;
  const pricing = calculateCustomerCharges(rawTicketAmount);
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [blockCats, setBlockCats] = useState([]);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [processingState, setProcessingState] = useState("");

  // Block rules + display name from shared config
  useEffect(() => subscribeBlockCategories(setBlockCats), []);
  const blockLabel = block ? blockDisplayName(blockCats, block) : "";
  const blockIsCounterOnly = block ? !isBlockOnline(blockCats, block) : false;

  const handleOpenPaymentModal = () => {
    const profile = getSavedCustomerProfile();
    if (!profile || !profile.full_name) {
      setShowLoginModal(true);
      return;
    }
    if (blockIsCounterOnly) {
      setPayError("This block is available for counter booking only. Please select another block.");
      return;
    }
    if (seatList.length === 0) {
      setPayError("No seats selected. Please go back and select your seats.");
      return;
    }
    setPayError("");
    setShowDemoModal(true);
  };

  const handleConfirmDemoPayment = async (details = {}) => {
    setPayError("");
    setLoading(true);
    setProcessingState("Reserving seats & confirming booking...");

    try {
      const sessionId = getHoldSessionId();
      const profile = getSavedCustomerProfile();

      // Direct booking endpoint with simulated payment reference
      const res = await fetch("/api/bookings/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          eventName,
          date,
          time,
          block,
          seats: seatList,
          seatPrice,
          customerName: customerName || profile?.full_name || "Customer",
          customerPhone: customerPhone || profile?.mobile || "9876543210",
          customerEmail: profile?.email || null,
          holdSessionId: sessionId,
          tierName: `SEATED (${blockLabel || block})`,
          paymentMethod: details.method ? `Simulated ${details.method.toUpperCase()}` : "Simulated UPI (Google Pay)",
          transactionId: details.transactionId || `TXN_SIM_${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "SEAT_COLLISION") {
          throw new Error(data.error || "One or more selected seats were just taken by another user.");
        }
        throw new Error(data.error || "Failed to confirm booking.");
      }

      setProcessingState("Booking Confirmed! Redirecting to ticket pass...");

      // Redirect to confirmed ticket status page
      const targetUrl =
        data.redirectUrl ||
        `/payment/status?orderId=${encodeURIComponent(data.orderId)}&status=success`;

      router.push(targetUrl);
    } catch (err) {
      console.error("Booking confirmation error:", err);
      setLoading(false);
      setProcessingState("");
      setShowDemoModal(false);
      setPayError(err.message || "Failed to confirm booking. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faff] flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
        </button>
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">Checkout & Payment</h2>
          <p className="text-[10px] text-slate-400 font-semibold">Instant Online Ticket Booking</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Order Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-black text-slate-900 uppercase">Order Summary</h3>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {eventName || "Jatra Show"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Block</span>
            <span className="font-bold text-slate-900">{blockLabel || block}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Selected Seats ({seatCount})</span>
            <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
              {seatList.map((s) => (
                <span key={s} className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Seat Price</span>
            <span className="font-bold text-slate-900">₹{seatPrice}</span>
          </div>

          {/* Itemized Fee Breakdown */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Ticket Amount</span>
              <span className="font-bold text-slate-900">₹{pricing.ticketAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <span>Convenience Fee</span>
                <span className="text-[10px] text-slate-400 font-medium">(2.70%)</span>
              </span>
              <span className="font-semibold text-slate-700">₹{pricing.convenienceFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <span>GST on Convenience Fee</span>
                <span className="text-[10px] text-slate-400 font-medium">(18%)</span>
              </span>
              <span className="font-semibold text-slate-700">₹{pricing.gstOnConvenienceFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Platform Charge</span>
              <span className="font-semibold text-slate-700">₹{pricing.platformCharge.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-slate-900 block leading-tight">Total Amount to Pay</span>
              <span className="text-[9px] text-slate-400 font-semibold">All fees & taxes included</span>
            </div>
            <span className="text-xl font-black text-emerald-600">₹{pricing.finalCustomerAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Mode Option */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase">Payment Method</h3>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-emerald-200">
              <i className="fa-solid fa-bolt text-[9px]" /> Instant Demo Mode
            </span>
          </div>

          <label
            onClick={() => setPaymentMethod("demo")}
            className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 cursor-pointer shadow-xs transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-800 flex items-center justify-center text-white text-base shadow-xs">
                <i className="fa-solid fa-credit-card" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900">Instant Online Payment</span>
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded">
                    TEST MODE
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium block">
                  Simulated UPI, Cards & NetBanking • Real Seat Booking
                </span>
              </div>
            </div>
            <input type="radio" checked={paymentMethod === "demo" || paymentMethod === "instant"} readOnly className="text-indigo-600 focus:ring-indigo-500" />
          </label>
        </div>

        {/* Security & Verification Banner */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-circle-info text-xs" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-amber-900">Demo Checkout Notice</h4>
            <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
              Payment operates in a test simulation mode. <strong>No real money will be deducted from your bank account or wallet</strong>, but your seat booking and QR tickets are processed for real.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 space-y-2 max-w-lg mx-auto w-full">
        {blockIsCounterOnly && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <p className="text-xs font-bold text-amber-900 text-center flex items-center justify-center gap-1.5">
              <i className="fa-solid fa-store text-amber-600" />
              <span>This block is available for counter booking only. Please select another block.</span>
            </p>
            <button
              type="button"
              onClick={() => router.push(`/seats?eventId=${eventId}&event=${encodeURIComponent(eventName)}`)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <i className="fa-solid fa-arrow-left" />
              <span>Select Another Online Block</span>
            </button>
          </div>
        )}

        {payError && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
              {payError}
            </p>
            {(payError.includes("Collision") || payError.includes("booked") || payError.includes("another user")) && (
              <button
                type="button"
                onClick={() => router.push(`/seats?eventId=${eventId}&event=${encodeURIComponent(eventName)}`)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <i className="fa-solid fa-arrow-left" />
                <span>Return to Seat Map & Choose Other Seats</span>
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleOpenPaymentModal}
          disabled={loading || blockIsCounterOnly || seatCount === 0}
          className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin text-sm" />
              <span>Processing Demo Payment...</span>
            </span>
          ) : (
            <>
              <i className="fa-solid fa-shield-check text-xs" />
              <span>Proceed to Pay (Demo) • ₹{pricing.finalCustomerAmount.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>

      {/* ── SIMULATED / FAKE PAYMENT GATEWAY MODAL ── */}
      <FakePaymentModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onConfirmPayment={handleConfirmDemoPayment}
        amount={pricing.finalCustomerAmount}
        eventName={eventName || "Jatra Show"}
        block={blockLabel || block}
        seats={seatList}
        customerName={customerName || "Customer"}
        customerPhone={customerPhone || ""}
        loading={loading}
        processingState={processingState}
      />

      {/* Login Required Modal */}
      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Login First to Complete Payment"
        message="You can freely review your booking and order breakdown. However, you must log in to your account before you can confirm and pay for your tickets."
      />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <div className="bg-slate-900 min-h-screen text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <Suspense fallback={<div className="p-8 text-center text-white">Loading payment...</div>}>
        <PaymentContent />
      </Suspense>
    </div>
  );
}
