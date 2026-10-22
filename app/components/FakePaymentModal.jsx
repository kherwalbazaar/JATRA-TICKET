"use client";

import React, { useState } from "react";

export default function FakePaymentModal({
  isOpen,
  onClose,
  onConfirmPayment,
  amount,
  eventName = "Jatra Show",
  block = "",
  seats = [],
  customerName = "Customer",
  customerPhone = "",
  loading = false,
  processingState = "",
}) {
  const [selectedMethod, setSelectedMethod] = useState("gpay"); // "gpay" | "phonepe" | "paytm" | "card" | "netbanking"
  const [stage, setStage] = useState("select"); // "select" | "processing" | "success"
  const [simulatedTxnId, setSimulatedTxnId] = useState("");

  if (!isOpen) return null;

  const handleStartPayment = async () => {
    setStage("processing");
    const txnId = `TXN_SIM_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    setSimulatedTxnId(txnId);

    // Realistic gateway processing animation (1.6 seconds)
    setTimeout(async () => {
      setStage("success");
      setTimeout(async () => {
        try {
          await onConfirmPayment({
            method: selectedMethod,
            transactionId: txnId,
          });
        } catch (e) {
          setStage("select");
        }
      }, 700);
    }, 1200);
  };

  const getMethodLabel = () => {
    switch (selectedMethod) {
      case "gpay":
        return "Google Pay (Simulated)";
      case "phonepe":
        return "PhonePe UPI (Simulated)";
      case "paytm":
        return "Paytm Wallet / UPI (Simulated)";
      case "card":
        return "Debit / Credit Card (Simulated)";
      case "netbanking":
        return "Net Banking (Simulated)";
      default:
        return "Instant Online UPI";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans text-slate-800 antialiased animate-in fade-in duration-200"
      onClick={stage === "select" && !loading ? onClose : undefined}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center text-amber-400 text-sm">
                <i className="fa-solid fa-shield-halved" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-tight uppercase text-slate-200">
                  Jatra Bazaar Gateway
                </h3>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  ⚡ Simulated Payment Mode
                </span>
              </div>
            </div>

            {stage === "select" && !loading && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Amount Badge */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total to Pay</p>
              <p className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">
                {eventName} • {block} ({seats.length} seats)
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400">
                ₹{Number(amount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        {stage === "processing" ? (
          /* ── STAGE 1: PROCESSING ANIMATION ── */
          <div className="p-8 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative w-16 h-16">
              <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600 text-lg">
                <i className="fa-solid fa-bolt" />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900">
                Connecting to {getMethodLabel()}...
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Authorizing simulated transaction of ₹{Number(amount).toFixed(2)}
              </p>
              <p className="text-[10px] text-amber-600 font-bold pt-1">
                Demo Mode • No real money is deducted
              </p>
            </div>
          </div>
        ) : stage === "success" ? (
          /* ── STAGE 2: SUCCESS CHECKMARK ── */
          <div className="p-8 flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl shadow-sm animate-bounce">
              <i className="fa-solid fa-check" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Simulated Payment Authorized
              </span>
              <h4 className="text-base font-black text-slate-900">
                Payment Successful!
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                Ref: {simulatedTxnId}
              </p>
              <p className="text-[11px] text-slate-600 font-semibold pt-1">
                {processingState || "Issuing your digital QR tickets..."}
              </p>
            </div>
          </div>
        ) : (
          /* ── STAGE 0: SELECT PAYMENT METHOD ── */
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
              <i className="fa-solid fa-circle-info text-amber-600 text-xs mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-snug font-medium">
                <strong>Simulated Testing Mode:</strong> Choose any simulated UPI app or card below. Your booking and QR tickets are processed for real without any deduction.
              </p>
            </div>

            {/* Payment Method Options */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                Select Simulated Payment Method:
              </p>

              {/* 1. Google Pay */}
              <label
                onClick={() => setSelectedMethod("gpay")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === "gpay"
                    ? "border-indigo-600 bg-indigo-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Google Pay UPI</p>
                    <p className="text-[10px] text-slate-500 font-medium">Instant simulation • Fast checkout</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="fakeMethod"
                  checked={selectedMethod === "gpay"}
                  readOnly
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {/* 2. PhonePe */}
              <label
                onClick={() => setSelectedMethod("phonepe")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === "phonepe"
                    ? "border-indigo-600 bg-indigo-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                    पे
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">PhonePe UPI</p>
                    <p className="text-[10px] text-slate-500 font-medium">Simulated UPI transfer</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="fakeMethod"
                  checked={selectedMethod === "phonepe"}
                  readOnly
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {/* 3. Debit / Credit Card */}
              <label
                onClick={() => setSelectedMethod("card")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === "card"
                    ? "border-indigo-600 bg-indigo-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base shadow-xs">
                    <i className="fa-solid fa-credit-card" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Credit / Debit Card</p>
                    <p className="text-[10px] text-slate-500 font-medium">Visa • MasterCard • RuPay (4242)</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="fakeMethod"
                  checked={selectedMethod === "card"}
                  readOnly
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {/* 4. Net Banking */}
              <label
                onClick={() => setSelectedMethod("netbanking")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === "netbanking"
                    ? "border-indigo-600 bg-indigo-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center text-base shadow-xs">
                    <i className="fa-solid fa-building-columns" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Net Banking</p>
                    <p className="text-[10px] text-slate-500 font-medium">All Indian Banks (SBI, HDFC, ICICI)</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="fakeMethod"
                  checked={selectedMethod === "netbanking"}
                  readOnly
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleStartPayment}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
              >
                <i className="fa-solid fa-lock text-xs" />
                <span>Pay ₹{Number(amount).toFixed(2)} (Simulated)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
