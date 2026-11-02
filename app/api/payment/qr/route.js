import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { calculateCustomerCharges } from "@/lib/pricing";
import {
  buildUpiPaymentUri,
  isGatewayConfigured,
  isTestModeAllowed,
  upiMerchantHandle,
} from "@/lib/server/paymentGateway";
import { parseHold, seatMatchesKey } from "@/lib/reservation";

/**
 * Payment instructions for the QR popup. The amount and the reference are
 * produced here, never in the browser, and the QR encodes a real payable UPI
 * intent for the merchant handle configured on the server.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = String(body?.eventId || "").trim();
    const reservationId = String(body?.reservationId || "").trim();
    const block = String(body?.block || "").trim().toUpperCase();
    const seatList = Array.isArray(body?.seats) ? body.seats.filter(Boolean) : [];
    const seatPrice = Number(body?.seatPrice) || 0;

    if (!eventId || seatList.length === 0) {
      return NextResponse.json(
        { success: false, error: "eventId and seats are required." },
        { status: 400 }
      );
    }

    // Price the booking from the seat rows the server holds, not from the client total
    // (paged: PostgREST truncates every response at 1000 rows)
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("seats")
        .select("id, seat_id, seat_label, row, row_id, seat_number, status, price, reserved_at, reserved_by")
        .eq("event_id", eventId)
        .range(from, from + 999);
      if (error || !page || page.length === 0) break;
      rows.push(...page);
      if (page.length < 1000) break;
    }
    const chosen = seatList
      .map((key) => rows.find((s) => seatMatchesKey(s, key)))
      .filter(Boolean);

    if (chosen.length !== seatList.length) {
      return NextResponse.json(
        { success: false, code: "SEAT_NOT_FOUND", error: "One of the selected seats no longer exists." },
        { status: 409 }
      );
    }

    let reservationLive = false;
    let expiresAtMs = null;
    if (reservationId) {
      const mine = chosen.filter(
        (s) =>
          parseHold(s.reserved_by).reservationId === reservationId &&
          Date.now() < (parseHold(s.reserved_by).expiresAt || 0)
      );
      reservationLive = mine.length === chosen.length;
      const deadlines = mine.map((s) => parseHold(s.reserved_by).expiresAt).filter(Boolean);
      expiresAtMs = deadlines.length ? Math.min(...deadlines) : null;
    }

    const ticketAmount = chosen.reduce(
      (sum, s) => sum + (Number(s.price) > 0 ? Number(s.price) : seatPrice),
      0
    );
    if (!(ticketAmount > 0)) {
      return NextResponse.json(
        { success: false, code: "PRICE_UNAVAILABLE", error: "Seat prices are unavailable for this event." },
        { status: 409 }
      );
    }
    const pricing = calculateCustomerCharges(ticketAmount);

    const vpa = upiMerchantHandle();
    const transactionRef = `JB${String(reservationId || Date.now()).replace(/[^A-Za-z0-9]/g, "").slice(-14).toUpperCase()}`;

    const payeeName = String(process.env.UPI_PAYEE_NAME || "JATRA BAZAAR").slice(0, 50);
    const upiUri = buildUpiPaymentUri({
      amount: pricing.finalCustomerAmount,
      transactionRef,
      payeeVpa: vpa,
      payeeName,
      note: `${block || "Jatra"} ${seatList.length} seat(s)`,
    });

    if (!upiUri) {
      return NextResponse.json({
        success: false,
        code: "UPI_NOT_CONFIGURED",
        message:
          "No merchant UPI handle (UPI_PAYEE_VPA) is configured on this server, so a payable QR cannot be generated.",
        amount: pricing.finalCustomerAmount,
        pricing,
        gatewayConfigured: isGatewayConfigured(),
        testMode: isTestModeAllowed(),
      });
    }

    return NextResponse.json({
      success: true,
      upiUri,
      transactionRef,
      payeeName,
      payeeVpa: vpa,
      amount: pricing.finalCustomerAmount,
      currency: "INR",
      pricing,
      reservationId: reservationId || null,
      reservationLive,
      expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
      gatewayConfigured: isGatewayConfigured(),
    });
  } catch (err) {
    console.error("API /api/payment/qr error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not build the payment QR." },
      { status: 500 }
    );
  }
}
