import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(process.cwd());
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const eventId = 'grkob7qf2CVAGzmErahv';

async function cleanupAndSync() {
  console.log('1. Cleaning up bogus legacy documents from Firestore...');
  const bogusPaths = [
    ['seats', eventId, 'A1', 'A1-A'],
    ['seats', eventId, 'B1', 'B1-A'],
    ['seats', eventId, 'C1', 'C1-A'],
  ];

  for (const p of bogusPaths) {
    try {
      const ref = doc(db, ...p);
      await deleteDoc(ref);
      console.log(`  Deleted bogus doc ${p.join('/')}`);
    } catch (e) {
      console.warn(`  Failed to delete ${p.join('/')}:`, e.message);
    }
  }

  console.log('\n2. Checking existing bookings in Firestore...');
  const bookingsSnap = await getDocs(collection(db, 'bookings'));
  console.log(`  Found ${bookingsSnap.size} bookings.`);

  const bookedSeatKeys = new Set();
  bookingsSnap.docs.forEach((bDoc) => {
    const bData = bDoc.data();
    if (bData.status !== 'Cancelled' && bData.status !== 'Refunded') {
      const seats = Array.isArray(bData.seats) ? bData.seats : [];
      seats.forEach((s) => bookedSeatKeys.add(String(s).trim().toUpperCase()));
    }
  });
  console.log(`  Active booked seat keys from actual bookings: ${bookedSeatKeys.size}`);

  console.log('\n3. Resetting Firestore shows/{eventId}/seats to available (unless actively booked)...');
  const showsSeatsSnap = await getDocs(collection(db, 'shows', eventId, 'seats'));
  console.log(`  Total docs in shows/${eventId}/seats: ${showsSeatsSnap.size}`);

  const allFirestoreSeats = [];
  const batch = writeBatch(db);
  let batchCount = 0;

  for (const sDoc of showsSeatsSnap.docs) {
    const sData = sDoc.data();
    const seatId = sDoc.id;
    const isActuallyBooked = bookedSeatKeys.has(seatId.toUpperCase());

    const updatedData = {
      ...sData,
      id: seatId,
      seatId: seatId,
      showId: eventId,
      eventId: eventId,
      status: isActuallyBooked ? 'booked' : 'available',
      bookingId: isActuallyBooked ? sData.bookingId : null,
      bookedAt: isActuallyBooked ? sData.bookedAt : null,
      reservedAt: null,
      reservedBy: null,
      price: Number(sData.price) || 50,
    };

    batch.set(sDoc.ref, updatedData, { merge: true });
    allFirestoreSeats.push(updatedData);
    batchCount++;
  }

  await batch.commit();
  console.log(`  Updated ${batchCount} seats in shows/${eventId}/seats.`);

  console.log('\n4. Syncing legacy subcollection seats/{eventId}/{block}...');
  const blocks = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
  for (const b of blocks) {
    const bSnap = await getDocs(collection(db, 'seats', eventId, b));
    if (bSnap.size > 0) {
      const bBatch = writeBatch(db);
      bSnap.docs.forEach((d) => {
        // Skip if bogus
        if (d.id === `${b}-A` || d.id === `${b}-B` || d.id === `${b}-C`) return;
        const dData = d.data();
        const fullKey = `${b}-${d.id}`;
        const isBooked = bookedSeatKeys.has(fullKey.toUpperCase()) || bookedSeatKeys.has(d.id.toUpperCase());
        bBatch.update(d.ref, {
          status: isBooked ? 'booked' : 'available',
          bookingId: isBooked ? dData.bookingId : null,
          bookedAt: isBooked ? dData.bookedAt : null,
          reservedAt: null,
          reservedBy: null,
        });
      });
      await bBatch.commit();
      console.log(`  Cleaned legacy seats/${eventId}/${b} (${bSnap.size} docs)`);
    }
  }

  console.log('\n5. Syncing ALL seats into Supabase...');
  // Prepare Supabase rows from allFirestoreSeats
  const sbRows = allFirestoreSeats.map((s) => {
    const block = String(s.blockId || s.block || '').toUpperCase();
    const row = String(s.rowId || s.row || '').toUpperCase();
    const num = Number(s.seatNumber || s.number || 0);
    const label = s.seatLabel || `${row}${num}`;
    const docId = s.id || `${block}-${row}-${num}`;

    return {
      id: docId,
      seat_id: docId,
      show_id: eventId,
      event_id: eventId,
      block_id: block,
      block: block,
      row_id: row,
      row: row,
      seat_number: num,
      number: num,
      seat_label: label,
      status: s.status || 'available',
      price: Number(s.price) || 50,
      booked_at: s.bookedAt || null,
      booking_id: s.bookingId || null,
      reserved_at: null,
      reserved_by: null,
      updated_at: new Date().toISOString(),
    };
  });

  console.log(`  Deleting existing Supabase seats for event ${eventId}...`);
  const { error: delErr } = await sb.from('seats').delete().eq('event_id', eventId);
  if (delErr) {
    console.warn('  Delete from Supabase seats notice:', delErr.message);
  }

  console.log(`  Inserting ${sbRows.length} real seats into Supabase...`);
  const CHUNK_SIZE = 50;
  for (let i = 0; i < sbRows.length; i += CHUNK_SIZE) {
    const chunk = sbRows.slice(i, i + CHUNK_SIZE);
    const { error: insErr } = await sb.from('seats').upsert(chunk);
    if (insErr) {
      console.error(`  Error inserting chunk ${i}:`, insErr.message);
    } else {
      console.log(`  Inserted chunk ${i} to ${i + chunk.length}`);
    }
  }

  // Verify
  const { data: finalSbSeats } = await sb.from('seats').select('*').eq('event_id', eventId);
  console.log(`\nVerification: Supabase now has ${finalSbSeats ? finalSbSeats.length : 0} seats for ${eventId}.`);

  const rowsCountByBlock = {};
  (finalSbSeats || []).forEach((s) => {
    const k = `${s.block_id}-${s.row_id}`;
    rowsCountByBlock[k] = (rowsCountByBlock[k] || 0) + 1;
  });
  console.log('Supabase block-rows:', rowsCountByBlock);

  console.log('\n=== FIX & SYNC COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

cleanupAndSync().catch((err) => {
  console.error('Fatal error during cleanup & sync:', err);
  process.exit(1);
});
