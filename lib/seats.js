import { calculateCustomerCharges } from "./pricing.js";
import { resolveCanonicalPaymentMethod } from "./paymentMethods.js";
import {
  supabase,
  sbFetchSeats,
  subscribeRealtimeSeats,
  sbHoldSeat,
  sbReleaseSeatHold,
  sbReleaseExpiredHolds,
  sbSaveBooking,
} from "./supabase.js";
import { nextTicketNumber, generateQrToken } from "./bookings.js";
import { getPriceForRow } from "./ticketTypes.js";
import {
  holdSessionId,
  isHoldFreshValue,
} from "./reservation.js";

export { holdSessionId, isHoldFreshValue } from "./reservation.js";

// Block definitions for the venue
const BLOCK_GROUPS = {
  rightSide: ["A1", "A2", "A3"],
  frontCenter: ["B1", "B2", "B3"],
  leftSide: ["C1", "C2", "C3"],
};

const BLOCK_SEATS = {
  A1: generateRows(8, 10),
  A2: generateRows(6, 8),
  A3: generateRows(5, 6),
  B1: generateRows(8, 15),
  B2: generateRows(6, 12),
  B3: generateRows(6, 10),
  C1: generateRows(8, 12),
  C2: generateRows(6, 8),
  C3: generateRows(5, 6),
};

function generateRows(count, startSeats) {
  return Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    count: startSeats + i,
  }));
}

// Generate B block seats with continuous alphabet
function generateBBlockSeats() {
  const seats = {};
  let currentLetter = 0;
  const b1Rows = Array.isArray(BLOCK_SEATS?.B1) ? BLOCK_SEATS.B1 : [];
  const b2Rows = Array.isArray(BLOCK_SEATS?.B2) ? BLOCK_SEATS.B2 : [];
  const b3Rows = Array.isArray(BLOCK_SEATS?.B3) ? BLOCK_SEATS.B3 : [];

  // Generate B1 seats (RIGHT → LEFT)
  seats.B1 = [];
  for (let i = 0; i < b1Rows.length; i++) {
    const row = b1Rows[i];
    const seatsInRow = [];
    for (let j = 0; j < row.count; j++) {
      const letter = String.fromCharCode(65 + (currentLetter % 26));
      seatsInRow.push({
        letter: letter,
        number: j + 1,
        displayIndex: row.count - 1 - j,
        seatId: `${letter}${j + 1}`,
      });
      currentLetter++;
    }
    seats.B1.push(seatsInRow);
  }

  // Generate B2 seats (RIGHT → LEFT, continues alphabet)
  seats.B2 = [];
  for (let i = 0; i < b2Rows.length; i++) {
    const row = b2Rows[i];
    const seatsInRow = [];
    for (let j = 0; j < row.count; j++) {
      const letter = String.fromCharCode(65 + (currentLetter % 26));
      seatsInRow.push({
        letter: letter,
        number: j + 1,
        displayIndex: row.count - 1 - j,
        seatId: `${letter}${j + 1}`,
      });
      currentLetter++;
    }
    seats.B2.push(seatsInRow);
  }

  // Generate B3 seats (LEFT → RIGHT, continues alphabet)
  seats.B3 = [];
  for (let i = 0; i < b3Rows.length; i++) {
    const row = b3Rows[i];
    const seatsInRow = [];
    for (let j = 0; j < row.count; j++) {
      const letter = String.fromCharCode(65 + (currentLetter % 26));
      seatsInRow.push({
        letter: letter,
        number: j + 1,
        displayIndex: j,
        seatId: `${letter}${j + 1}`,
      });
      currentLetter++;
    }
    seats.B3.push(seatsInRow);
  }

  return seats;
}

/**
 * Admin batch seat creation function targeting Supabase seats table.
 */
export async function storeAllSeats(showId) {
  const targetId = String(showId || "").trim();
  if (!targetId) throw new Error("storeAllSeats: showId is required");

  // Safeguard: never overwrite or inject fake seats if seats already exist in database
  const { data: existing } = await supabase
    .from("seats")
    .select("id")
    .eq("event_id", targetId)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`Real seats already exist for event ${targetId}, aborting generator to preserve real database rows.`);
    return existing.length;
  }

  const bBlockSeats = generateBBlockSeats();
  const seatsToStore = [];

  // Prepare regular blocks (A1, A2, A3, C1, C2, C3)
  for (const [blockId, rows] of Object.entries(BLOCK_SEATS)) {
    if (["B1", "B2", "B3"].includes(blockId)) continue;

    for (const row of rows) {
      for (let seatNum = 1; seatNum <= row.count; seatNum++) {
        const docId = `${blockId}-${row.id}-${seatNum}`;
        seatsToStore.push({
          id: docId,
          seat_id: docId,
          show_id: targetId,
          event_id: targetId,
          block: blockId,
          block_id: blockId,
          row: row.id,
          row_id: row.id,
          seat_number: seatNum,
          seat_label: `${row.id}${seatNum}`,
          status: "available",
          price: getPriceForRow(row.id),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  // Prepare B blocks (B1, B2, B3)
  for (const blockId of ["B1", "B2", "B3"]) {
    const blockData = bBlockSeats[blockId];
    if (!blockData) continue;

    for (const row of blockData) {
      for (const seat of row) {
        const docId = `${blockId}-${seat.letter}-${seat.number}`;
        seatsToStore.push({
          id: docId,
          seat_id: docId,
          show_id: targetId,
          event_id: targetId,
          block: blockId,
          block_id: blockId,
          row: seat.letter,
          row_id: seat.letter,
          seat_number: seat.number,
          seat_label: seat.seatId,
          status: "available",
          price: getPriceForRow(seat.letter),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < seatsToStore.length; i += CHUNK_SIZE) {
    const chunk = seatsToStore.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("seats").upsert(chunk);
    if (error) {
      console.warn("storeAllSeats chunk upsert warning:", error.message);
    }
  }

  console.log(`Stored ${seatsToStore.length} seats to Supabase seats table`);
  return seatsToStore.length;
}

function normalizeSbSeat(row, targetId) {
  if (!row) return null;
  const block = String(row.block_id || row.block || "").toUpperCase();
  const rowId = String(row.row_id || row.row || "").toUpperCase();
  const seatNum = Number(row.seat_number || row.number || 0);
  const seatLabel = row.seat_label || (rowId && seatNum ? `${rowId}${seatNum}` : row.id);
  let docId = row.seat_id || (block && rowId && seatNum ? `${block}-${rowId}-${seatNum}` : null);
  if (!docId && row.id) {
    docId = row.id.includes('_') ? row.id.split('_').slice(1).join('_') : row.id;
  }
  if (!docId) docId = row.id;

  const rawStatus = String(row.status || "available").toLowerCase();
  const status = rawStatus;

  return {
    id: docId,
    seatId: docId,
    rawId: row.id,
    showId: targetId || row.event_id || row.show_id,
    eventId: targetId || row.event_id || row.show_id,
    block,
    blockId: block,
    row: rowId,
    rowId,
    seatNumber: seatNum,
    seatLabel,
    status,
    price:
      row.price != null && !isNaN(Number(row.price)) && Number(row.price) > 0
        ? Number(row.price)
        : getPriceForRow(rowId),
    bookedAt: row.booked_at || null,
    bookingId: row.booking_id || null,
    reservedAt: row.reserved_at || null,
    reservedBy: row.reserved_by || null,
    displayIndex: row.display_index ?? seatNum,
  };
}

/**
 * Fetch all seats for a show from Supabase.
 */
export async function fetchSeats(showId) {
  const targetId = String(showId || "").trim();
  if (!targetId) return {};

  const seatsByBlock = {};
  try {
    const rows = await sbFetchSeats(targetId);
    if (Array.isArray(rows)) {
      const seenSeat = new Set();
      rows.forEach((r) => {
        const s = normalizeSbSeat(r, targetId);
        if (!s || !s.block) return;
        const identity = s.id || s.rawId;
        if (identity) {
          if (seenSeat.has(identity)) return;
          seenSeat.add(identity);
        }
        if (!seatsByBlock[s.block]) seatsByBlock[s.block] = [];
        seatsByBlock[s.block].push(s);
      });

      // Sort seats within each block
      Object.keys(seatsByBlock).forEach((b) => {
        seatsByBlock[b].sort(
          (s1, s2) =>
            (s1.displayIndex ?? s1.seatNumber ?? 0) -
            (s2.displayIndex ?? s2.seatNumber ?? 0)
        );
      });
    }
  } catch (err) {
    console.warn("fetchSeats Supabase error:", err?.message);
  }

  return seatsByBlock;
}

/**
 * Fetch real seats for a specific block directly from Supabase.
 */
export async function fetchSeatsByBlock(showId, blockId) {
  const targetId = String(showId || "").trim();
  const cleanBlock = String(blockId || "").trim().toUpperCase();
  if (!targetId || !cleanBlock) return [];
  try {
    const { data, error } = await supabase
      .from("seats")
      .select("*")
      .eq("event_id", targetId)
      .eq("block_id", cleanBlock)
      .order("seat_number", { ascending: true });
    if (error) {
      console.warn("fetchSeatsByBlock error:", error.message);
      return [];
    }
    return (data || []).map((r) => normalizeSbSeat(r, targetId)).filter(Boolean);
  } catch (err) {
    console.warn("fetchSeatsByBlock exception:", err);
    return [];
  }
}

/**
 * Live Real-Time Seat Availability Subscription backed by Supabase.
 */
export function subscribeSeats(showId, callback, onError) {
  const targetId = String(showId || "").trim();
  if (!targetId) {
    callback({});
    return () => {};
  }

  let disposed = false;
  const seatsMap = new Map();

  const emit = () => {
    if (disposed) return;
    const seatsByBlock = {};
    const seenSeat = new Map();
    seatsMap.forEach((seat) => {
      const b = seat.block;
      if (!b) return;
      const identity = seat.id || seat.rawId;
      if (identity) {
        const previous = seenSeat.get(identity);
        if (previous) {
          // Same seat reached us twice: keep the fully-positioned copy so the
          // grid can never render two children under one React key.
          const better = seat.rowId && Number(seat.seatNumber) > 0;
          const wasBetter = previous.rowId && Number(previous.seatNumber) > 0;
          if (!better || wasBetter) return;
          const list = seatsByBlock[b];
          const at = list.indexOf(previous);
          if (at >= 0) {
            list[at] = seat;
            seenSeat.set(identity, seat);
          }
          return;
        }
        seenSeat.set(identity, seat);
      }
      if (!seatsByBlock[b]) seatsByBlock[b] = [];
      seatsByBlock[b].push(seat);
    });

    Object.keys(seatsByBlock).forEach((b) => {
      seatsByBlock[b].sort(
        (s1, s2) =>
          Number(s1.seatNumber || 0) - Number(s2.seatNumber || 0)
      );
    });

    callback(seatsByBlock);
  };

  // Helper to store normalized seat by consistent key.
  // A seat can be addressed by its document id, its raw Supabase row id or its
  // block/row/number position, so every one of those aliases is indexed against
  // a single map entry. Re-adding the same seat then updates in place instead of
  // creating a second entry, which is what produced duplicate React keys (and an
  // O(n²) identity scan over ~1.5k seats) in the old linear search.
  const aliasIndex = new Map(); // identity token -> seatsMap key
  const entryAliases = new Map(); // seatsMap key -> Set<token>

  const seatTokens = (s) => {
    const tokens = [];
    if (s.id) tokens.push(`id:${s.id}`);
    if (s.seatId) tokens.push(`seat:${s.seatId}`);
    if (s.rawId) tokens.push(`raw:${s.rawId}`);
    if (s.block && s.rowId && Number(s.seatNumber) > 0) {
      tokens.push(`pos:${s.block}-${s.rowId}-${Number(s.seatNumber)}`);
    }
    return tokens;
  };

  const forgetKey = (mapKey) => {
    seatsMap.delete(mapKey);
    const tokens = entryAliases.get(mapKey);
    if (tokens) {
      for (const t of tokens) {
        if (aliasIndex.get(t) === mapKey) aliasIndex.delete(t);
      }
    }
    entryAliases.delete(mapKey);
  };

  const setSeatInMap = (s) => {
    if (!s) return;
    const tokens = seatTokens(s);

    let mapKey = null;
    for (const t of tokens) {
      const hit = aliasIndex.get(t);
      if (hit !== undefined && seatsMap.has(hit)) {
        mapKey = hit;
        break;
      }
    }
    if (mapKey === null) {
      mapKey = s.id || s.rawId || `seat-${seatsMap.size}`;
    }

    seatsMap.set(mapKey, s);
    if (!entryAliases.has(mapKey)) entryAliases.set(mapKey, new Set());
    const known = entryAliases.get(mapKey);

    for (const t of tokens) {
      if (known.has(t)) continue;
      const stale = aliasIndex.get(t);
      if (stale !== undefined && stale !== mapKey) {
        const staleTokens = entryAliases.get(stale);
        if (staleTokens) staleTokens.delete(t);
      }
      aliasIndex.set(t, mapKey);
      known.add(t);
    }
  };

  // 1. Initial fetch from Supabase (sweep expired holds in background)
  sbReleaseExpiredHolds(targetId).catch(() => {});
  sbFetchSeats(targetId)
    .then((rows) => {
      if (disposed || !Array.isArray(rows)) return;
      rows.forEach((r) => {
        const s = normalizeSbSeat(r, targetId);
        if (s) {
          setSeatInMap(s);
        }
      });
      emit();
    })
    .catch((err) => {
      console.warn("subscribeSeats Supabase fetch warning:", err?.message);
    });

  // Periodic automatic expiry sweep every 30 seconds
  const sweepInterval = setInterval(() => {
    if (disposed) return;
    sbReleaseExpiredHolds(targetId)
      .then((count) => {
        if (count > 0) {
          // Re-evaluate seatsMap for any now-expired holds
          let modified = false;
          seatsMap.forEach((s, k) => {
            if (s.status === "reserved" && !isHoldFresh(s)) {
              seatsMap.set(k, { ...s, status: "available", reservedAt: null, reservedBy: null });
              modified = true;
            }
          });
          if (modified) emit();
        }
      })
      .catch(() => {});
  }, 30000);

  // 2. Supabase Realtime channel subscription (PostgreSQL changes & broadcast)
  const unsubRealtime = subscribeRealtimeSeats(targetId, (payload) => {
    if (disposed) return;
    const { eventType, new: newRow, old: oldRow } = payload || {};

    if (eventType === "SWEEP") {
      sbFetchSeats(targetId).then((rows) => {
        if (disposed || !Array.isArray(rows)) return;
        rows.forEach((r) => {
          const s = normalizeSbSeat(r, targetId);
          if (s) setSeatInMap(s);
        });
        emit();
      }).catch(() => {});
      return;
    }

    if (eventType === "DELETE" && oldRow) {
      const s = normalizeSbSeat(oldRow, targetId);
      if (s) {
        const doomed = new Set();
        for (const t of seatTokens(s)) {
          const hit = aliasIndex.get(t);
          if (hit !== undefined && seatsMap.has(hit)) doomed.add(hit);
        }
        doomed.forEach(forgetKey);
      }
    } else if (newRow) {
      const s = normalizeSbSeat(newRow, targetId);
      if (s) {
        setSeatInMap(s);
      }
    }
    emit();
  });

  return () => {
    disposed = true;
    clearInterval(sweepInterval);
    if (typeof unsubRealtime === "function") unsubRealtime();
  };
}

// Normalize seat key: "A9" | "A-9" -> "A-9"
export function toSeatDocId(seatKey) {
  const raw = String(seatKey || "").trim();
  if (!raw) return raw;
  if (raw.includes("-")) {
    const parts = raw.split("-");
    if (parts.length >= 2) {
      return `${parts[0].toUpperCase()}-${parts[1]}`;
    }
  }
  const m = raw.match(/^([A-Za-z]+)(\d+)$/);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  return raw;
}

export function getHoldSessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem("jatra:holdSession");
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem("jatra:holdSession", id);
    }
    return id;
  } catch (e) {
    return "";
  }
}

export function isHoldFresh(data) {
  if (!data) return false;
  return isHoldFreshValue(
    data.reservedBy || data.reserved_by,
    data.reservedAt || data.reserved_at
  );
}

function resolveSeatDocId(block, key) {
  const cleanBlock = String(block || "").trim().toUpperCase();
  const rawKey = String(key || "").trim();
  if (rawKey.includes("-") && rawKey.split("-").length >= 3) {
    return rawKey;
  }
  return cleanBlock ? `${cleanBlock}-${toSeatDocId(rawKey)}` : toSeatDocId(rawKey);
}

/**
 * Reserve a single seat in Supabase while the customer is selecting/checking out.
 * Returns { success: true, seat } or { success: false, code, message }.
 */
export async function holdSeat(showId, block, key) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) return { success: false, message: "Missing showId" };

  const cleanBlock = String(block || "").trim().toUpperCase();
  if (cleanBlock) {
    try {
      const { data: catData } = await supabase
        .from("block_categories")
        .select("online")
        .eq("id", cleanBlock)
        .maybeSingle();
      if (catData && catData.online === false) {
        return {
          success: false,
          code: "BLOCK_COUNTER_ONLY",
          message: "This block is available for counter booking only. Please select another block.",
        };
      }
    } catch (e) {
      /* ignore check errors in hold */
    }
  }

  const sessionId = getHoldSessionId();
  const docId = resolveSeatDocId(block, key);

  try {
    const res = await sbHoldSeat(targetShowId, docId, sessionId, { block: cleanBlock });
    return res;
  } catch (e) {
    console.warn("holdSeat warning:", e?.message);
    return {
      success: false,
      code: "SEAT_ALREADY_RESERVED",
      message: "This seat has just been reserved by another customer. Please select another seat.",
    };
  }
}

/**
 * Release a seat hold in Supabase.
 */
export async function releaseSeatHold(showId, block, key) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) return false;
  const sessionId = getHoldSessionId();
  const docId = resolveSeatDocId(block, key);

  try {
    await sbReleaseSeatHold(targetShowId, docId, sessionId, { block });
  } catch (e) {
    console.warn("releaseSeatHold warning:", e?.message);
  }

  return true;
}

/**
 * Concurrency Safety & Double-Booking Prevention:
 * Validates seat availability in Supabase and commits the booking atomically.
 */
export async function reserveSeatsTransaction({
  showId,
  block,
  seats = [],
  customerName = "Walk-in",
  customerPhone = "",
  paymentMethod = "UPI",
  tier = { id: "seated", name: "SEATED", price: 100 },
  eventName = "",
  date = "",
  time = "",
  ticketAmount = 0,
  convenienceFee = 0,
  gstOnConvenienceFee = 0,
  platformCharge = 0,
  totalAmount = 0,
}) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) {
    throw new Error("reserveSeatsTransaction: showId is required");
  }

  const seatList = Array.isArray(seats) ? seats.filter(Boolean) : [];
  if (seatList.length === 0) {
    throw new Error("reserveSeatsTransaction: At least one seat must be selected");
  }

  const cleanBlock = String(block || "").trim().toUpperCase();

  // Verify that the selected block is actively open for online selling in Supabase
  if (cleanBlock) {
    const { data: catData, error: catError } = await supabase
      .from("block_categories")
      .select("online, counter")
      .eq("id", cleanBlock)
      .maybeSingle();

    if (!catError && catData && catData.online === false) {
      const err = new Error(
        "This block is available for counter booking only. Please select another block."
      );
      err.code = "BLOCK_COUNTER_ONLY";
      throw err;
    }
  }

  const sessionId = getHoldSessionId();

  // 1. Verify seat availability in Supabase
  const seatIds = seatList.map((key) => resolveSeatDocId(cleanBlock, key));
  const seatFilter = seatIds
    .flatMap((docId) => [`id.eq.${docId}`, `seat_id.eq.${docId}`])
    .join(",");
  const { data: currentSeats, error: readError } = await supabase
    .from("seats")
    .select("*")
    .eq("event_id", targetShowId)
    .or(seatFilter);

  if (!readError && Array.isArray(currentSeats)) {
    for (const s of currentSeats) {
      const st = String(s.status || "").toLowerCase();
      const heldByOther =
        st === "reserved" &&
        holdSessionId(s.reserved_by) !== sessionId &&
        isHoldFresh(s);
      if (st === "booked" || heldByOther) {
        const collisionLabel = s.seat_label || s.id;
        const collisionError = new Error(
          `Seat Collision: Seat "${collisionLabel}" in Block ${cleanBlock} is already ${st === "booked" ? "booked" : "held"}. Please choose another seat.`
        );
        collisionError.code = "SEAT_COLLISION";
        collisionError.seat = collisionLabel;
        throw collisionError;
      }
    }
  }

  const ticketNumber = await nextTicketNumber();
  const nowIso = new Date().toISOString();
  const count = seatList.length;
  const unitPrice = Number(tier.price) || 100;
  const rawTicketAmount = Number(ticketAmount) > 0 ? Number(ticketAmount) : unitPrice * count;
  const charges = calculateCustomerCharges(rawTicketAmount);
  const finalAmount = Number(totalAmount) > 0 ? Number(totalAmount) : charges.finalCustomerAmount;
  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const canonicalPaymentMethod = resolveCanonicalPaymentMethod(paymentMethod || "UPI");

  const bookingPayload = {
    id: bookingId,
    bookingId: ticketNumber,
    ticketNumber,
    showId: targetShowId,
    eventId: targetShowId,
    customerName: customerName.trim() || "Walk-in",
    customerPhone: customerPhone.trim(),
    ticketTypeId: tier.id || null,
    ticketTypeName: tier.name || "SEATED",
    quantity: count,
    unitPrice,
    ticketAmount: charges.ticketAmount,
    baseAmount: charges.ticketAmount,
    convenienceFee: charges.convenienceFee,
    gstOnConvenienceFee: charges.gstOnConvenienceFee,
    platformCharge: charges.platformCharge,
    totalFees: charges.totalFees,
    amount: finalAmount,
    finalCustomerAmount: finalAmount,
    source: "Online",
    paymentMethod: canonicalPaymentMethod,
    transactionId: "",
    time: time || "11:00 PM",
    date: date || new Date().toLocaleDateString("en-IN"),
    bookingDate: new Date().toLocaleDateString("en-IN"),
    bookingTime: new Date().toLocaleTimeString("en-IN"),
    createdAt: nowIso,
    status: "Confirmed",
    bookingStatus: "Confirmed",
    enteredCount: 0,
    remainingCount: count,
    assignedGate: tier.gate || `Block ${cleanBlock}`,
    block: cleanBlock,
    seats: seatList,
    seatCount: count,
    eventName: eventName || "Jatra Show",
  };

  // Generate individual ticket records
  const ticketDocs = [];
  for (let i = 0; i < count; i++) {
    const individualTicketId = count === 1 ? ticketNumber : `${ticketNumber}-${i + 1}`;
    const individualSeat = seatList[i] || null;
    const qrToken = generateQrToken();

    ticketDocs.push({
      id: individualTicketId,
      ticketId: individualTicketId,
      bookingId: ticketNumber,
      bookingDocId: bookingId,
      ticketIndex: i + 1,
      totalTickets: count,
      showId: targetShowId,
      eventId: targetShowId,
      eventName: eventName || "Jatra Show",
      ticketTypeId: tier.id || null,
      ticketTypeName: tier.name || "SEATED",
      seat: individualSeat,
      seatIndex: i + 1,
      seatCount: count,
      block: cleanBlock,
      assignedGate: tier.gate || `Block ${cleanBlock}`,
      customerName: customerName.trim() || "Walk-in",
      customerPhone: customerPhone.trim(),
      serialNumber: individualTicketId,
      qrToken,
      status: "ACTIVE",
      date: date || new Date().toLocaleDateString("en-IN"),
      time: time || "11:00 PM",
      unitPrice,
      createdAt: nowIso,
    });
  }

  // 2. Save booking and update seats to "booked" via sbSaveBooking
  try {
    await sbSaveBooking({
      bookingId,
      ticketNumber,
      eventId: targetShowId,
      eventName: bookingPayload.eventName,
      customerName: bookingPayload.customerName,
      customerPhone: bookingPayload.customerPhone,
      ticketTypeId: tier.id || null,
      ticketTypeName: tier.name || "SEATED",
      quantity: count,
      unitPrice,
      amount: finalAmount,
      ticketAmount: charges.ticketAmount,
      baseAmount: charges.ticketAmount,
      convenienceFee: charges.convenienceFee,
      gstOnConvenienceFee: charges.gstOnConvenienceFee,
      platformCharge: charges.platformCharge,
      totalFees: charges.totalFees,
      finalCustomerAmount: finalAmount,
      source: "Online",
      paymentMethod: canonicalPaymentMethod,
      date,
      time,
      block: cleanBlock,
      seats: seatList,
      tickets: ticketDocs,
    });
  } catch (sbErr) {
    console.error("reserveSeatsTransaction sbSaveBooking error:", sbErr?.message);
    throw new Error("Failed to reserve seats and save booking");
  }

  return {
    ...bookingPayload,
    key: bookingId,
    tickets: ticketDocs,
  };
}

// Mark seats as booked by document id
export async function markSeatsBooked(showId, blockId, seatKeys) {
  const targetId = String(showId || "").trim();
  const cleanBlock = String(blockId || "").trim().toUpperCase();
  const now = new Date().toISOString();

  for (const key of seatKeys) {
    const docId = resolveSeatDocId(cleanBlock, key);
    await supabase
      .from("seats")
      .update({
        status: "booked",
        booked_at: now,
        reserved_by: null,
        reserved_at: null,
        updated_at: now,
      })
      .eq("event_id", targetId)
      .or(`id.eq.${docId},seat_id.eq.${docId},seat_label.eq.${key}`);
  }
}

// Mark seats as available (for cancellations)
export async function markSeatsAvailable(showId, blockId, seatKeys) {
  const targetId = String(showId || "").trim();
  const cleanBlock = String(blockId || "").trim().toUpperCase();
  const now = new Date().toISOString();

  for (const key of seatKeys) {
    const docId = resolveSeatDocId(cleanBlock, key);
    await supabase
      .from("seats")
      .update({
        status: "available",
        booked_at: null,
        reserved_by: null,
        reserved_at: null,
        updated_at: now,
      })
      .eq("event_id", targetId)
      .or(`id.eq.${docId},seat_id.eq.${docId},seat_label.eq.${key}`);
  }
}

// Get block statistics
export function getBlockStats(seatsByBlock, blockId) {
  const blockSeats = seatsByBlock[blockId] || [];
  const total = blockSeats.length;
  const available = blockSeats.filter(
    (s) => !s?.status || s.status === "available"
  ).length;
  const booked = blockSeats.filter(
    (s) => s?.status === "booked" || s?.status === "sold"
  ).length;
  const reserved = blockSeats.filter(
    (s) => s?.status === "reserved" || s?.status === "locked"
  ).length;
  return { total, available, booked, reserved };
}

export { BLOCK_GROUPS, BLOCK_SEATS, generateBBlockSeats };
