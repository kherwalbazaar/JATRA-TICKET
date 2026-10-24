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

async function inspectBoth() {
  console.log('=== CHECKING FIRESTORE BOOKINGS ===');
  const bSnap = await getDocs(collection(db, 'bookings'));
  console.log(`Firestore bookings count: ${bSnap.size}`);
  
  const fsMethods = {};
  const fsSources = {};
  const fsStatuses = {};
  bSnap.docs.forEach((doc) => {
    const d = doc.data();
    const pm = d.paymentMethod || d.payment_method || 'MISSING';
    fsMethods[pm] = (fsMethods[pm] || 0) + 1;
    const src = d.source || 'MISSING';
    fsSources[src] = (fsSources[src] || 0) + 1;
    const st = d.status || 'MISSING';
    fsStatuses[st] = (fsStatuses[st] || 0) + 1;
  });

  console.log('Firestore paymentMethod counts:');
  console.table(fsMethods);
  console.log('Firestore source counts:');
  console.table(fsSources);
  console.log('Firestore status counts:');
  console.table(fsStatuses);

  // Check some sample Firestore docs with different payment methods
  for (const doc of bSnap.docs) {
    const d = doc.data();
    console.log(`[FS ${doc.id}] ticket: ${d.ticketNumber || d.bookingId} | method: "${d.paymentMethod}" | source: "${d.source}" | name: ${d.customerName}`);
  }

  process.exit(0);
}

inspectBoth().catch((e) => {
  console.error(e);
  process.exit(1);
});
