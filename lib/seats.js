import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./firebase";

const SEATS_COL = "seats";

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

  const bTotalSeats = BLOCK_SEATS.B1.reduce((sum, row) => sum + row.count, 0);
  const b2TotalSeats = BLOCK_SEATS.B2.reduce((sum, row) => sum + row.count, 0);
  const b3TotalSeats = BLOCK_SEATS.B3.reduce((sum, row) => sum + row.count, 0);

  // Generate B1 seats (RIGHT → LEFT)
  seats.B1 = [];
  for (let i = 0; i < BLOCK_SEATS.B1.length; i++) {
    const row = BLOCK_SEATS.B1[i];
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
  for (let i = 0; i < BLOCK_SEATS.B2.length; i++) {
    const row = BLOCK_SEATS.B2[i];
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
  for (let i = 0; i < BLOCK_SEATS.B3.length; i++) {
    const row = BLOCK_SEATS.B3[i];
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

// Store all seats for an event in Firestore
export async function storeAllSeats(eventId) {
  const bBlockSeats = generateBBlockSeats();
  const batch = writeBatch(firestore);
  let seatCount = 0;

  // Store regular blocks (A1, A2, A3, C1, C2, C3)
  for (const [blockId, rows] of Object.entries(BLOCK_SEATS)) {
    if (["B1", "B2", "B3"].includes(blockId)) continue;

    for (const row of rows) {
      for (let seatNum = 1; seatNum <= row.count; seatNum++) {
        const seatRef = doc(
          collection(firestore, SEATS_COL, eventId, blockId),
          `${row.id}-${seatNum}`
        );
        batch.set(seatRef, {
          eventId,
          blockId,
          rowId: row.id,
          seatNumber: seatNum,
          seatLabel: `${row.id}${seatNum}`,
          status: "available",
          price: 100,
          createdAt: new Date().toISOString(),
        });
        seatCount++;
      }
    }
  }

  // Store B1 blocks (B1, B2, B3) with special alphabet logic
  for (const blockId of ["B1", "B2", "B3"]) {
    const blockData = bBlockSeats[blockId];
    if (!blockData) continue;

    for (const row of blockData) {
      for (const seat of row) {
        const seatRef = doc(
          collection(firestore, SEATS_COL, eventId, blockId),
          `${seat.letter}-${seat.number}`
        );
        batch.set(seatRef, {
          eventId,
          blockId,
          rowId: seat.letter,
          seatNumber: seat.number,
          seatLabel: seat.seatId,
          displayIndex: seat.displayIndex,
          status: "available",
          price: 100,
          createdAt: new Date().toISOString(),
        });
        seatCount++;
      }
    }
  }

  await batch.commit();
  console.log(`Stored ${seatCount} seats for event ${eventId}`);
  return seatCount;
}

// Fetch all seats for an event
export async function fetchSeats(eventId) {
  const seatsByBlock = {};
  const blocks = [
    ...BLOCK_GROUPS.rightSide,
    ...BLOCK_GROUPS.frontCenter,
    ...BLOCK_GROUPS.leftSide,
  ];

  for (const blockId of blocks) {
    try {
      const q = query(
        collection(firestore, SEATS_COL, eventId, blockId)
      );
      const snap = await getDocs(q);
      seatsByBlock[blockId] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
    } catch (error) {
      console.error(`Error fetching seats for block ${blockId}:`, error);
      seatsByBlock[blockId] = [];
    }
  }

  return seatsByBlock;
}

// Mark seats as booked
export async function markSeatsBooked(eventId, blockId, seatLabels) {
  const batch = writeBatch(firestore);

  for (const seatLabel of seatLabels) {
    const seatRef = doc(
      collection(firestore, SEATS_COL, eventId, blockId),
      seatLabel
    );
    batch.update(seatRef, {
      status: "booked",
      bookedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
  console.log(`Marked ${seatLabels.length} seats as booked in block ${blockId}`);
}

// Mark seats as available (for cancellations)
export async function markSeatsAvailable(eventId, blockId, seatLabels) {
  const batch = writeBatch(firestore);

  for (const seatLabel of seatLabels) {
    const seatRef = doc(
      collection(firestore, SEATS_COL, eventId, blockId),
      seatLabel
    );
    batch.update(seatRef, {
      status: "available",
      bookedAt: null,
    });
  }

  await batch.commit();
  console.log(`Marked ${seatLabels.length} seats as available in block ${blockId}`);
}

// Get block statistics
export function getBlockStats(seatsByBlock, blockId) {
  const blockSeats = seatsByBlock[blockId] || [];
  const total = blockSeats.length;
  const available = blockSeats.filter((s) => s.status === "available").length;
  return { total, available };
}

export { BLOCK_GROUPS, BLOCK_SEATS, generateBBlockSeats };
