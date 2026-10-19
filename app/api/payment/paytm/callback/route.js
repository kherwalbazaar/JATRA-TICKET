import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { verifyPaytmChecksum, verifyPaytmOrderStatus, isSimulatorMode } from "@/lib/server/paytm";
import crypto from "crypto";

function generateQrToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "tkn_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(request) {
  return handleCallback(request);
}

export async function GET(request) {
  return handleCallback(request);
}

async function handleCallback(request) {
  try {
    const { searchParams } = new URL(request.url);
    let params = {};

    const contentType = request.headers.get("content-type") || "";

    if (request.method === "POST") {
      if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        params = Object.fromEntries(formData.entries());
      } else if (contentType.includes("application/json")) {
        params = await request.json();
      } else {
        const text = await request.text();
        try {
          params = JSON.parse(text);
        } catch (e) {
          params = Object.fromEntries(new URLSearchParams(text).entries());
        }
      }
    } else {
      params = Object.fromEntries(searchParams.entries());
    }

    const orderId =
      params.ORDERID ||
      params.ORDER_ID ||
      params.orderId ||
      searchParams.get("orderId") ||
      "";

    const txnId = params.TXNID || params.txnId || null;
    const rawStatus = (params.STATUS || params.status || "").toUpperCase();
    const respCode = params.RESPCODE || params.respCode || "";
    const respMsg = params.RESPMSG || params.respMsg || "";
    const checksumHash = params.CHECKSUMHASH || params.checksum || "";
    const isSimulated = params.IS_SIMULATOR === "true" || isSimulatorMode();

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId in callback parameters" },
        { status: 400 }
      );
    }

    // 1. Fetch pending booking from Supabase
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !booking) {
      console.error(`Booking not found for orderId: ${orderId}`, fetchErr?.message);
      const redirectUrl = new URL(`/payment/status?orderId=${encodeURIComponent(orderId)}&status=not_found`, request.url);
      return NextResponse.redirect(redirectUrl, 303);
    }

    // 2. IDEMPOTENCY GUARD (Requirement 6): Prevent duplicate processing / tickets
    if (booking.payment_status === "Successful" && booking.status === "Confirmed") {
      console.log(`Duplicate callback received for confirmed orderId: ${orderId}. Returning existing confirmation.`);
      const redirectUrl = new URL(`/payment/status?orderId=${encodeURIComponent(orderId)}&status=success`, request.url);
      return NextResponse.redirect(redirectUrl, 303);
    }

    // 3. Security: Checksum verification
    if (!isSimulated && checksumHash) {
      const checksumParams = { ...params };
      delete checksumParams.CHECKSUMHASH;

      const isValidChecksum = await verifyPaytmChecksum(checksumParams, checksumHash);
      if (!isValidChecksum) {
        console.error(`SECURITY ALERT: Checksum verification failed for orderId: ${orderId}`);
        const redirectUrl = new URL(
          `/payment/status?orderId=${encodeURIComponent(orderId)}&status=failed&error=Invalid+checksum+signature`,
          request.url
        );
        return NextResponse.redirect(redirectUrl, 303);
      }
    }

    // 4. Server-to-Server Transaction Verification (Requirement 3 & 9)
    let isTxnVerified = false;
    let verifiedStatus = rawStatus;

    if (!isSimulated) {
      try {
        const paytmStatus = await verifyPaytmOrderStatus(orderId);
        if (paytmStatus && paytmStatus.resultStatus) {
          verifiedStatus = paytmStatus.resultStatus;
          isTxnVerified = paytmStatus.isSuccess;
        }
      } catch (verifyErr) {
        console.warn("Direct Paytm status verification query error:", verifyErr.message);
        isTxnVerified = rawStatus === "TXN_SUCCESS" && respCode === "01";
      }
    } else {
      // In simulator mode, trust the simulated outcome
      isTxnVerified = rawStatus === "TXN_SUCCESS" || rawStatus === "SUCCESS";
    }

    const nowIso = new Date().toISOString();
    const seatList = Array.isArray(booking.seats)
      ? booking.seats
      : typeof booking.seats === "string"
      ? booking.seats.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // 5. Handle States: SUCCESS, FAILED, PENDING
    if (isTxnVerified) {
      // ══════════════════════════════════════════════════════════════════
      // SUCCESS STATE
      // ══════════════════════════════════════════════════════════════════

      // A. Update booking to Confirmed & Successful in Supabase
      const { error: updateBookingErr } = await supabaseAdmin
        .from("bookings")
        .update({
          status: "Confirmed",
          booking_status: "Confirmed",
          payment_status: "Successful",
          gateway_transaction_id: txnId,
          transaction_id: txnId,
          payment_date: nowIso,
          payment_method: "UPI",
          payment_channel: "Online",
          updated_at: nowIso,
        })
        .eq("id", orderId);

      if (updateBookingErr) {
        console.error("Failed to update booking to Confirmed:", updateBookingErr.message);
      }

      // B. Update seats to booked in Supabase
      for (const seatKey of seatList) {
        const cleanKey = String(seatKey).trim();
        await supabaseAdmin
          .from("seats")
          .update({
            status: "booked",
            booked_at: nowIso,
            booking_id: booking.ticket_number,
            reserved_at: null,
            reserved_by: null,
            updated_at: nowIso,
          })
          .eq("event_id", booking.event_id)
          .or(`id.eq.${cleanKey},seat_label.eq.${cleanKey}`);
      }

      // C. Generate and insert tickets (Requirement 4: ONLY after verified payment!)
      const ticketCount = seatList.length || Number(booking.quantity) || 1;
      const ticketRows = [];

      for (let i = 0; i < ticketCount; i++) {
        const individualTicketId =
          ticketCount === 1 ? booking.ticket_number : `${booking.ticket_number}-${i + 1}`;
        const individualSeat = seatList[i] || null;
        const qrToken = generateQrToken();

        ticketRows.push({
          id: individualTicketId,
          ticket_id: individualTicketId,
          booking_id: booking.ticket_number,
          booking_doc_id: booking.id,
          ticket_index: i + 1,
          total_tickets: ticketCount,
          event_id: booking.event_id,
          event_name: booking.event_name,
          ticket_type_name: booking.ticket_type_name || "SEATED",
          seat: individualSeat,
          seat_index: i + 1,
          seat_count: ticketCount,
          block: booking.block || null,
          assigned_gate: booking.block ? `Block ${booking.block}` : "Main Gate",
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          serial_number: individualTicketId,
          qr_token: qrToken,
          status: "ACTIVE",
          date: booking.date,
          time: booking.time,
          unit_price: Number(booking.unit_price) || 0,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      const { error: ticketsInsertErr } = await supabaseAdmin
        .from("tickets")
        .upsert(ticketRows);

      if (ticketsInsertErr) {
        console.error("Failed to insert tickets in Supabase:", ticketsInsertErr.message);
      }

      // D. Increment tickets_sold and total_revenue on event
      try {
        const { data: eventData } = await supabaseAdmin
          .from("events")
          .select("tickets_sold, total_revenue")
          .eq("id", booking.event_id)
          .single();

        if (eventData) {
          const nextSold = (Number(eventData.tickets_sold) || 0) + ticketCount;
          const nextRev = (Number(eventData.total_revenue) || 0) + (Number(booking.amount) || 0);
          await supabaseAdmin
            .from("events")
            .update({
              tickets_sold: nextSold,
              total_revenue: nextRev,
              updated_at: nowIso,
            })
            .eq("id", booking.event_id);
        }
      } catch (evErr) {
        console.warn("Failed to update event revenue:", evErr?.message);
      }

      // E. Redirect to Success Status Page
      const redirectUrl = new URL(
        `/payment/status?orderId=${encodeURIComponent(orderId)}&status=success`,
        request.url
      );
      return NextResponse.redirect(redirectUrl, 303);

    } else if (rawStatus === "PENDING" || verifiedStatus === "PENDING") {
      // ══════════════════════════════════════════════════════════════════
      // PENDING STATE
      // ══════════════════════════════════════════════════════════════════
      await supabaseAdmin
        .from("bookings")
        .update({
          status: "Pending",
          booking_status: "Pending",
          payment_status: "Pending",
          gateway_transaction_id: txnId,
          updated_at: nowIso,
        })
        .eq("id", orderId);

      // Seats remain reserved. No tickets issued.
      const redirectUrl = new URL(
        `/payment/status?orderId=${encodeURIComponent(orderId)}&status=pending`,
        request.url
      );
      return NextResponse.redirect(redirectUrl, 303);

    } else {
      // ══════════════════════════════════════════════════════════════════
      // FAILED / CANCELLED STATE
      // ══════════════════════════════════════════════════════════════════
      await supabaseAdmin
        .from("bookings")
        .update({
          status: "Cancelled",
          booking_status: "Cancelled",
          payment_status: "Failed",
          gateway_transaction_id: txnId,
          updated_at: nowIso,
        })
        .eq("id", orderId);

      // Release reserved seats back to available
      for (const seatKey of seatList) {
        const cleanKey = String(seatKey).trim();
        await supabaseAdmin
          .from("seats")
          .update({
            status: "available",
            reserved_at: null,
            reserved_by: null,
            updated_at: nowIso,
          })
          .eq("event_id", booking.event_id)
          .or(`id.eq.${cleanKey},seat_label.eq.${cleanKey}`)
          .eq("status", "reserved");
      }

      // No tickets issued!
      const redirectUrl = new URL(
        `/payment/status?orderId=${encodeURIComponent(orderId)}&status=failed&error=${encodeURIComponent(respMsg || "Payment could not be completed.")}`,
        request.url
      );
      return NextResponse.redirect(redirectUrl, 303);
    }
  } catch (err) {
    console.error("API /api/payment/paytm/callback error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process payment callback." },
      { status: 500 }
    );
  }
}
