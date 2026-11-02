import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";

export async function GET(request) {
  return handleCleanup(request);
}

export async function POST(request) {
  return handleCleanup(request);
}

async function handleCleanup(request) {
  try {
    const { searchParams } = new URL(request.url);
    let eventId = searchParams.get("eventId") || "";

    if (!eventId && request.method === "POST") {
      try {
        const body = await request.json();
        eventId = body?.eventId || "";
      } catch (e) {}
    }

    const cleanEvent = String(eventId || "").trim();

    // 1. Try atomic PostgreSQL RPC release_expired_seat_holds
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "release_expired_seat_holds",
        cleanEvent ? { p_event_id: cleanEvent } : {}
      );

      if (!rpcError && rpcData?.success) {
        if (cleanEvent && rpcData.released_count > 0) {
          serverBroadcastSeatChange(cleanEvent, {
            eventType: "SWEEP",
            releasedCount: rpcData.released_count,
            eventId: cleanEvent,
          });
        }
        return NextResponse.json(rpcData);
      }
    } catch (rpcEx) {}

    // 2. Fallback: Concurrency-safe server-side sweep
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    let query = supabaseAdmin
      .from("seats")
      .update({
        status: "available",
        reserved_at: null,
        reserved_by: null,
        updated_at: nowIso,
      })
      .eq("status", "reserved")
      .or(`reserved_at.lt.${tenMinutesAgo},reserved_at.is.null`);

    if (cleanEvent) {
      query = query.eq("event_id", cleanEvent);
    }

    const { data: releasedSeats, error: updateError } = await query.select();

    if (updateError) {
      console.warn("Cleanup expired holds error:", updateError.message);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const releasedCount = Array.isArray(releasedSeats) ? releasedSeats.length : 0;

    // Broadcast individual released seats if any were updated
    if (releasedCount > 0 && Array.isArray(releasedSeats)) {
      for (const seat of releasedSeats) {
        const targetEvent = seat.event_id || cleanEvent;
        if (targetEvent) {
          serverBroadcastSeatChange(targetEvent, {
            eventType: "UPDATE",
            new: seat,
            eventId: targetEvent,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      releasedCount,
      eventId: cleanEvent || "all",
      sweptAt: nowIso,
    });
  } catch (err) {
    console.error("API /api/seats/cleanup error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error sweeping expired seats" },
      { status: 500 }
    );
  }
}
