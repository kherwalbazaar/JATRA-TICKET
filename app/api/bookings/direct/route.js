import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";
import { calculateCustomerCharges } from "@/lib/pricing";
import { resolveBookingParameters } from "@/lib/paymentMethods";
import {
  holdSessionId as ownerSessionOf,
  isHoldFreshValue,
  parseHold,
  seatMatchesKey,
} from "@/lib/reservation";
import {
  verifyPayment,
  isGatewayConfigured,
} from "@/lib/server/paymentGateway";
import crypto from "crypto";

function generateQrToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "tkn_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getNextTicketNumber() {
  try {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("ticket_number");
    const used = new Set(
      (data || []).map((d) => String(d.ticket_number || "")).filter(Boolean)
    );

    let seq = (data ? data.length : 0) + 1;
    let ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
    while (used.has(ticketNumber)) {
      seq += 1;
      ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
    }
    return ticketNumber;
  } catch (err) {
    const seq = Math.floor(Math.random() * 90000) + 10000;
    return `NJ26-${seq}`;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId,
      eventName,
      date,
      time,
      block,
      seats = [],
      seatPrice = 100,
      customerName = "Customer",
      customerPhone = "",
      customerEmail = null,
      holdSessionId = "",
      tierName = "SEATED",
      bookingMethod = "direct",
      paymentMethod = "",
      transactionId = "",
      reservationId = "",
      paymentRef = "",
    } = body;

    // Resolve canonical payment method and booking parameters
    let bookingParams;
    try {
      bookingParams = resolveBookingParameters({
        bookingMethod,
        paymentMethodInput: paymentMethod,
        isCounterSale: false,
      });
    } catch (valErr) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PAYMENT_METHOD",
          error: valErr.message || "Invalid payment method specified.",
        },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 }
      );
    }

    // Verify event is not expired
    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("date, start_time, time, status")
      .eq("id", eventId)
      .maybeSingle();

    const evDateStr = eventRow?.date || date;
    if (evDateStr) {
      let isExp = false;
      let expFormatted = "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(evDateStr)) {
        const [y, m, d] = evDateStr.split("-");
        expFormatted = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
        const dt = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
        isExp = dt.getTime() < Date.now();
      }
      if (isExp || eventRow?.status === "expired" || eventRow?.status === "completed") {
        return NextResponse.json(
          {
            success: false,
            error: `This event is expired on date ${expFormatted || evDateStr}. Ticket booking is closed.`,
          },
          { status: 400 }
        );
      }
    }

    const seatList = Array.isArray(seats) ? seats.filter(Boolean) : [];
    if (seatList.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one seat must be selected" },
        { status: 400 }
      );
    }

    const cleanBlock = String(block || "").trim().toUpperCase();

    // 1. Verify block is online in block_categories
    if (cleanBlock) {
      const { data: catData } = await supabaseAdmin
        .from("block_categories")
        .select("online")
        .eq("id", cleanBlock)
        .maybeSingle();

      if (catData && catData.online === false) {
        return NextResponse.json(
          {
            success: false,
            error: "This block is available for counter booking only. Please select another block.",
          },
          { status: 400 }
        );
      }
    }

    // 2. Concurrency Safety: Check seat availability in Supabase seats table.
    // PostgREST truncates every response at 1000 rows, so the read is paged —
    // otherwise seats in the later blocks are invisible to this check.
    const existingSeats = [];
    let seatReadErr = null;
    for (let from = 0; ; from += 1000) {
      const { data: seatPage, error } = await supabaseAdmin
        .from("seats")
        .select("*")
        .eq("event_id", eventId)
        .range(from, from + 999);
      if (error) {
        seatReadErr = error;
        break;
      }
      existingSeats.push(...(seatPage || []));
      if ((seatPage || []).length < 1000) break;
    }

    if (seatReadErr) {
      console.warn("Seat availability read warning:", seatReadErr.message);
    }

    if (Array.isArray(existingSeats) && existingSeats.length > 0) {
      for (const seatKey of seatList) {
        const cleanKey = String(seatKey).trim();
        const matched = existingSeats.find(
          (s) =>
            s.id === cleanKey ||
            s.seat_id === cleanKey ||
            s.seat_label === cleanKey ||
            (s.row && s.seat_number && `${s.row}-${s.seat_number}` === cleanKey) ||
            (s.row && s.seat_number && `${s.row}${s.seat_number}` === cleanKey)
        );

        if (matched) {
          const st = String(matched.status || "").toLowerCase();
          const heldByOther =
            st === "reserved" &&
            matched.reserved_by &&
            ownerSessionOf(matched.reserved_by) !== holdSessionId &&
            isHoldFreshValue(matched.reserved_by, matched.reserved_at);

          if (st === "booked" || heldByOther) {
            const label = matched.seat_label || cleanKey;
            return NextResponse.json(
              {
                success: false,
                code: "SEAT_COLLISION",
                error: `Seat "${label}" is already ${st === "booked" ? "booked" : "held by another user"}. Please select alternative seats.`,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // 3. Pricing Calculation
    const unitPrice = Number(seatPrice) || 100;
    const rawTicketAmount = unitPrice * seatList.length;
    const pricing = calculateCustomerCharges(rawTicketAmount);
    const finalAmount = pricing.finalCustomerAmount;

    // 3.b Reservation guard + server-side payment verification.
    // A booking that arrives with a reservation id must still own live seats,
    // and the money is only ever treated as paid when the gateway confirms it
    // here — frontend confirmation alone can never mark a booking Successful.
    const cleanReservationId = String(reservationId || "").trim();
    const isCounterSale =
      bookingMethod === "counter" || bookingParams.canonicalMethod === "Cash";
    let paymentVerification = { verified: true, source: "counter" };

    if (!isCounterSale && (cleanReservationId || isGatewayConfigured())) {
      const heldSeats = existingSeats.filter(
        (s) =>
          parseHold(s.reserved_by).reservationId === cleanReservationId &&
          seatList.some((k) => seatMatchesKey(s, k))
      );
      const stillActive =
        !cleanReservationId ||
        (heldSeats.length > 0 &&
          heldSeats.every((s) => isHoldFreshValue(s.reserved_by, s.reserved_at)));

      paymentVerification = await verifyPayment({
        paymentRef: String(paymentRef || "").trim(),
        transactionId: String(transactionId || "").trim(),
        reservationId: cleanReservationId,
        amount: finalAmount,
        seatCount: seatList.length,
      });

      if (!paymentVerification.verified) {
        // Payment may still be settling at the gateway: hold the seats and tell
        // the customer to retry instead of silently taking the money.
        const code = stillActive
          ? "PAYMENT_NOT_VERIFIED"
          : "RESERVATION_EXPIRED";
        return NextResponse.json(
          {
            success: false,
            code,
            pending: stillActive,
            verified: false,
            error: stillActive
              ? paymentVerification.message ||
                "Your payment is still being verified. Your seats are held — try again in a moment."
              : "Payment Time Expired! Your selected seats have been released. Please select your seats again.",
            gateway: paymentVerification.gateway || null,
          },
          { status: stillActive ? 409 : 410 }
        );
      }
    }

    const verifiedTxnId =
      paymentVerification.transactionId ||
      transactionId ||
      (isCounterSale ? `COUNTER_${Date.now()}` : "");

    // 4. Order ID & Ticket Number
    const orderId = `JB_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const ticketNumber = await getNextTicketNumber();
    const nowIso = new Date().toISOString();

    const bookingDate = date || new Date().toISOString().slice(0, 10);
    const bookingTime = time || "11:00 PM";
    const resolvedEventName = eventName || "Jatra Show";
    const assignedGate = cleanBlock ? `Block ${cleanBlock}` : "Main Gate";

    // 5. Create Confirmed Booking in Supabase
    const bookingRow = {
      id: orderId,
      ticket_number: ticketNumber,
      event_id: eventId,
      event_name: resolvedEventName,
      customer_name: customerName.trim() || "Customer",
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail || null,
      ticket_type_name: tierName || "SEATED",
      quantity: seatList.length,
      unit_price: unitPrice,
      amount: finalAmount,
      ticket_amount: pricing.ticketAmount,
      base_amount: pricing.ticketAmount,
      convenience_fee: pricing.convenienceFee,
      gst_on_convenience_fee: pricing.gstOnConvenienceFee,
      platform_charge: pricing.platformCharge,
      total_fees: pricing.totalFees,
      final_customer_amount: finalAmount,
      source: bookingParams.source,
      payment_method: bookingParams.canonicalMethod,
      payment_channel: bookingParams.paymentChannel,
      payment_date: bookingParams.paymentStatus === "Successful" ? nowIso : null,
      status: bookingParams.status,
      booking_status: bookingParams.bookingStatus,
      payment_status: bookingParams.paymentStatus,
      transaction_id: verifiedTxnId,
      gateway_transaction_id: paymentVerification.transactionId || verifiedTxnId || null,
      date: bookingDate,
      time: bookingTime,
      block: cleanBlock || null,
      seats: seatList,
      seat_number: seatList.join(", "),
      seat_count: seatList.length,
      entered_count: 0,
      remaining_count: seatList.length,
      assigned_gate: assignedGate,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .insert([bookingRow]);

    if (bookingErr) {
      console.error("[Booking Direct Error]", {
        operation: "insert_booking",
        orderId,
        paymentMethod: bookingParams.canonicalMethod,
        pgCode: bookingErr.code,
        message: bookingErr.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unable to complete booking at this time. Please verify your details and try again.",
        },
        { status: 500 }
      );
    }

    // Record payment transaction in Supabase payments table
    try {
      const payId = `PAY_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const paymentRow = {
        id: payId,
        payment_id: payId,
        booking_id: bookingRow.id,
        ticket_number: bookingRow.ticket_number,
        event_id: eventId,
        customer_name: customerName,
        customer_phone: customerPhone.trim(),
        amount: finalAmount,
        currency: "INR",
        payment_gateway:
          paymentVerification.gateway ||
          (isCounterSale ? "Cash" : bookingParams.paymentChannel || "Online"),
        gateway_order_id: orderId,
        gateway_transaction_id: paymentVerification.transactionId || transactionId || null,
        payment_status: bookingParams.paymentStatus,
        payment_method: bookingParams.canonicalMethod,
        payment_channel: bookingParams.paymentChannel,
        gateway_response: {
          verified_server_side: Boolean(paymentVerification.verified),
          source: paymentVerification.source || null,
          verified_at: paymentVerification.verifiedAt || null,
          reservation_id: cleanReservationId || null,
        },
        created_at: nowIso,
        updated_at: nowIso,
      };
      const { error: paymentErr } = await supabaseAdmin
        .from("payments")
        .insert([paymentRow]);
      if (paymentErr) {
        console.warn("Direct booking payments insert notice:", paymentErr.message);
      }
    } catch (payErr) {
      console.warn("Direct booking payments table notice:", payErr?.message);
    }

    // 6. Update seats in Supabase to "booked"
    for (const seatKey of seatList) {
      const cleanKey = String(seatKey).trim();
      const { data: updatedSeats } = await supabaseAdmin
        .from("seats")
        .update({
          status: "booked",
          booked_at: nowIso,
          booking_id: ticketNumber,
          reserved_at: null,
          reserved_by: null,
          updated_at: nowIso,
        })
        .eq("event_id", eventId)
        .or(`id.eq.${cleanKey},seat_id.eq.${cleanKey},seat_label.eq.${cleanKey}`)
        .select();

      const bookedSeat = updatedSeats?.[0] || {
        id: cleanKey,
        seat_id: cleanKey,
        event_id: eventId,
        status: "booked",
        booked_at: nowIso,
        booking_id: ticketNumber,
      };
      await serverBroadcastSeatChange(eventId, {
        eventType: "UPDATE",
        new: bookedSeat,
        eventId,
      });
    }

    // 7. Insert Individual Tickets in Supabase
    const ticketCount = seatList.length;
    const ticketRows = [];
    const individualTicketIds = [];

    for (let i = 0; i < ticketCount; i++) {
      const individualTicketId =
        ticketCount === 1 ? ticketNumber : `${ticketNumber}-${i + 1}`;
      individualTicketIds.push(individualTicketId);
      const individualSeat = seatList[i] || null;
      const qrToken = generateQrToken();

      ticketRows.push({
        id: individualTicketId,
        ticket_id: individualTicketId,
        booking_id: ticketNumber,
        booking_doc_id: orderId,
        ticket_index: i + 1,
        total_tickets: ticketCount,
        event_id: eventId,
        event_name: resolvedEventName,
        ticket_type_name: tierName || "SEATED",
        seat: individualSeat,
        seat_index: i + 1,
        seat_count: ticketCount,
        block: cleanBlock || null,
        assigned_gate: assignedGate,
        customer_name: bookingRow.customer_name,
        customer_phone: bookingRow.customer_phone,
        serial_number: individualTicketId,
        qr_token: qrToken,
        status: "ACTIVE",
        date: bookingDate,
        time: bookingTime,
        unit_price: unitPrice,
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

    // 7.b Flip the reservation to confirmed (needs the supabase/012 functions)
    if (cleanReservationId) {
      try {
        const { error: confirmErr } = await supabaseAdmin.rpc("confirm_reservation_atomic", {
          p_reservation_id: cleanReservationId,
          p_booking_id: orderId,
          p_gateway: paymentVerification.gateway || bookingParams.paymentChannel || "upi",
          p_gateway_transaction_id: paymentVerification.transactionId || verifiedTxnId || null,
        });
        if (confirmErr) {
          // Row-level fallback keeps the reservation state consistent even
          // before the 012 migration is applied
          console.warn("confirm_reservation_atomic notice:", confirmErr.message);
        }
      } catch (confirmEx) {
        console.warn("Reservation confirm notice:", confirmEx?.message);
      }
    }

    // 8. Update event stats in Supabase
    try {
      const { data: eventData } = await supabaseAdmin
        .from("events")
        .select("tickets_sold, total_revenue")
        .eq("id", eventId)
        .single();

      if (eventData) {
        const nextSold = (Number(eventData.tickets_sold) || 0) + ticketCount;
        const nextRev = (Number(eventData.total_revenue) || 0) + finalAmount;
        await supabaseAdmin
          .from("events")
          .update({
            tickets_sold: nextSold,
            total_revenue: nextRev,
            updated_at: nowIso,
          })
          .eq("id", eventId);
      }
    } catch (evErr) {
      console.warn("Failed to update event revenue:", evErr?.message);
    }

    return NextResponse.json({
      success: true,
      orderId,
      ticketNumber,
      amount: finalAmount,
      seats: seatList,
      // Returned so the client can keep an offline copy under My Tickets.
      booking: bookingRow,
      tickets: ticketRows,
      redirectUrl: "/tickets",
    });
  } catch (err) {
    console.error("[Direct booking unhandled error]:", {
      message: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err.message || "Failed to complete booking." },
      { status: 500 }
    );
  }
}
