import { NextResponse } from "next/server";
import { verifyPayment } from "@/lib/server/paymentGateway";

/**
 * Ask the gateway whether the money actually arrived. Returns a verdict only —
 * it never marks anything paid, and the booking endpoint re-checks independently.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const reservationId = String(body?.reservationId || "").trim();
    const paymentRef = String(body?.paymentRef || "").trim();
    const amount = Number(body?.amount) || 0;

    if (!reservationId) {
      return NextResponse.json(
        { success: false, error: "reservationId is required." },
        { status: 400 }
      );
    }

    const verdict = await verifyPayment({
      paymentRef,
      transactionId: paymentRef,
      reservationId,
      amount,
    });

    return NextResponse.json({
      success: Boolean(verdict.verified),
      verified: Boolean(verdict.verified),
      pending: Boolean(verdict.pending),
      configured: verdict.configured !== false,
      gateway: verdict.gateway || null,
      transactionId: verdict.transactionId || null,
      message: verdict.message || null,
    });
  } catch (err) {
    console.error("API /api/payment/verify error:", err);
    return NextResponse.json(
      { success: false, verified: false, pending: true, error: err?.message || "Verification failed." },
      { status: 500 }
    );
  }
}
