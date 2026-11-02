import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";
import {
  isGatewayConfigured,
  isTestModeAllowed,
  isValidVpa,
  upiMerchantHandle,
} from "@/lib/server/paymentGateway";
import {
  PAYMENT_WINDOW_MS,
  applyOwnershipFilter,
  buildPaymentHold,
  isHoldFreshValue,
  newReservationId,
  parseHold,
  seatMatchesKey,
} from "@/lib/reservation";

/**
 * Arm a 60 second payment reservation over the seats this session is holding.
 * The deadline is written into every seat row by the server, so reloading the
 * page or restarting the app cannot reset it.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = String(body?.eventId || "").trim();
    const block = String(body?.block || "").trim().toUpperCase();
    const sessionId = String(body?.sessionId || "").trim();
    const seatList = Array.isArray(body?.seats) ? body.seats.filter(Boolean) : [];

    if (!eventId || !sessionId || seatList.length === 0) {
      return NextResponse.json(
        { success: false, code: "INVALID_PARAMS", error: "eventId, sessionId and seats are required." },
        { status: 400 }
      );
    }

    // Counter-only blocks never enter an online payment reservation
    if (block) {
      const { data: cat } = await supabaseAdmin
        .from("block_categories")
        .select("online")
        .eq("id", block)
        .maybeSingle();
      if (cat && cat.online === false) {
        return NextResponse.json(
          {
            success: false,
            code: "BLOCK_COUNTER_ONLY",
            error: "This block is available for counter booking only. Please select another block.",
          },
          { status: 400 }
        );
      }
    }

    // What the customer should be shown next: a payable QR, or the legacy
    // in-app options while no gateway is wired up yet.
    const paymentMode = {
      qrAvailable: isValidVpa(upiMerchantHandle()),
      gatewayConfigured: isGatewayConfigured(),
      testMode: isTestModeAllowed(),
    };

    // Preferred path: a single atomic database function (supabase/012 migration)
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "create_payment_reservation_atomic",
        {
          p_event_id: eventId,
          p_session_id: sessionId,
          p_block_id: block || null,
          p_seat_keys: seatList.map(String),
          p_window_ms: PAYMENT_WINDOW_MS,
        }
      );
      if (!rpcError && rpcData?.success) {
        await serverBroadcastSeatChange(eventId, { eventType: "SWEEP", eventId });
        return NextResponse.json({
          success: true,
          reservationId: rpcData.reservation_id,
          expiresAt: rpcData.expires_at,
          remainingMs: Number(rpcData.remaining_ms) || PAYMENT_WINDOW_MS,
          windowMs: PAYMENT_WINDOW_MS,
          seats: rpcData.seats || seatList,
          atomic: true,
          ...paymentMode,
        });
      }
    } catch (rpcEx) {
      // Fall through to the row-level path
    }

    // Existing seats of this event (paged: PostgREST caps every response at 1000 rows)
    const allSeats = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("seats")
        .select("*")
        .eq("event_id", eventId)
        .range(from, from + 999);
      if (error || !page || page.length === 0) break;
      allSeats.push(...page);
      if (page.length < 1000) break;
    }

    const matched = [];
    for (const key of seatList) {
      const seat = allSeats.find((s) => seatMatchesKey(s, key));
      if (!seat) {
        return NextResponse.json(
          { success: false, code: "SEAT_NOT_FOUND", error: `Seat ${key} is no longer available.` },
          { status: 409 }
        );
      }
      const st = String(seat.status || "available").toLowerCase();
      if (st === "booked" || st === "sold" || st === "locked") {
        return NextResponse.json(
          {
            success: false,
            code: "SEAT_COLLISION",
            error: `Seat ${seat.seat_label || key} has just been booked. Please select another seat.`,
          },
          { status: 409 }
        );
      }
      if (
        st === "reserved" &&
        seat.reserved_by &&
        parseHold(seat.reserved_by).sessionId !== sessionId &&
        isHoldFreshValue(seat.reserved_by, seat.reserved_at)
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "SEAT_ALREADY_RESERVED",
            error: `Seat ${seat.seat_label || key} is held by another customer.`,
          },
          { status: 409 }
        );
      }
      matched.push(seat);
    }

    const expiresAt = Date.now() + PAYMENT_WINDOW_MS;
    const reservationId = newReservationId();
    const holdValue = buildPaymentHold(sessionId, reservationId, expiresAt);
    const nowIso = new Date().toISOString();
    const claimed = [];

    for (const seat of matched) {
      let q = supabaseAdmin
        .from("seats")
        .update({
          status: "reserved",
          reserved_at: nowIso,
          reserved_by: holdValue,
          updated_at: nowIso,
        })
        .eq("id", seat.id)
        .in("status", ["available", "reserved"]);
      q = applyOwnershipFilter(q, seat.reserved_by, seat.reserved_at);
      const { data: updated } = await q.select("id");

      if (!updated || updated.length === 0) {
        // Lost the race for this seat — give back whatever we already claimed
        for (const done of claimed) {
          await supabaseAdmin
            .from("seats")
            .update({ status: "available", reserved_at: null, reserved_by: null, updated_at: new Date().toISOString() })
            .eq("id", done);
        }
        return NextResponse.json(
          {
            success: false,
            code: "SEAT_ALREADY_RESERVED",
            error: "This seat has just been reserved by another customer. Please select another seat.",
          },
          { status: 409 }
        );
      }
      claimed.push(seat.id);
    }

    for (const seat of matched) {
      await serverBroadcastSeatChange(eventId, {
        eventType: "UPDATE",
        new: { ...seat, status: "reserved", reserved_at: nowIso, reserved_by: holdValue },
        eventId,
      });
    }

    return NextResponse.json({
      success: true,
      reservationId,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresAtMs: expiresAt,
      remainingMs: PAYMENT_WINDOW_MS,
      windowMs: PAYMENT_WINDOW_MS,
      seats: matched.map((s) => s.seat_id || s.id),
      atomic: false,
      ...paymentMode,
    });
  } catch (err) {
    console.error("API /api/reservation/create error:", err);
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", error: err?.message || "Could not start the payment reservation." },
      { status: 500 }
    );
  }
}
