import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function run() {
  console.log('=== CHECKING FIRESTORE ===');
  const eventSnap = await getDocs(collection(db, 'events'));
  for (const ev of eventSnap.docs) {
    const eid = ev.id;
    console.log(`Event ID: ${eid}`);
    const showsSeatsSnap = await getDocs(collection(db, 'shows', eid, 'seats'));
    console.log(`  shows/${eid}/seats: ${showsSeatsSnap.size} docs`);
    const statusCounts = {};
    showsSeatsSnap.docs.forEach((d) => {
      const data = d.data();
      const st = data.status || 'unknown';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (st !== 'available') {
        console.log(`    Seat ${d.id}: status=${st}, bookingId=${data.bookingId}, customerName=${data.customerName}`);
      }
    });
    console.log(`  shows/${eid}/seats statuses:`, statusCounts);

    const blocks = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
    for (const b of blocks) {
      const bSnap = await getDocs(collection(db, 'seats', eid, b));
      if (bSnap.size > 0) {
        console.log(`  seats/${eid}/${b}: ${bSnap.size} docs`);
        bSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.status !== 'available') {
            console.log(`    Legacy ${b}/${d.id}: status=${data.status}, bookedBy=${data.bookedBy || data.customerName}`);
          }
        });
      }
    }
  }

  const bSnap = await getDocs(collection(db, 'bookings'));
  console.log(`Firestore bookings count: ${bSnap.size}`);

  console.log('\n=== CHECKING SUPABASE ===');
  const { data: sbSeats, error: sbSeatsErr } = await sb.from('seats').select('*');
  console.log(`Supabase seats count: ${sbSeats ? sbSeats.length : 0}`, sbSeatsErr?.message || '');
  if (sbSeats) {
    const sbStatuses = {};
    sbSeats.forEach((s) => {
      const st = s.status || 'unknown';
      sbStatuses[st] = (sbStatuses[st] || 0) + 1;
      if (st !== 'available') {
        console.log(`  Supabase seat ${s.id || s.seat_id}: status=${st}, booking_id=${s.booking_id}`);
      }
    });
    console.log('  Supabase seats statuses:', sbStatuses);
  }

  const { data: sbBookings } = await sb.from('bookings').select('*');
  console.log(`Supabase bookings count: ${sbBookings ? sbBookings.length : 0}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
