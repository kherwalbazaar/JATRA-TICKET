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
  const [paymentMethod, setPaymentMethod] = useState("paytm");
  const seatList = seats ? seats.split(",").filter(Boolean) : [];
  const seatCount = seatList.length;
  const rawTicketAmount = seatPrice * seatCount;
  const pricing = calculateCustomerCharges(rawTicketAmount);
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [blockCats, setBlockCats] = useState([]);

  // Block rules + display name from shared config
  useEffect(() => subscribeBlockCategories(setBlockCats), []);
  const blockLabel = block ? blockDisplayName(blockCats, block) : "";
  const blockIsCounterOnly = block ? !isBlockOnline(blockCats, block) : false;

  const handleInitiatePayment = async () => {
    if (blockIsCounterOnly) {
      setPayError("This block is available for counter booking only. Please select another block.");
      return;
    }
    if (seatList.length === 0) {
      setPayError("No seats selected. Please go back and select your seats.");
      return;
    }

    setPayError("");
    setLoading(true);

    try {
      const sessionId = getHoldSessionId();

      const res = await fetch("/api/payment/paytm/initiate", {
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
          customerName: customerName || "Customer",
          customerPhone: customerPhone || "",
          holdSessionId: sessionId,
          tierName: `SEATED (${blockLabel || block})`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "SEAT_COLLISION") {
          throw new Error(data.error || "One or more selected seats were just taken by another user.");
        }
        throw new Error(data.error || "Failed to initiate payment gateway.");
      }

      // If in Staging Simulator Mode
      if (data.isSimulator && data.simulatorUrl) {
        router.push(data.simulatorUrl);
        return;
      }

      // If Live / Staging Paytm Gateway: Create and auto-submit POST form
      if (data.gatewayUrl && (data.formParams || data.txnToken)) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.gatewayUrl;
        form.name = "paytmForm";

        const fields = data.formParams || {
          mid: data.mid,
          orderId: data.orderId,
          txnToken: data.txnToken,
        };

        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = String(value);
            form.appendChild(input);
          }
        }

        document.body.appendChild(form);
        form.submit();
        return;
      } else {
        throw new Error("Invalid payment gateway parameters returned by server.");
      }
    } catch (err) {
      console.error("Payment initiation error:", err);
      setLoading(false);
      setPayError(err.message || "Failed to initiate payment. Please try again.");
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
          <p className="text-[10px] text-slate-400 font-semibold">Secure Paytm Payment Gateway</p>
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

        {/* Payment Gateway Option */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase">Payment Gateway</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <i className="fa-solid fa-lock text-[9px]" /> 256-bit Secure
            </span>
          </div>

          <label
            onClick={() => setPaymentMethod("paytm")}
            className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/30 cursor-pointer shadow-xs transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#002e6e] flex items-center justify-center text-white font-black text-xs shadow-xs">
                <span>Pay<span className="text-[#00baf2]">tm</span></span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">Paytm Payment Gateway</span>
                <span className="text-[10px] text-slate-500 font-medium">UPI, Cards, NetBanking, Paytm Wallet</span>
              </div>
            </div>
            <input type="radio" checked={paymentMethod === "paytm"} readOnly className="text-indigo-600 focus:ring-indigo-500" />
          </label>
        </div>

        {/* Security & Verification Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-shield-halved text-xs" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800">Verified Booking Assurance</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your tickets with unique QR codes will be generated immediately after your payment is verified by Paytm. Seats are reserved while you pay.
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
          onClick={handleInitiatePayment}
          disabled={loading || blockIsCounterOnly || seatCount === 0}
          className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin text-sm" />
              <span>Connecting to Paytm Gateway...</span>
            </span>
          ) : (
            <>
              <i className="fa-solid fa-lock text-xs" />
              <span>Pay via Paytm Gateway • ₹{pricing.finalCustomerAmount.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>
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
