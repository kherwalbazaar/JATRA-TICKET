import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
  'events',
  'bookings',
  'tickets',
  'ticketTypes',
  'ticketTiers',
  'seatMeta',
  'counters',
  'gates',
  'settings',
  'banners',
  'scannerMembers',
  'ticketEntries',
  'auditLogs',
  'logs',
  'users',
  'supportTickets',
];

function sorted(obj) {
  return Object.keys(obj || {})
    .sort()
    .join(', ');
}

console.log(`project: ${firebaseConfig.projectId}\n`);

for (const name of collections) {
  try {
    const snap = await getDocs(collection(db, name));
    console.log(`[${name}] ${snap.size} doc(s)`);
    snap.docs.slice(0, 3).forEach((d) => {
      const data = d.data();
      const preview = ['eventTitle', 'title', 'name', 'ticketNumber', 'status']
        .map((k) => (data[k] !== undefined ? `${k}=${JSON.stringify(data[k])}` : null))
        .filter(Boolean)
        .join(' ');
      console.log(`  - ${d.id}: ${preview}`);
      console.log(`      keys: ${sorted(data)}`);
    });
    if (snap.size > 3) console.log(`  ... +${snap.size - 3} more`);
  } catch (err) {
    console.log(`[${name}] ERROR ${err.code || ''} ${err.message}`);
  }
  console.log('');
}

try {
  const eventsSnap = await getDocs(collection(db, 'events'));
  console.log('');
  for (const ev of eventsSnap.docs) {
    const meta = await getDoc(doc(db, 'seatMeta', ev.id));
    const blocks = meta.exists() ? Object.keys(meta.data().blocks || {}) : [];
    let total = 0;
    for (const blockId of blocks) {
      const snap = await getDocs(collection(db, 'seats', ev.id, blockId));
      total += snap.size;
    }
    console.log(`[seats] event ${ev.id}: ${blocks.length} block(s), ${total} seat doc(s)`);
  }
} catch (err) {
  console.log(`[seats] ERROR ${err.code || ''} ${err.message}`);
}

try {
  const eventsSnap = await getDocs(collection(db, 'events'));
  console.log('\nevents raw shapes:');
  eventsSnap.docs.forEach((d) => {
    const data = d.data();
    console.log(
      `  ${d.id} | stored id=${JSON.stringify(data.id)} | title=${JSON.stringify(
        data.eventTitle ?? data.title ?? data.name,
      )} | date=${JSON.stringify(data.date)} | day=${JSON.stringify(
        data.day,
      )} | banners=${JSON.stringify(data.banners ?? data.additionalBanners ?? data.banner)} | desc=${(
        data.description ?? data.about ?? ''
      ).slice(0, 60)}`,
    );
  });
} catch (err) {
  console.log(`events shapes ERROR ${err.message}`);
}
