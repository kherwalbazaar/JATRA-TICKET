import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";
import { holdSessionId, parseHold, seatMatchesKey } from "@/lib/reservation";

/**
 * Authoritative countdown clock. The deadline is read out of the seat rows, so
 * the remaining time survives a refresh, a tab close, or an app restart.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = String(searchParams.get("eventId") || "").trim();
    const reservationId = String(searchParams.get("reservationId") || "").trim();
    const sessionId = String(searchParams.get("sessionId") || "").trim();
    const seatKeys = String(searchParams.get("seats") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!eventId || !reservationId) {
      return NextResponse.json(
        { success: false, error: "eventId and reservationId are required." },
        { status: 400 }
      );
    }

    // Preferred path: database function (supabase/012 migration)
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("reservation_status", {
        p_reservation_id: reservationId,
        p_event_id: eventId,
      });
      if (!rpcError && rpcData?.success) {
        return NextResponse.json({
          success: true,
          status: rpcData.status,
          reservationId,
          expiresAt: rpcData.expires_at,
          remainingMs: Number(rpcData.remaining_ms) || 0,
          seats: rpcData.seats || [],
          paymentStatus: rpcData.payment_status || null,
          atomic: true,
        });
      }
    } catch (rpcEx) {
      // Fall through to the row-level path
    }

    const { data: heldSeats, error: readError } = await supabaseAdmin
      .from("seats")
      .select("id, event_id, seat_id, seat_label, status, reserved_at, reserved_by")
      .eq("event_id", eventId)
      .like("reserved_by", `*|r:${reservationId}|*`)
      .limit(1000);

    if (readError) {
      return NextResponse.json(
        { success: false, error: readError.message },
        { status: 500 }
      );
    }

    const rows = Array.isArray(heldSeats) ? heldSeats : [];

    if (sessionId && rows.length > 0) {
      const owner = holdSessionId(rows[0].reserved_by);
      if (owner && owner !== sessionId) {
        return NextResponse.json(
          { success: false, code: "NOT_OWNER", status: "forbidden" },
          { status: 403 }
        );
      }
    }

    if (rows.length > 0) {
      const deadlines = rows
        .map((r) => parseHold(r.reserved_by).expiresAt)
        .filter(Boolean);
      const expiresAtMs = deadlines.length ? Math.min(...deadlines) : Date.now();
      const remainingMs = Math.max(0, expiresAtMs - Date.now());

      if (remainingMs > 0) {
        return NextResponse.json({
          success: true,
          status: "active",
          reservationId,
          expiresAt: new Date(expiresAtMs).toISOString(),
          remainingMs,
          seats: rows.map((r) => r.seat_id || r.seat_label || r.id),
        });
      }

      // Window elapsed: release on the server, whatever the browser was doing
      const nowIso = new Date().toISOString();
      const { data: released } = await supabaseAdmin
        .from("seats")
        .update({ status: "available", reserved_at: null, reserved_by: null, updated_at: nowIso })
        .in("id", rows.map((r) => r.id))
        .eq("status", "reserved")
        .select();

      for (const seat of released || []) {
        await serverBroadcastSeatChange(eventId, { eventType: "UPDATE", new: seat, eventId });
      }

      return NextResponse.json({
        success: true,
        status: "expired",
        reservationId,
        expiresAt: new Date(expiresAtMs).toISOString(),
        remainingMs: 0,
        releasedCount: (released || []).length,
        seats: rows.map((r) => r.seat_id || r.seat_label || r.id),
      });
    }

    // No live hold: was the booking committed, or were the seats already given back?
    if (seatKeys.length > 0) {
      const { data: eventSeats } = await supabaseAdmin
        .from("seats")
        .select("seat_id, seat_label, status, booking_id")
        .eq("event_id", eventId)
        .in("status", ["booked", "sold"])
        .limit(1000);
      const booked = Array.isArray(eventSeats) ? eventSeats : [];
      const allBooked = seatKeys.every((key) =>
        booked.some((s) => seatMatchesKey(s, key))
      );
      if (allBooked) {
        return NextResponse.json({
          success: true,
          status: "confirmed",
          reservationId,
          remainingMs: 0,
          seats: seatKeys,
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: "released",
      reservationId,
      remainingMs: 0,
      seats: [],
    });
  } catch (err) {
    console.error("API /api/reservation/status error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not read reservation status." },
      { status: 500 }
    );
  }
}
