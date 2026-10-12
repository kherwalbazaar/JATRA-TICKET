import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "./firebase";
import { calculateCustomerCharges } from "./pricing";
import {
  sbFetchSeats,
  subscribeRealtimeSeats,
  sbHoldSeat,
  sbReleaseSeatHold,
  sbSaveBooking,
} from "./supabase";

const SEATS_COL = "seats";
const SHOWS_COL = "shows";
const BOOKINGS_COL = "bookings";
const TICKETS_COL = "tickets";

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
 * Admin batch seat creation function targeting the live subcollection path:
 * shows/{showId}/seats/{seatId} using writeBatch.
 * Includes properties: seatNumber, block, price, status: "available", createdAt: serverTimestamp().
 */
export async function storeAllSeats(showId) {
  const targetId = String(showId || "").trim();
  if (!targetId) throw new Error("storeAllSeats: showId is required");

  const bBlockSeats = generateBBlockSeats();
  let seatCount = 0;
  const seatsToStore = [];

  // Prepare regular blocks (A1, A2, A3, C1, C2, C3)
  for (const [blockId, rows] of Object.entries(BLOCK_SEATS)) {
    if (["B1", "B2", "B3"].includes(blockId)) continue;

    for (const row of rows) {
      for (let seatNum = 1; seatNum <= row.count; seatNum++) {
        const docId = `${blockId}-${row.id}-${seatNum}`;
        seatsToStore.push({
          seatId: docId,
          showId: targetId,
          eventId: targetId,
          block: blockId,
          blockId: blockId,
          row: row.id,
          rowId: row.id,
          seatNumber: seatNum,
          seatLabel: `${row.id}${seatNum}`,
          status: "available",
          price: 100,
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
          seatId: docId,
          showId: targetId,
          eventId: targetId,
          block: blockId,
          blockId: blockId,
          row: seat.letter,
          rowId: seat.letter,
          seatNumber: seat.number,
          seatLabel: seat.seatId,
          displayIndex: seat.displayIndex,
          status: "available",
          price: 100,
        });
      }
    }
  }

  // Commit in chunks of 450 items (Firestore limit is 500)
  const CHUNK_SIZE = 450;
  for (let i = 0; i < seatsToStore.length; i += CHUNK_SIZE) {
    const chunk = seatsToStore.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(firestore);

    for (const s of chunk) {
      // 1. Live uniform subcollection path: shows/{showId}/seats/{seatId}
      const liveSeatRef = doc(collection(firestore, SHOWS_COL, targetId, "seats"), s.seatId);
      batch.set(liveSeatRef, {
        ...s,
        createdAt: serverTimestamp(),
      });

      // 2. Dual-write to legacy path for backward compatibility
      const legacySeatRef = doc(
        collection(firestore, SEATS_COL, targetId, s.blockId),
        `${s.rowId}-${s.seatNumber}`
      );
      batch.set(legacySeatRef, {
        ...s,
        createdAt: new Date().toISOString(),
      });

      seatCount++;
    }

    await batch.commit();
  }

  console.log(`Stored ${seatCount} seats directly to shows/${targetId}/seats`);
  return seatCount;
}

/**
 * Fetch all seats for a show (one-time read with fallback).
 */
export async function fetchSeats(showId) {
  const targetId = String(showId || "").trim();
  if (!targetId) return {};

  const seatsByBlock = {};

  try {
    // 1. Try reading directly from live subcollection: shows/{showId}/seats
    const liveSnap = await getDocs(collection(firestore, SHOWS_COL, targetId, "seats"));
    if (!liveSnap.empty) {
      liveSnap.docs.forEach((d) => {
        const data = d.data();
        const block = (data.block || data.blockId || "").toUpperCase();
        if (!seatsByBlock[block]) seatsByBlock[block] = [];
        seatsByBlock[block].push({ id: d.id, ...data });
      });
      return seatsByBlock;
    }
  } catch (err) {
    console.warn("fetchSeats live subcollection read notice:", err?.message);
  }

  // 2. Fallback to legacy block paths
  const blocks = new Set([
    ...BLOCK_GROUPS.rightSide,
    ...BLOCK_GROUPS.frontCenter,
    ...BLOCK_GROUPS.leftSide,
  ]);

  try {
    const metaSnap = await getDoc(doc(firestore, "seatMeta", targetId));
    if (metaSnap.exists()) {
      const metaBlocks = metaSnap.data()?.blocks || [];
      metaBlocks.forEach((b) => b && blocks.add(b));
    }
  } catch (error) {
    console.warn("seatMeta lookup failed:", error);
  }

  const readBlock = async (blockId) => {
    try {
      const snap = await getDocs(
        collection(firestore, SEATS_COL, targetId, blockId)
      );
      if (!snap.empty) {
        return {
          blockId,
          seats: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      }
    } catch (error) {
      console.error(`Error fetching seats for block ${blockId}:`, error);
      return { blockId, seats: [] };
    }
    return null;
  };

  const results = await Promise.all([...blocks].map(readBlock));
  results.forEach((r) => {
    if (r) seatsByBlock[r.blockId] = r.seats;
  });

  return seatsByBlock;
}

/**
 * Live Real-Time Seat Availability Subscription (shows/{showId}/seats).
 * Binds the seat map component to reactive Firestore snapshot listener.
 * Modification to seat states (available, selected, booked, locked) or addition
 * of newly generated seats instantly updates the visual grid for all active sessions.
 * Returns unsubscribe cleanup handler to prevent orphan reads and memory leaks.
 */
export function subscribeSeats(showId, callback, onError) {
  const targetId = String(showId || "").trim();
  if (!targetId) {
    callback({});
    return () => {};
  }

  let disposed = false;
  let fallbackUnsub = null;
  let metaUnsub = null;

  // Legacy status overlay: older customer-app versions (and older admin
  // builds) only wrote seats/{id}/{block}. A "booked" there must always
  // win over a stale "available" on the live path.
  const PROTECTED = new Set(["booked", "reserved", "sold", "locked"]);
  const legacyMap = new Map();
  const legacyUnsubs = new Map();
  const supabaseMap = new Map();
  let supabaseUnsub = () => {};
  let lastBlocks = null;

  const normalizeSbSeat = (row) => {
    if (!row) return null;
    const block = String(row.block_id || row.block || "").toUpperCase();
    const rowId = String(row.row_id || row.row || "").toUpperCase();
    const seatNum = Number(row.seat_number || row.number || 0);
    const seatLabel = row.seat_label || (rowId && seatNum ? `${rowId}${seatNum}` : row.id);
    const docId = row.seat_id || (block && rowId && seatNum ? `${block}-${rowId}-${seatNum}` : row.id);
    return {
      id: docId,
      seatId: docId,
      showId: targetId,
      eventId: targetId,
      block,
      blockId: block,
      row: rowId,
      rowId,
      seatNumber: seatNum,
      seatLabel,
      status: String(row.status || "available").toLowerCase(),
      price: Number(row.price) || 100,
      bookedAt: row.booked_at || null,
      bookingId: row.booking_id || null,
      reservedAt: row.reserved_at || null,
      reservedBy: row.reserved_by || null,
    };
  };

  const legacyKey = (block, docId) => {
    const id = String(docId || "").toUpperCase();
    const prefix = `${block}-`;
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
  };

  const ensureLegacyBlock = (blockRaw) => {
    const block = String(blockRaw || "").toUpperCase();
    if (!block || legacyUnsubs.has(block) || disposed) return;
    const unsub = onSnapshot(
      collection(firestore, SEATS_COL, targetId, block),
      (snap) => {
        if (disposed) return;
        const prefix = `${block}/`;
        for (const key of Array.from(legacyMap.keys())) {
          if (key.startsWith(prefix)) legacyMap.delete(key);
        }
        snap.docs.forEach((d) => {
          legacyMap.set(prefix + legacyKey(block, d.id), d.data());
        });
        if (lastBlocks) emit(lastBlocks);
      },
      () => {}
    );
    legacyUnsubs.set(block, unsub);
  };

  const emit = (seatsByBlock) => {
    if (disposed) return;
    const merged = { ...seatsByBlock };

    Object.keys(merged).forEach((block) => {
      merged[block].forEach((seat) => {
        const lg = legacyMap.get(`${block}/${legacyKey(block, seat.id)}`);
        const legacyStatus = String(lg?.status || "available").toLowerCase();

        const sbSeat =
          supabaseMap.get(`${block}/${String(seat.seatLabel || "").toUpperCase()}`) ||
          supabaseMap.get(`${block}/${String(seat.id || "").toUpperCase()}`) ||
          supabaseMap.get(`${block}/${seat.rowId}-${seat.seatNumber}`);
        const sbStatus = String(sbSeat?.status || "available").toLowerCase();

        const liveStatus = String(seat.status || "available").toLowerCase();

        if (PROTECTED.has(sbStatus) && !PROTECTED.has(liveStatus)) {
          seat.status = sbStatus;
          seat.bookedAt = sbSeat.bookedAt || seat.bookedAt || null;
          seat.bookingId = sbSeat.bookingId || seat.bookingId || null;
          seat.reservedAt = sbSeat.reservedAt || null;
          seat.reservedBy = sbSeat.reservedBy || null;
        } else if (PROTECTED.has(legacyStatus) && !PROTECTED.has(liveStatus)) {
          seat.status = legacyStatus;
          seat.bookedAt = lg?.bookedAt || seat.bookedAt || null;
          seat.bookingId = lg?.bookingId || seat.bookingId || null;
          seat.reservedAt = lg?.reservedAt || null;
          seat.reservedBy = lg?.reservedBy || null;
        }
      });
    });

    // Merge in any blocks existing only in Supabase
    supabaseMap.forEach((sbSeat) => {
      const b = sbSeat.block;
      if (!b) return;
      if (!merged[b]) merged[b] = [];
      const exists = merged[b].some(
        (s) =>
          s.id === sbSeat.id ||
          s.seatLabel === sbSeat.seatLabel ||
          `${s.rowId}-${s.seatNumber}` === `${sbSeat.rowId}-${sbSeat.seatNumber}`
      );
      if (!exists) {
        merged[b].push(sbSeat);
      }
    });

    callback(merged);
  };

  // Supabase Initial Read & Realtime Listener
  try {
    sbFetchSeats(targetId).then((rows) => {
      if (disposed || !Array.isArray(rows)) return;
      rows.forEach((r) => {
        const s = normalizeSbSeat(r);
        if (s && s.block) {
          supabaseMap.set(`${s.block}/${s.seatLabel.toUpperCase()}`, s);
          supabaseMap.set(`${s.block}/${s.id.toUpperCase()}`, s);
          supabaseMap.set(`${s.block}/${s.rowId}-${s.seatNumber}`, s);
        }
      });
      if (lastBlocks) {
        emit(lastBlocks);
      } else if (rows.length > 0) {
        const sbBlocks = {};
        rows.forEach((r) => {
          const s = normalizeSbSeat(r);
          if (!s || !s.block) return;
          if (!sbBlocks[s.block]) sbBlocks[s.block] = [];
          sbBlocks[s.block].push(s);
        });
        lastBlocks = sbBlocks;
        emit(sbBlocks);
      }
    }).catch(() => {});

    supabaseUnsub = subscribeRealtimeSeats(targetId, (payload) => {
      if (disposed) return;
      const { eventType, new: newRow, old: oldRow } = payload || {};
      if (eventType === "DELETE") {
        const oldSeat = normalizeSbSeat(oldRow);
        if (oldSeat && oldSeat.block) {
          supabaseMap.delete(`${oldSeat.block}/${oldSeat.seatLabel.toUpperCase()}`);
          supabaseMap.delete(`${oldSeat.block}/${oldSeat.id.toUpperCase()}`);
        }
      } else if (newRow) {
        const s = normalizeSbSeat(newRow);
        if (s && s.block) {
          supabaseMap.set(`${s.block}/${s.seatLabel.toUpperCase()}`, s);
          supabaseMap.set(`${s.block}/${s.id.toUpperCase()}`, s);
          supabaseMap.set(`${s.block}/${s.rowId}-${s.seatNumber}`, s);
        }
      }
      if (lastBlocks) emit(lastBlocks);
    });
  } catch (sbInitErr) {
    console.warn("subscribeSeats Supabase init notice:", sbInitErr);
  }

  // SeatMeta blocks so legacy bookings in blocks without live seats show too
  try {
    metaUnsub = onSnapshot(
      doc(firestore, "seatMeta", targetId),
      (snap) => {
        if (disposed || !snap.exists()) return;
        (snap.data()?.blocks || []).forEach(ensureLegacyBlock);
      },
      () => {}
    );
  } catch (e) {
    metaUnsub = null;
  }

  // Primary: Live onSnapshot listener on shows/{showId}/seats
  const liveSeatsRef = collection(firestore, SHOWS_COL, targetId, "seats");

  const unsubscribe = onSnapshot(
    liveSeatsRef,
    (snapshot) => {
      if (disposed) return;

      if (!snapshot.empty) {
        if (fallbackUnsub) {
          fallbackUnsub();
          fallbackUnsub = null;
        }

        const seatsByBlock = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const block = String(data.block || data.blockId || "").toUpperCase();
          if (!block) return;
          if (!seatsByBlock[block]) seatsByBlock[block] = [];
          seatsByBlock[block].push({
            id: d.id,
            seatId: d.id,
            ...data,
            block: block,
            blockId: block,
            status: data.status || "available",
            seatLabel: data.seatLabel || `${data.row || data.rowId || ""}${data.seatNumber || ""}`,
          });
        });

        // Natural sort by displayIndex / seatNumber
        Object.keys(seatsByBlock).forEach((b) => {
          seatsByBlock[b].sort(
            (s1, s2) =>
              (s1.displayIndex ?? s1.seatNumber ?? 0) -
              (s2.displayIndex ?? s2.seatNumber ?? 0)
          );
        });

        lastBlocks = seatsByBlock;
        Object.keys(seatsByBlock).forEach(ensureLegacyBlock);
        emit(seatsByBlock);
      } else {
        // Fallback: If live subcollection is empty, stream from legacy block collections
        if (!fallbackUnsub) {
          fallbackUnsub = subscribeLegacySeats(targetId, (legacySeats) => {
            if (!disposed && snapshot.empty) {
              lastBlocks = legacySeats || {};
              emit(legacySeats || {});
            }
          }, onError);
        }
      }
    },
    (error) => {
      console.warn("subscribeSeats shows/{showId}/seats listener error, using fallback:", error);
      if (!fallbackUnsub) {
        fallbackUnsub = subscribeLegacySeats(targetId, (legacySeats) => {
          if (!disposed) {
            lastBlocks = legacySeats || {};
            emit(legacySeats || {});
          }
        }, onError);
      }
    }
  );

  return () => {
    disposed = true;
    unsubscribe();
    if (metaUnsub) metaUnsub();
    legacyUnsubs.forEach((u) => u());
    legacyUnsubs.clear();
    if (fallbackUnsub) fallbackUnsub();
    if (supabaseUnsub) supabaseUnsub();
  };
}

/**
 * Legacy multi-block subscription fallback.
 */
function subscribeLegacySeats(eventId, callback, onError) {
  const blockUnsubs = new Map();
  const seatMap = new Map();
  let disposed = false;
  let pending = 0;

  const emit = () => {
    if (disposed || pending > 0) return;
    const out = {};
    seatMap.forEach((seats, blockId) => {
      out[blockId] = seats;
    });
    callback(out);
  };

  const subscribeBlock = (blockId) => {
    const block = String(blockId || "").trim().toUpperCase();
    if (!block || blockUnsubs.has(block) || disposed) return;
    pending++;
    const unsub = onSnapshot(
      collection(firestore, SEATS_COL, eventId, block),
      (snap) => {
        seatMap.set(
          block,
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
        pending = Math.max(0, pending - 1);
        emit();
      },
      (error) => {
        console.warn(`Seat subscription error for block ${block}:`, error);
        pending = Math.max(0, pending - 1);
        emit();
        onError?.(error);
      }
    );
    blockUnsubs.set(block, unsub);
  };

  const defaultBlocks = new Set([
    ...BLOCK_GROUPS.rightSide,
    ...BLOCK_GROUPS.frontCenter,
    ...BLOCK_GROUPS.leftSide,
  ]);
  defaultBlocks.forEach(subscribeBlock);

  let metaUnsub = () => {};
  try {
    metaUnsub = onSnapshot(
      doc(firestore, "seatMeta", eventId),
      (snap) => {
        if (disposed) return;
        const metaBlocks = snap.exists() ? snap.data()?.blocks || [] : [];
        metaBlocks.forEach((b) => {
          const block = String(b || "").trim().toUpperCase();
          if (block) subscribeBlock(block);
        });
        emit();
      },
      (error) => {
        console.warn("seatMeta subscription notice:", error);
      }
    );
  } catch (e) {
    /* ignore */
  }

  return () => {
    disposed = true;
    metaUnsub();
    blockUnsubs.forEach((u) => u());
    blockUnsubs.clear();
    seatMap.clear();
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

// ── Seat holds (reserved seats while a customer is selecting/paying) ──
const HOLD_TTL_MS = 10 * 60 * 1000;

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

// A hold is "fresh" only within the TTL; after that the seat is sellable again.
export function isHoldFresh(data) {
  const at = Date.parse((data && data.reservedAt) || "");
  if (Number.isNaN(at)) return false;
  return Date.now() - at < HOLD_TTL_MS;
}

function resolveHoldRefs(showId, block, key) {
  const cleanBlock = String(block || "").trim().toUpperCase();
  const rawKey = String(key || "").trim();
  const docId =
    rawKey.includes("-") && rawKey.split("-").length >= 3
      ? rawKey
      : cleanBlock
        ? `${cleanBlock}-${toSeatDocId(rawKey)}`
        : toSeatDocId(rawKey);
  return {
    rawKey,
    docId,
    liveRef: doc(collection(firestore, SHOWS_COL, showId, "seats"), docId),
    legacyRef: cleanBlock
      ? doc(collection(firestore, SEATS_COL, showId, cleanBlock), toSeatDocId(rawKey))
      : null,
  };
}

function holdBlockReason(snap, sessionId) {
  if (!snap || !snap.exists()) return null;
  const d = snap.data() || {};
  const st = String(d.status || "").toLowerCase();
  if (!st || st === "available") return null;
  if (st === "reserved" && (d.reservedBy === sessionId || !isHoldFresh(d))) return null;
  return st;
}

/**
 * Reserve a single seat (both seat paths) for this browsing session while the
 * customer selects/checks out. Fails (returns false) when the seat is booked
 * or freshly reserved by someone else.
 */
export async function holdSeat(showId, block, key) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) return false;
  const sessionId = getHoldSessionId();
  const refs = resolveHoldRefs(targetShowId, block, key);

  // Dual-sync hold state to Supabase
  try {
    sbHoldSeat(targetShowId, refs.docId, sessionId).catch(() => {});
    if (refs.rawKey !== refs.docId) {
      sbHoldSeat(targetShowId, refs.rawKey, sessionId).catch(() => {});
    }
  } catch (e) {
    /* ignore */
  }

  try {
    await runTransaction(firestore, async (tx) => {
      const liveSnap = await tx.get(refs.liveRef);
      const legacySnap = refs.legacyRef ? await tx.get(refs.legacyRef) : null;
      const bad = holdBlockReason(liveSnap, sessionId) || holdBlockReason(legacySnap, sessionId);
      if (bad) throw new Error(`seat ${refs.rawKey} is ${bad}`);
      const base = liveSnap.exists()
        ? liveSnap.data() || {}
        : legacySnap && legacySnap.exists()
          ? legacySnap.data() || {}
          : {};
      const hold = {
        status: "reserved",
        reservedBy: sessionId,
        reservedAt: new Date().toISOString(),
      };
      const blockId = String(block || base.blockId || "").trim().toUpperCase();
      tx.set(
        refs.liveRef,
        { ...base, ...hold, blockId: base.blockId || blockId, showId: targetShowId },
        { merge: true }
      );
      if (refs.legacyRef) {
        tx.set(
          refs.legacyRef,
          { ...base, ...hold, blockId: base.blockId || blockId, showId: targetShowId },
          { merge: true }
        );
      }
    });
    return true;
  } catch (e) {
    console.warn("holdSeat:", e && e.message);
    return false;
  }
}

/**
 * Release a hold this session owns (deselect / leaving the flow). No-op when
 * the seat has moved on to booked or is held by another session.
 */
export async function releaseSeatHold(showId, block, key) {
  const targetShowId = String(showId || "").trim();
  if (!targetShowId) return false;
  const sessionId = getHoldSessionId();
  const refs = resolveHoldRefs(targetShowId, block, key);

  // Dual-sync release hold state to Supabase
  try {
    sbReleaseSeatHold(targetShowId, refs.docId, sessionId).catch(() => {});
    if (refs.rawKey !== refs.docId) {
      sbReleaseSeatHold(targetShowId, refs.rawKey, sessionId).catch(() => {});
    }
  } catch (e) {
    /* ignore */
  }

  try {
    await runTransaction(firestore, async (tx) => {
      const liveSnap = await tx.get(refs.liveRef);
      const legacySnap = refs.legacyRef ? await tx.get(refs.legacyRef) : null;
      let changed = false;
      const release = (snap, ref) => {
        if (!snap || !snap.exists() || !ref) return;
        const d = snap.data() || {};
        if (String(d.status || "").toLowerCase() !== "reserved") return;
        if (d.reservedBy !== sessionId) return;
        tx.set(ref, { status: "available", reservedBy: null, reservedAt: null }, { merge: true });
        changed = true;
      };
      release(liveSnap, refs.liveRef);
      release(legacySnap, refs.legacyRef);
      if (!changed) throw new Error("nothing to release");
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Generate a unique ticket number: NJ26-XXXXX
 */
async function generateNextTicketNumber() {
  const snap = await getDocs(collection(firestore, BOOKINGS_COL));
  const used = new Set(
    snap.docs.map((d) => String(d.data()?.ticketNumber || "")).filter(Boolean)
  );
  let seq = snap.size + 1;
  let ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
  while (used.has(ticketNumber)) {
    seq += 1;
    ticketNumber = `NJ26-${String(seq).padStart(5, "0")}`;
  }
  return ticketNumber;
}

function generateQrToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "tkn_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Concurrency Safety & Double-Booking Prevention:
 * User seat checkout executed via Firestore runTransaction.
 *
 * Verifies within the transaction that all targeted seats remain "available"
 * before writing status updates to "booked" and recording the order in bookings.
 * If any seat state has changed, aborts the transaction with a collision error.
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
  const ticketNumber = await generateNextTicketNumber();
  const nowIso = new Date().toISOString();
  const count = seatList.length;
  const unitPrice = Number(tier.price) || 100;
  const rawTicketAmount = Number(ticketAmount) > 0 ? Number(ticketAmount) : unitPrice * count;
  const charges = calculateCustomerCharges(rawTicketAmount);

  const finalAmount = totalAmount > 0 ? totalAmount : charges.finalCustomerAmount;

  // Build target references for each seat
  const seatRefs = seatList.map((key) => {
    const rawKey = String(key).trim();
    // Resolve seatDocId: e.g. "B1-A-1" or "A-1"
    const docId = rawKey.includes("-") && rawKey.split("-").length >= 3
      ? rawKey
      : cleanBlock ? `${cleanBlock}-${toSeatDocId(rawKey)}` : toSeatDocId(rawKey);

    return {
      key: rawKey,
      seatDocId: docId,
      liveRef: doc(collection(firestore, SHOWS_COL, targetShowId, "seats"), docId),
      legacyRef: cleanBlock
        ? doc(collection(firestore, SEATS_COL, targetShowId, cleanBlock), toSeatDocId(rawKey))
        : null,
    };
  });

  const bookingDocRef = doc(collection(firestore, BOOKINGS_COL));
  const bookingId = bookingDocRef.id;

  const bookingPayload = {
    id: bookingId,
    bookingId: ticketNumber,
    ticketNumber,
    showId: targetShowId,
    eventId: targetShowId,
    customerName: customerName.trim() || "Walk-in",
    customerPhone: customerPhone.trim(),
    ticketTypeId: tier.id || "seated",
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
    paymentMethod,
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
      ticketTypeId: tier.id || "seated",
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

  // Execute atomic transaction
  await runTransaction(firestore, async (transaction) => {
    // ── Phase 1: All transactional reads ──
    const targetSeatDocs = [];

    for (const item of seatRefs) {
      // Read BOTH paths: bookings from older app versions (and the admin
      // counter) may have marked either side, so a "booked" anywhere means
      // the seat is gone.
      const liveSnap = await transaction.get(item.liveRef);
      const legacySnap = item.legacyRef ? await transaction.get(item.legacyRef) : null;

      const sessionId = getHoldSessionId();

      const liveStatus = holdBlockReason(liveSnap, sessionId) || "";
      const legacyStatus = holdBlockReason(legacySnap, sessionId) || "";

      const takenStatus = liveStatus || legacyStatus;

      if (takenStatus) {
        const collisionLabel =
          liveSnap.data()?.seatLabel || legacySnap?.data()?.seatLabel || item.key;
        const collisionError = new Error(
          `Seat Collision: Seat "${collisionLabel}" in Block ${cleanBlock} is already ${takenStatus}. Please choose another seat.`
        );
        collisionError.code = "SEAT_COLLISION";
        collisionError.seat = collisionLabel;
        throw collisionError;
      }

      targetSeatDocs.push({
        liveRef: item.liveRef,
        legacyRef: item.legacyRef,
        liveExists: liveSnap.exists(),
        legacyExists: Boolean(legacySnap && legacySnap.exists()),
        data: liveSnap.exists() ? liveSnap.data() : (legacySnap?.exists() ? legacySnap.data() : null),
      });
    }

    // ── Phase 2: All transactional writes ──

    // 1. Mark each targeted seat as booked — on BOTH paths so the admin
    //    counter and the customer app always agree.
    const claim = { status: "booked", bookedAt: nowIso, bookingId: ticketNumber, reservedBy: null, reservedAt: null };
    for (const item of targetSeatDocs) {
      if (item.legacyRef && item.legacyExists) {
        transaction.update(item.legacyRef, claim);
      }
      if (item.liveExists) {
        transaction.update(item.liveRef, claim);
      } else {
        // Create the seat doc as booked in the live subcollection
        const d = item.data || {};
        transaction.set(item.liveRef, {
          seatId: item.liveRef.id,
          showId: targetShowId,
          eventId: d.eventId || targetShowId,
          block: d.block || cleanBlock,
          blockId: d.blockId || cleanBlock,
          row: d.row || item.liveRef.id.split("-")[1] || "",
          rowId: d.rowId || item.liveRef.id.split("-")[1] || "",
          seatNumber: d.seatNumber || Number(item.liveRef.id.split("-")[2]) || 0,
          seatLabel: d.seatLabel || item.liveRef.id,
          status: "booked",
          price: d.price || unitPrice,
          bookedAt: nowIso,
          bookingId: ticketNumber,
          createdAt: d.createdAt || nowIso,
        });
      }
      // Keep legacy doc in sync even if it did not exist yet
      if (item.legacyRef && !item.legacyExists) {
        const d = item.data || {};
        transaction.set(item.legacyRef, {
          seatId: item.legacyRef.id,
          showId: targetShowId,
          eventId: d.eventId || targetShowId,
          block: d.block || cleanBlock,
          blockId: d.blockId || cleanBlock,
          row: d.row || item.legacyRef.id.split("-")[0] || "",
          rowId: d.rowId || item.legacyRef.id.split("-")[0] || "",
          seatNumber: d.seatNumber || Number(item.legacyRef.id.split("-")[1]) || 0,
          seatLabel: d.seatLabel || item.legacyRef.id,
          status: "booked",
          price: d.price || unitPrice,
          bookedAt: nowIso,
          bookingId: ticketNumber,
          createdAt: d.createdAt || nowIso,
        });
      }
    }

    // 2. Write booking document to bookings/{bookingId}
    transaction.set(bookingDocRef, bookingPayload);

    // 3. Write individual tickets to tickets/{ticketId}
    for (const ticket of ticketDocs) {
      const ticketRef = doc(firestore, TICKETS_COL, ticket.ticketId);
      transaction.set(ticketRef, ticket);
    }
  });

  // Dual-write booking & tickets & booked seats to Supabase
  try {
    await sbSaveBooking({
      bookingId,
      ticketNumber,
      eventId: targetShowId,
      eventName: bookingPayload.eventName,
      customerName: bookingPayload.customerName,
      customerPhone: bookingPayload.customerPhone,
      ticketTypeId: bookingPayload.ticketTypeId,
      ticketTypeName: bookingPayload.ticketTypeName,
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
      paymentMethod,
      date,
      time,
      block: cleanBlock,
      seats: seatList,
      tickets: ticketDocs,
    });
  } catch (sbErr) {
    console.warn("sbSaveBooking dual-write notice:", sbErr?.message);
  }

  return {
    ...bookingPayload,
    key: bookingId,
    tickets: ticketDocs,
  };
}

// Mark seats as booked by document id (batch fallback)
export async function markSeatsBooked(showId, blockId, seatKeys) {
  const targetId = String(showId || "").trim();
  const block = String(blockId || "").trim().toUpperCase();
  const batch = writeBatch(firestore);
  const now = new Date().toISOString();
  let n = 0;

  for (const key of seatKeys) {
    const rawKey = String(key).trim();
    const docId = rawKey.includes("-") && rawKey.split("-").length >= 3
      ? rawKey
      : `${block}-${toSeatDocId(rawKey)}`;

    // Update live subcollection
    const liveRef = doc(collection(firestore, SHOWS_COL, targetId, "seats"), docId);
    batch.update(liveRef, {
      status: "booked",
      bookedAt: now,
      reservedBy: null,
      reservedAt: null,
    });

    // Update legacy path
    const legacyRef = doc(collection(firestore, SEATS_COL, targetId, block), toSeatDocId(rawKey));
    batch.update(legacyRef, {
      status: "booked",
      bookedAt: now,
      reservedBy: null,
      reservedAt: null,
    });
    n++;
  }

  if (n > 0) {
    try {
      await batch.commit();
      console.log(`Marked ${n} seats as booked in block ${block}`);
    } catch (e) {
      console.warn("markSeatsBooked batch notice:", e?.message);
    }
  }
}

// Mark seats as available (for cancellations)
export async function markSeatsAvailable(showId, blockId, seatKeys) {
  const targetId = String(showId || "").trim();
  const block = String(blockId || "").trim().toUpperCase();
  const batch = writeBatch(firestore);
  let n = 0;

  for (const key of seatKeys) {
    const rawKey = String(key).trim();
    const docId = rawKey.includes("-") && rawKey.split("-").length >= 3
      ? rawKey
      : `${block}-${toSeatDocId(rawKey)}`;

    const liveRef = doc(collection(firestore, SHOWS_COL, targetId, "seats"), docId);
    batch.update(liveRef, {
      status: "available",
      bookedAt: null,
    });

    const legacyRef = doc(collection(firestore, SEATS_COL, targetId, block), toSeatDocId(rawKey));
    batch.update(legacyRef, {
      status: "available",
      bookedAt: null,
    });
    n++;
  }

  if (n > 0) {
    try {
      await batch.commit();
      console.log(`Marked ${n} seats as available in block ${block}`);
    } catch (e) {
      console.warn("markSeatsAvailable batch notice:", e?.message);
    }
  }
}

// Get block statistics
export function getBlockStats(seatsByBlock, blockId) {
  const blockSeats = seatsByBlock[blockId] || [];
  const total = blockSeats.length;
  const available = blockSeats.filter((s) => s.status === "available").length;
  return { total, available };
}

export { BLOCK_GROUPS, BLOCK_SEATS, generateBBlockSeats };
