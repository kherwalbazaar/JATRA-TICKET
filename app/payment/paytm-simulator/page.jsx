"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SimulatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("orderId") || "";
  const txnToken = searchParams.get("txnToken") || "";
  const amount = searchParams.get("amount") || "100.00";

  const [loading, setLoading] = useState(false);
  const [selectedSim, setSelectedSim] = useState("SUCCESS");
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/payment/paytm/status?orderId=${encodeURIComponent(orderId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.booking) {
          setOrderDetails(d.booking);
        }
      })
      .catch(() => {});
  }, [orderId]);

  const handleSimulate = async (type) => {
    setLoading(true);

    const nowIso = new Date().toISOString();
    const fakeTxnId = `PTM_TXN_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let postParams = {
      ORDERID: orderId,
      TXNID: fakeTxnId,
      TXNAMOUNT: amount,
      CURRENCY: "INR",
      STATUS: type === "SUCCESS" ? "TXN_SUCCESS" : type === "PENDING" ? "PENDING" : "TXN_FAILURE",
      RESPCODE: type === "SUCCESS" ? "01" : type === "PENDING" ? "400" : "227",
      RESPMSG:
        type === "SUCCESS"
          ? "Txn Successful"
          : type === "PENDING"
          ? "Your payment is pending confirmation"
          : "Payment failed / user cancelled",
      BANKTXNID: `BANK_${Date.now()}`,
      CHECKSUMHASH: `SIM_CHECKSUM_${Date.now()}`,
      PAYMENTMODE: "UPI",
      TXNDATE: nowIso,
      IS_SIMULATOR: "true",
    };

    try {
      // POST callback to /api/payment/paytm/callback
      const res = await fetch("/api/payment/paytm/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postParams),
      });

      if (res.redirected) {
        window.location.href = res.url;
      } else {
        const dest =
          type === "SUCCESS"
            ? `/payment/status?orderId=${encodeURIComponent(orderId)}&status=success`
            : type === "PENDING"
            ? `/payment/status?orderId=${encodeURIComponent(orderId)}&status=pending`
            : `/payment/status?orderId=${encodeURIComponent(orderId)}&status=failed&error=Payment+Declined`;
        router.push(dest);
      }
    } catch (e) {
      console.error("Simulation callback error:", e);
      router.push(`/payment/status?orderId=${encodeURIComponent(orderId)}&status=failed`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        {/* Paytm Header */}
        <div className="bg-[#002e6e] p-6 text-white flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-black tracking-tight text-white">Pay<span className="text-[#00baf2]">tm</span></span>
            <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Staging Gateway Test Mode
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium">JATRA BAZAAR Payment Gateway Testing</p>
        </div>

        {/* Order Details */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-semibold">Order ID</span>
              <span className="font-mono font-bold text-slate-800">{orderId}</span>
            </div>
            {orderDetails && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Event</span>
                  <span className="font-bold text-slate-900">{orderDetails.event_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Seats</span>
                  <span className="font-bold text-amber-700">
                    Block {orderDetails.block} ({orderDetails.seats?.join(", ")})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Customer</span>
                  <span className="font-semibold text-slate-800">
                    {orderDetails.customer_name} ({orderDetails.customer_phone})
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-slate-700 font-bold text-sm">Amount to Pay</span>
              <span className="text-xl font-black text-emerald-600">₹{Number(amount).toFixed(2)}</span>
            </div>
          </div>

          {/* Test Scenario Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Select Test Scenario:</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  id: "SUCCESS",
                  title: "Simulate Successful Payment",
                  desc: "Verifies payment, confirms booking, marks seats booked, and issues unique tickets with QR codes.",
                  color: "border-emerald-500 bg-emerald-50/40 text-emerald-800",
                },
                {
                  id: "FAILED",
                  title: "Simulate Failed / Cancelled Payment",
                  desc: "Cancels booking, releases seats back to available, issues NO tickets.",
                  color: "border-rose-500 bg-rose-50/40 text-rose-800",
                },
                {
                  id: "PENDING",
                  title: "Simulate Pending Payment (Bank Delay)",
                  desc: "Sets booking to pending, holds seats, issues NO tickets.",
                  color: "border-amber-500 bg-amber-50/40 text-amber-800",
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedSim(opt.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedSim === opt.id ? opt.color : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs">{opt.title}</span>
                    <input
                      type="radio"
                      checked={selectedSim === opt.id}
                      onChange={() => setSelectedSim(opt.id)}
                      className="text-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <button
            onClick={() => handleSimulate(selectedSim)}
            disabled={loading}
            className={`w-full py-3.5 rounded-2xl font-black text-sm text-white shadow-lg transition-all active:scale-[0.98] ${
              selectedSim === "SUCCESS"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                : selectedSim === "PENDING"
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30"
                : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Processing...</span>
              </span>
            ) : (
              <span>Proceed with {selectedSim} Test</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaytmSimulatorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading simulator...</div>}>
      <SimulatorContent />
    </Suspense>
  );
}
