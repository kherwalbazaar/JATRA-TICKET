import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { verifyPaytmOrderStatus, isSimulatorMode } from "@/lib/server/paytm";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 }
      );
    }

    // 1. Check current booking in Supabase
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (bErr || !booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    // 2. Fetch any tickets associated with this booking
    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("booking_doc_id", orderId);

    // 3. If still pending and not simulator, attempt live verification check
    if (booking.payment_status === "Pending" && !isSimulatorMode()) {
      try {
        const paytmStatus = await verifyPaytmOrderStatus(orderId);
        if (paytmStatus && paytmStatus.isSuccess) {
          // If Paytm confirms success, invoke callback or mark confirmed
          const nowIso = new Date().toISOString();
          await supabaseAdmin
            .from("bookings")
            .update({
              status: "Confirmed",
              booking_status: "Confirmed",
              payment_status: "Successful",
              gateway_transaction_id: paytmStatus.txnId,
              transaction_id: paytmStatus.txnId,
              payment_date: nowIso,
              updated_at: nowIso,
            })
            .eq("id", orderId);

          booking.status = "Confirmed";
          booking.payment_status = "Successful";
        }
      } catch (e) {
        /* ignore status poll errors */
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      status: booking.status,
      paymentStatus: booking.payment_status,
      booking,
      tickets: tickets || [],
    });
  } catch (err) {
    console.error("API /api/payment/paytm/status error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch transaction status." },
      { status: 500 }
    );
  }
}
