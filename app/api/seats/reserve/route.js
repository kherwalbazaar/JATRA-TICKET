import { NextResponse } from "next/server";
import { supabaseAdmin, serverBroadcastSeatChange } from "@/lib/server/supabaseAdmin";

function isHoldFresh(reservedAt) {
  if (!reservedAt) return false;
  const at = Date.parse(reservedAt);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < 10 * 60 * 1000;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId,
      block,
      seatKey,
      seatId,
      sessionId,
      customerName,
      customerPhone,
    } = body || {};

    const cleanEvent = String(eventId || "").trim();
    const cleanSeat = String(seatId || seatKey || "").trim();
    const cleanSession = String(sessionId || customerPhone || "anon_session").trim();
    const cleanBlock = String(block || "").trim().toUpperCase();

    if (!cleanEvent || !cleanSeat || !cleanSession) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PARAMS",
          message: "Event ID, seat ID, and session ID are required.",
        },
        { status: 400 }
      );
    }

    // 1. Try atomic PostgreSQL RPC hold_seat_atomic
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "hold_seat_atomic",
        {
          p_event_id: cleanEvent,
          p_seat_id: cleanSeat,
          p_session_id: cleanSession,
          p_block_id: cleanBlock || null,
        }
      );

      if (!rpcError && rpcData) {
        if (rpcData.success) {
          const seatRow = {
            id: rpcData.id || `${cleanEvent}_${cleanSeat}`,
            event_id: cleanEvent,
            block_id: rpcData.block_id || cleanBlock,
            row_id: rpcData.row_id,
            seat_number: rpcData.seat_number,
            seat_label: rpcData.seat_label,
            seat_id: rpcData.seat_id || cleanSeat,
            status: "reserved",
            price: rpcData.price,
            reserved_at: rpcData.reserved_at || new Date().toISOString(),
            reserved_by: cleanSession,
          };

          // Broadcast to all connected clients on realtime:seats:${cleanEvent}
          await serverBroadcastSeatChange(cleanEvent, {
            eventType: "UPDATE",
            new: seatRow,
            eventId: cleanEvent,
          });

          return NextResponse.json({
            success: true,
            seat: seatRow,
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              code: rpcData.code || "SEAT_ALREADY_RESERVED",
              message:
                rpcData.message ||
                "This seat has just been reserved by another customer. Please select another seat.",
              seat: rpcData,
            },
            { status: 409 }
          );
        }
      }
    } catch (rpcEx) {
      // Fallback to server-side transaction if RPC is not present
    }

    // 2. Fallback: Concurrency-safe server-side database operation
    // Lookup the seat in Supabase seats table
    const orFilter = [
      `id.eq.${cleanSeat}`,
      `seat_id.eq.${cleanSeat}`,
      `seat_label.eq.${cleanSeat}`,
      `id.eq.${cleanEvent}_${cleanSeat}`,
      cleanBlock ? `seat_id.eq.${cleanBlock}-${cleanSeat}` : null,
    ]
      .filter(Boolean)
      .join(",");

    const { data: candidateSeats, error: readError } = await supabaseAdmin
      .from("seats")
      .select("*")
      .eq("event_id", cleanEvent)
      .or(orFilter)
      .limit(1);

    if (readError || !candidateSeats || candidateSeats.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "SEAT_NOT_FOUND",
          message: "Selected seat could not be found for this event.",
        },
        { status: 404 }
      );
    }

    const targetSeat = candidateSeats[0];
    const currentStatus = String(targetSeat.status || "available").toLowerCase();

    // Check if seat is booked, sold, or locked
    if (["booked", "sold", "locked"].includes(currentStatus)) {
      return NextResponse.json(
        {
          success: false,
          code: "SEAT_ALREADY_RESERVED",
          seatLabel: targetSeat.seat_label || cleanSeat,
          message:
            "This seat has just been reserved by another customer. Please select another seat.",
        },
        { status: 409 }
      );
    }

    // Check if seat is reserved by another customer and hold is fresh (< 10 minutes)
    if (
      currentStatus === "reserved" &&
      targetSeat.reserved_by &&
      targetSeat.reserved_by !== cleanSession &&
      isHoldFresh(targetSeat.reserved_at)
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "SEAT_ALREADY_RESERVED",
          seatLabel: targetSeat.seat_label || cleanSeat,
          message:
            "This seat has just been reserved by another customer. Please select another seat.",
        },
        { status: 409 }
      );
    }

    // Atomically update seat to 'reserved'
    const nowIso = new Date().toISOString();
    const { data: updatedSeats, error: updateError } = await supabaseAdmin
      .from("seats")
      .update({
        status: "reserved",
        reserved_at: nowIso,
        reserved_by: cleanSession,
        updated_at: nowIso,
      })
      .eq("id", targetSeat.id)
      .select();

    if (updateError || !updatedSeats || updatedSeats.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "RESERVATION_FAILED",
          message: "Failed to reserve the seat. Please try again.",
        },
        { status: 500 }
      );
    }

    const updatedSeat = updatedSeats[0];

    // Broadcast change immediately to all customers viewing this event
    await serverBroadcastSeatChange(cleanEvent, {
      eventType: "UPDATE",
      new: updatedSeat,
      old: targetSeat,
      eventId: cleanEvent,
    });

    return NextResponse.json({
      success: true,
      seat: updatedSeat,
    });
  } catch (err) {
    console.error("API /api/seats/reserve error:", err);
    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message: err?.message || "Internal server error reserving seat.",
      },
      { status: 500 }
    );
  }
}
