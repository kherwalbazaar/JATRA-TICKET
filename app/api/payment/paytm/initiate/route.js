import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { initiatePaytmTransaction } from "@/lib/server/paytm";
import { calculateCustomerCharges } from "@/lib/pricing";

function isHoldFresh(reservedAt) {
  if (!reservedAt) return false;
  const at = Date.parse(reservedAt);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < 10 * 60 * 1000;
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
    } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 }
      );
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

    // 2. Concurrency Safety: Check seat availability in Supabase seats table
    const { data: existingSeats, error: seatReadErr } = await supabaseAdmin
      .from("seats")
      .select("*")
      .eq("event_id", eventId);

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
            matched.reserved_by !== holdSessionId &&
            isHoldFresh(matched.reserved_at);

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

    // 3. Server-side Pricing Calculation (Tamper-proof)
    const unitPrice = Number(seatPrice) || 100;
    const rawTicketAmount = unitPrice * seatList.length;
    const pricing = calculateCustomerCharges(rawTicketAmount);
    const finalAmount = pricing.finalCustomerAmount;

    // 4. Unique Order ID & Sequential Ticket Number
    const orderId = `JB_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const ticketNumber = await getNextTicketNumber();
    const nowIso = new Date().toISOString();

    const bookingDate = date || new Date().toISOString().slice(0, 10);
    const bookingTime = time || "11:00 PM";
    const resolvedEventName = eventName || "Jatra Show";

    // 5. Create Pending Booking in Supabase (NO tickets created yet!)
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
      source: "Online",
      payment_method: "UPI",
      payment_channel: "Online",
      status: "Pending",
      booking_status: "Pending",
      payment_status: "Pending",
      date: bookingDate,
      time: bookingTime,
      block: cleanBlock || null,
      seats: seatList,
      seat_number: seatList.join(", "),
      seat_count: seatList.length,
      entered_count: 0,
      remaining_count: seatList.length,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .insert([bookingRow]);

    if (bookingErr) {
      console.error("Failed to insert pending booking in Supabase:", bookingErr.message);
      return NextResponse.json(
        { success: false, error: `Failed to initiate booking: ${bookingErr.message}` },
        { status: 500 }
      );
    }

    // 6. Hold seats for this order in Supabase
    for (const seatKey of seatList) {
      const cleanKey = String(seatKey).trim();
      await supabaseAdmin
        .from("seats")
        .update({
          status: "reserved",
          reserved_at: nowIso,
          reserved_by: orderId,
          updated_at: nowIso,
        })
        .eq("event_id", eventId)
        .or(`id.eq.${cleanKey},seat_label.eq.${cleanKey}`);
    }

    // 7. Initiate Paytm Transaction
    const paytmResult = await initiatePaytmTransaction({
      orderId,
      amount: finalAmount,
      customerId: `CUST_${customerPhone.replace(/\D/g, "").slice(-10) || orderId}`,
      mobile: customerPhone,
      email: customerEmail,
    });

    return NextResponse.json({
      success: true,
      orderId,
      ticketNumber,
      amount: finalAmount,
      pricing,
      txnToken: paytmResult.txnToken,
      mid: paytmResult.mid,
      gatewayUrl: paytmResult.gatewayUrl,
      formParams: paytmResult.formParams,
      callbackUrl: paytmResult.callbackUrl,
      isSimulator: paytmResult.isSimulator,
      simulatorUrl: paytmResult.simulatorUrl,
    });
  } catch (err) {
    console.error("API /api/payment/paytm/initiate error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to initiate payment." },
      { status: 500 }
    );
  }
}
