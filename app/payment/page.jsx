"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveBooking } from "../../lib/bookings";
import { reserveSeatsTransaction, markSeatsBooked } from "../../lib/seats";
import { calculateCustomerCharges } from "../../lib/pricing";
import {
  subscribeBlockCategories,
  blockDisplayName,
  isBlockOnline,
} from "../../lib/blockCategories";

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
  const [paymentMethod, setPaymentMethod] = useState("phonepe");
  const seatCount = seats ? seats.split(",").filter(Boolean).length : 0;
  const rawTicketAmount = seatPrice * seatCount;
  const pricing = calculateCustomerCharges(rawTicketAmount);
  const seatList = seats ? seats.split(",").filter(Boolean) : [];
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [blockCats, setBlockCats] = useState([]);

  // Block rules + display name from the admin panel (shared Firestore config)
  useEffect(() => subscribeBlockCategories(setBlockCats), []);
  const blockLabel = block ? blockDisplayName(blockCats, block) : "";
  const blockIsCounterOnly = block ? !isBlockOnline(blockCats, block) : false;

  const handlePayment = async () => {
    if (blockIsCounterOnly) {
      setPayError("This block is available for counter booking only. Please select another block.");
      return;
    }
    setPayError("");
    setLoading(true);
    try {
      if (block && seatList.length > 0) {
        // Concurrency Safety: Atomic runTransaction verifying seat availability before booking
        await reserveSeatsTransaction({
          showId: eventId,
          block,
          seats: seatList,
          customerName,
          customerPhone,
          paymentMethod,
          tier: { id: "seated", name: "SEATED", price: seatPrice, gate: `Block ${blockLabel || block}` },
          eventName,
          date,
          time,
          ticketAmount: pricing.ticketAmount,
          convenienceFee: pricing.convenienceFee,
          gstOnConvenienceFee: pricing.gstOnConvenienceFee,
          platformCharge: pricing.platformCharge,
          totalAmount: pricing.finalCustomerAmount,
        });
      } else {
        await saveBooking({
          tier: { id: "seated", name: "SEATED", price: seatPrice, gate: `Block ${blockLabel || block}` },
          quantity: seatCount,
          paymentMethod,
          ticketAmount: pricing.ticketAmount,
          convenienceFee: pricing.convenienceFee,
          gstOnConvenienceFee: pricing.gstOnConvenienceFee,
          platformCharge: pricing.platformCharge,
          totalAmount: pricing.finalCustomerAmount,
          eventId,
          showId: eventId,
          date,
          time,
          seats: seatList,
          eventName,
          customerName,
          customerPhone,
        });
      }
      setLoading(false);
      try {
        window.sessionStorage.removeItem("jatra:seatHold");
      } catch (e) {
        /* ignore */
      }
      setShowSuccess(true);
    } catch (err) {
      console.error("Failed to complete booking transaction:", err);
      setLoading(false);
      if (err.code === "BLOCK_COUNTER_ONLY" || (err.message && err.message.includes("counter booking only"))) {
        setPayError("This block is available for counter booking only. Please select another block.");
      } else if (err.code === "SEAT_COLLISION") {
        setPayError(err.message || "One or more selected seats were just booked by someone else. Please choose other seats.");
      } else {
        setPayError(err.message || "Failed to process payment and confirm booking. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faff] flex flex-col">
      {/* Success Popup */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 mx-6 max-w-sm w-full shadow-2xl flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <i className="fa-solid fa-check text-4xl text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center">Booking Confirmed!</h3>
            <p className="text-sm text-slate-500 text-center">Your tickets have been booked successfully.</p>
            <div className="w-full bg-slate-50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Block</span>
                <span className="font-bold text-slate-900">{blockLabel || block}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Seats</span>
                <span className="font-bold text-slate-900">{seatList.join(", ")}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Ticket Amount</span>
                <span className="font-semibold text-slate-800">₹{pricing.ticketAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Convenience & Fees</span>
                <span className="font-semibold text-slate-800">₹{pricing.totalFees.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex justify-between text-xs">
                <span className="font-bold text-slate-700">Final Paid</span>
                <span className="font-black text-emerald-600">₹{pricing.finalCustomerAmount.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => router.push("/tickets")}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <i className="fa-solid fa-ticket" />
              <span>View My Tickets</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
          <i className="fa-solid fa-arrow-left text-xs" />
        </button>
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">Payment</h2>
          <p className="text-[10px] text-slate-400 font-semibold">Complete your payment</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        {/* Order Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="text-xs font-black text-slate-900 uppercase">Order Summary</h3>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Block</span>
            <span className="font-bold text-slate-900">{blockLabel || block}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Seats</span>
            <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
              {seatList.map((s) => (
                <span key={s} className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Seat Price</span>
            <span className="font-bold text-slate-900">₹{seatPrice}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Quantity</span>
            <span className="font-bold text-slate-900">{seatCount}</span>
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
              <span className="text-xs font-black text-slate-900 block leading-tight">Final Customer Amount</span>
              <span className="text-[9px] text-slate-400 font-semibold">All fees & taxes included</span>
            </div>
            <span className="text-lg font-black text-emerald-600">₹{pricing.finalCustomerAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <h3 className="text-xs font-black text-slate-900 uppercase mb-2">Payment Method</h3>
          {[
            { key: "phonepe", title: "PhonePe", icon: <svg viewBox="0 0 24 24" className="w-6 h-6"><circle cx="12" cy="12" r="12" fill="#5F259F"/><text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">P</text></svg> },
            { key: "googlepay", title: "Google Pay", icon: <svg viewBox="0 0 24 24" className="w-6 h-6"><circle cx="12" cy="12" r="12" fill="#fff" stroke="#ddd" strokeWidth="1"/><text x="12" y="16" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold">G</text></svg> },
            { key: "paytm", title: "Paytm", icon: <svg viewBox="0 0 24 24" className="w-6 h-6"><circle cx="12" cy="12" r="12" fill="#00BAF2"/><text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">P</text></svg> },
            { key: "airtel", title: "Airtel Payment Bank", icon: <svg viewBox="0 0 24 24" className="w-6 h-6"><circle cx="12" cy="12" r="12" fill="#ED1C24"/><text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">A</text></svg> },
            { key: "postal", title: "IPPB", icon: <svg viewBox="0 0 24 24" className="w-6 h-6"><circle cx="12" cy="12" r="12" fill="#FF6600"/><text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">I</text></svg> },
          ].map((opt) => (
            <label
              key={opt.key}
              onClick={() => setPaymentMethod(opt.key)}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                paymentMethod === opt.key
                  ? "border-purple-600 bg-purple-50/40 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                {opt.icon}
                <span className="text-xs font-black text-slate-900">{opt.title}</span>
              </div>
              <input type="radio" checked={paymentMethod === opt.key} readOnly className="text-purple-600 focus:ring-purple-500" />
            </label>
          ))}
        </div>

        {/* UPI QR Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center space-y-4">
          <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center border border-slate-200 p-2">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Corner patterns */}
              <rect x="0" y="0" width="25" height="25" fill="#000" rx="2" />
              <rect x="3" y="3" width="19" height="19" fill="#fff" rx="1" />
              <rect x="6" y="6" width="13" height="13" fill="#000" rx="1" />
              
              <rect x="75" y="0" width="25" height="25" fill="#000" rx="2" />
              <rect x="78" y="3" width="19" height="19" fill="#fff" rx="1" />
              <rect x="81" y="6" width="13" height="13" fill="#000" rx="1" />
              
              <rect x="0" y="75" width="25" height="25" fill="#000" rx="2" />
              <rect x="3" y="78" width="19" height="19" fill="#fff" rx="1" />
              <rect x="6" y="81" width="13" height="13" fill="#000" rx="1" />
              
              {/* Data pattern */}
              <rect x="30" y="0" width="5" height="5" fill="#000" />
              <rect x="40" y="0" width="5" height="5" fill="#000" />
              <rect x="50" y="0" width="5" height="5" fill="#000" />
              <rect x="60" y="0" width="5" height="5" fill="#000" />
              
              <rect x="30" y="10" width="5" height="5" fill="#000" />
              <rect x="45" y="10" width="5" height="5" fill="#000" />
              <rect x="55" y="10" width="5" height="5" fill="#000" />
              
              <rect x="35" y="20" width="5" height="5" fill="#000" />
              <rect x="50" y="20" width="5" height="5" fill="#000" />
              <rect x="65" y="20" width="5" height="5" fill="#000" />
              
              <rect x="0" y="30" width="5" height="5" fill="#000" />
              <rect x="10" y="30" width="5" height="5" fill="#000" />
              <rect x="30" y="30" width="5" height="5" fill="#000" />
              <rect x="40" y="30" width="5" height="5" fill="#000" />
              <rect x="55" y="30" width="5" height="5" fill="#000" />
              <rect x="70" y="30" width="5" height="5" fill="#000" />
              <rect x="85" y="30" width="5" height="5" fill="#000" />
              <rect x="95" y="30" width="5" height="5" fill="#000" />
              
              <rect x="5" y="40" width="5" height="5" fill="#000" />
              <rect x="20" y="40" width="5" height="5" fill="#000" />
              <rect x="35" y="40" width="5" height="5" fill="#000" />
              <rect x="50" y="40" width="5" height="5" fill="#000" />
              <rect x="60" y="40" width="5" height="5" fill="#000" />
              <rect x="75" y="40" width="5" height="5" fill="#000" />
              <rect x="90" y="40" width="5" height="5" fill="#000" />
              
              <rect x="0" y="50" width="5" height="5" fill="#000" />
              <rect x="15" y="50" width="5" height="5" fill="#000" />
              <rect x="30" y="50" width="5" height="5" fill="#000" />
              <rect x="45" y="50" width="5" height="5" fill="#000" />
              <rect x="65" y="50" width="5" height="5" fill="#000" />
              <rect x="80" y="50" width="5" height="5" fill="#000" />
              <rect x="95" y="50" width="5" height="5" fill="#000" />
              
              <rect x="10" y="60" width="5" height="5" fill="#000" />
              <rect x="25" y="60" width="5" height="5" fill="#000" />
              <rect x="40" y="60" width="5" height="5" fill="#000" />
              <rect x="55" y="60" width="5" height="5" fill="#000" />
              <rect x="70" y="60" width="5" height="5" fill="#000" />
              <rect x="85" y="60" width="5" height="5" fill="#000" />
              
              <rect x="30" y="70" width="5" height="5" fill="#000" />
              <rect x="45" y="70" width="5" height="5" fill="#000" />
              <rect x="60" y="70" width="5" height="5" fill="#000" />
              <rect x="75" y="70" width="5" height="5" fill="#000" />
              <rect x="90" y="70" width="5" height="5" fill="#000" />
              
              <rect x="30" y="80" width="5" height="5" fill="#000" />
              <rect x="40" y="80" width="5" height="5" fill="#000" />
              <rect x="55" y="80" width="5" height="5" fill="#000" />
              <rect x="70" y="80" width="5" height="5" fill="#000" />
              <rect x="85" y="80" width="5" height="5" fill="#000" />
              
              <rect x="30" y="90" width="5" height="5" fill="#000" />
              <rect x="50" y="90" width="5" height="5" fill="#000" />
              <rect x="65" y="90" width="5" height="5" fill="#000" />
              <rect x="80" y="90" width="5" height="5" fill="#000" />
              <rect x="95" y="90" width="5" height="5" fill="#000" />
            </svg>
          </div>
          <p className="text-[10px] text-slate-500 font-medium text-center">
            Scan the QR code or use UPI ID to pay
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 space-y-2">
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
            {(payError.includes("Collision") || payError.includes("booked") || payError.includes("another user") || payError.includes("counter booking only")) && (
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
          onClick={handlePayment}
          disabled={loading || blockIsCounterOnly}
          className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <i className="fa-solid fa-spinner fa-spin" />
          ) : (
            <>
              <i className="fa-solid fa-check" />
              <span>Proceed To Payment • ₹{pricing.finalCustomerAmount.toFixed(2)}</span>
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
      <Suspense fallback={null}>
        <PaymentContent />
      </Suspense>
    </div>
  );
}
