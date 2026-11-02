import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";
import { holdSessionId } from "@/lib/reservation";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId,
      block,
      seatKey,
      seatId,
      sessionId,
    } = body || {};

    const cleanEvent = String(eventId || "").trim();
    const cleanSeat = String(seatId || seatKey || "").trim();
    const cleanSession = String(sessionId || "").trim();
    const cleanBlock = String(block || "").trim().toUpperCase();

    if (!cleanEvent || !cleanSeat) {
      return NextResponse.json(
        { success: false, message: "eventId and seatKey are required" },
        { status: 400 }
      );
    }

    // 1. Try atomic PostgreSQL RPC release_seat_atomic
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "release_seat_atomic",
        {
          p_event_id: cleanEvent,
          p_seat_id: cleanSeat,
          p_session_id: cleanSession,
          p_block_id: cleanBlock || null,
        }
      );

      if (!rpcError && rpcData) {
        if (rpcData.success && rpcData.released) {
          const releasedSeat = {
            id: rpcData.id || `${cleanEvent}_${cleanSeat}`,
            event_id: cleanEvent,
            block_id: cleanBlock,
            seat_id: rpcData.seat_id || cleanSeat,
            seat_label: rpcData.seat_label,
            status: "available",
            reserved_at: null,
            reserved_by: null,
            updated_at: new Date().toISOString(),
          };

          await serverBroadcastSeatChange(cleanEvent, {
            eventType: "UPDATE",
            new: releasedSeat,
            eventId: cleanEvent,
          });

          return NextResponse.json({ success: true, seat: releasedSeat });
        }

        if (rpcData.code === "NOT_OWNER") {
          return NextResponse.json(
            {
              success: false,
              code: "NOT_OWNER",
              message: "You cannot release a seat reserved by another customer",
            },
            { status: 403 }
          );
        }

        if (rpcData.code === "SEAT_ALREADY_BOOKED") {
          return NextResponse.json(
            {
              success: false,
              code: "SEAT_ALREADY_BOOKED",
              message: "Cannot release a confirmed booking",
            },
            { status: 409 }
          );
        }
      }
    } catch (rpcEx) {
      // Fallback to server-side query
    }

    // 2. Fallback: Concurrency-safe server-side database release
    const orFilter = [
      `id.eq.${cleanSeat}`,
      `seat_id.eq.${cleanSeat}`,
      `seat_label.eq.${cleanSeat}`,
      `id.eq.${cleanEvent}_${cleanSeat}`,
      cleanBlock ? `seat_id.eq.${cleanBlock}-${cleanSeat}` : null,
    ]
      .filter(Boolean)
      .join(",");

    const { data: seats, error: findError } = await supabaseAdmin
      .from("seats")
      .select("*")
      .eq("event_id", cleanEvent)
      .or(orFilter)
      .limit(1);

    if (findError || !seats || seats.length === 0) {
      return NextResponse.json({ success: true, message: "Seat not found, nothing to release" });
    }

    const targetSeat = seats[0];

    // Only release if currently 'reserved' (never overwrite 'booked' or 'sold')
    if (targetSeat.status === "reserved") {
      const ownerSession = holdSessionId(targetSeat.reserved_by);
      if (ownerSession === cleanSession) {
        const nowIso = new Date().toISOString();
        const { data: updatedSeats, error: updateError } = await supabaseAdmin
          .from("seats")
          .update({
            status: "available",
            reserved_at: null,
            reserved_by: null,
            updated_at: nowIso,
          })
          .eq("id", targetSeat.id)
          .select();

        if (!updateError && updatedSeats && updatedSeats[0]) {
          const releasedSeat = updatedSeats[0];
          await serverBroadcastSeatChange(cleanEvent, {
            eventType: "UPDATE",
            new: releasedSeat,
            old: targetSeat,
            eventId: cleanEvent,
          });

          return NextResponse.json({ success: true, seat: releasedSeat });
        }
      } else if (ownerSession !== cleanSession) {
        return NextResponse.json(
          {
            success: false,
            code: "NOT_OWNER",
            message: "You cannot release a seat reserved by another customer",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, message: "No active reservation to release" });
  } catch (err) {
    console.error("API /api/seats/release error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Internal server error releasing seat" },
      { status: 500 }
    );
  }
}
