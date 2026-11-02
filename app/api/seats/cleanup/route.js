import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";
import { isHoldFreshValue } from "@/lib/reservation";

/**
 * Payment reservations carry their deadline inside `reserved_by`, so the sweep
 * has to read those rows and compare against server time. Selection holds are
 * still released with the plain 10 minute time filter.
 */
async function releaseExpiredPaymentHolds(cleanEvent) {
  let query = supabaseAdmin
    .from("seats")
    .select("id, event_id, reserved_by, reserved_at")
    .eq("status", "reserved")
    .like("reserved_by", "*|r:*")
    .limit(1000);
  if (cleanEvent) query = query.eq("event_id", cleanEvent);

  const { data: paymentHolds, error } = await query;
  if (error || !Array.isArray(paymentHolds) || paymentHolds.length === 0) return [];

  const now = Date.now();
  const expiredIds = paymentHolds
    .filter((h) => !isHoldFreshValue(h.reserved_by, h.reserved_at, now))
    .map((h) => h.id);
  if (expiredIds.length === 0) return [];

  const { data: released, error: releaseErr } = await supabaseAdmin
    .from("seats")
    .update({
      status: "available",
      reserved_at: null,
      reserved_by: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", expiredIds)
    .eq("status", "reserved")
    .select();
  if (releaseErr) {
    console.warn("Expired payment hold sweep error:", releaseErr.message);
    return [];
  }
  return Array.isArray(released) ? released : [];
}

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

    // 0. Payment holds carry their own deadline inside `reserved_by`; neither the
    //    10-minute RPC nor the time filter can see them, so sweep them here first.
    const expiredPaymentSeats = await releaseExpiredPaymentHolds(cleanEvent);
    for (const seat of expiredPaymentSeats) {
      const targetEvent = seat.event_id || cleanEvent;
      if (targetEvent) {
        serverBroadcastSeatChange(targetEvent, {
          eventType: "UPDATE",
          new: seat,
          eventId: targetEvent,
        });
      }
    }

    // 1. Try atomic PostgreSQL RPC release_expired_seat_holds
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "release_expired_seat_holds",
        cleanEvent ? { p_event_id: cleanEvent } : {}
      );

      if (!rpcError && rpcData?.success) {
        rpcData.released_count = (Number(rpcData.released_count) || 0) + expiredPaymentSeats.length;
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

    const paymentIds = new Set(expiredPaymentSeats.map((s) => s.id));
    const selectionReleases = Array.isArray(releasedSeats)
      ? releasedSeats.filter((s) => !paymentIds.has(s.id))
      : [];
    const releasedCount = paymentIds.size + selectionReleases.length;

    // Broadcast the 10-minute selection releases; payment holds were broadcast above
    for (const seat of selectionReleases) {
      const targetEvent = seat.event_id || cleanEvent;
      if (targetEvent) {
        serverBroadcastSeatChange(targetEvent, {
          eventType: "UPDATE",
          new: seat,
          eventId: targetEvent,
        });
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
