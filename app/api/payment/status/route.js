import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

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

    return NextResponse.json({
      success: true,
      orderId,
      status: booking.status,
      paymentStatus: booking.payment_status,
      booking,
      tickets: tickets || [],
    });
  } catch (err) {
    console.error("API /api/payment/status error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch order status." },
      { status: 500 }
    );
  }
}
