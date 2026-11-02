import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";
import { holdSessionId, seatMatchesKey } from "@/lib/reservation";

/**
 * Give back every seat of a reservation (or of this session's selection holds).
 * Seats that already turned into a real booking are never touched.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = String(body?.eventId || "").trim();
    const reservationId = String(body?.reservationId || "").trim();
    const sessionId = String(body?.sessionId || "").trim();
    const seatList = Array.isArray(body?.seats) ? body.seats.filter(Boolean) : [];

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required." },
        { status: 400 }
      );
    }

    if (reservationId) {
      try {
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
          "release_reservation_atomic",
          {
            p_reservation_id: reservationId,
            p_event_id: eventId,
            p_session_id: sessionId || null,
          }
        );
        if (!rpcError && rpcData?.success) {
          await serverBroadcastSeatChange(eventId, { eventType: "SWEEP", eventId });
          return NextResponse.json({
            success: true,
            released: Number(rpcData.released_count) || 0,
            atomic: true,
          });
        }
      } catch (rpcEx) {
        // Fall through to the row-level path
      }
    }

    let query = supabaseAdmin
      .from("seats")
      .select("id, event_id, seat_id, seat_label, status, reserved_at, reserved_by")
      .eq("event_id", eventId)
      .eq("status", "reserved")
      .limit(1000);

    if (reservationId) {
      query = query.like("reserved_by", `*|r:${reservationId}|*`);
    }

    const { data: candidates, error: readError } = await query;
    if (readError) {
      return NextResponse.json({ success: false, error: readError.message }, { status: 500 });
    }

    let rows = Array.isArray(candidates) ? candidates : [];
    if (!reservationId && sessionId) {
      rows = rows.filter((s) => holdSessionId(s.reserved_by) === sessionId);
    }
    if (seatList.length > 0) {
      rows = rows.filter((s) => seatList.some((k) => seatMatchesKey(s, k)));
    }
    if (sessionId && reservationId) {
      const foreign = rows.filter((s) => holdSessionId(s.reserved_by) !== sessionId);
      if (foreign.length > 0) {
        return NextResponse.json(
          { success: false, code: "NOT_OWNER", error: "This reservation belongs to another session." },
          { status: 403 }
        );
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: true, released: 0 });
    }

    const nowIso = new Date().toISOString();
    const { data: released } = await supabaseAdmin
      .from("seats")
      .update({ status: "available", reserved_at: null, reserved_by: null, updated_at: nowIso })
      .in("id", rows.map((s) => s.id))
      .eq("status", "reserved")
      .select();

    for (const seat of released || []) {
      await serverBroadcastSeatChange(eventId, { eventType: "UPDATE", new: seat, eventId });
    }

    return NextResponse.json({
      success: true,
      released: (released || []).length,
      seats: (released || []).map((s) => s.seat_id || s.seat_label || s.id),
    });
  } catch (err) {
    console.error("API /api/reservation/cancel error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not release the reservation." },
      { status: 500 }
    );
  }
}
