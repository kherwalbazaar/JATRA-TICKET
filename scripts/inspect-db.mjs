import fs from 'node:fs';
import path from 'node:path';
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase publishable/anon key in .env.local');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

const tables = [
  'events',
  'ticket_types',
  'block_categories',
  'banners',
  'settings',
  'seats',
  'bookings',
  'tickets',
  'ticket_entries',
  'profiles',
];

async function run() {
  console.log(`Supabase project: ${new URL(supabaseUrl).host}\n`);

  let failures = 0;
  for (const table of tables) {
    const { error, count } = await sb
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      failures += 1;
      console.log(`[${table}] ERROR ${error.code || ''} ${error.message}`);
    } else {
      console.log(`[${table}] ok - ${count ?? 'unknown'} row(s)`);
    }
  }

  console.log('\n=== Seat booking path ===');
  const { data: events, error: eventsErr } = await sb
    .from('events')
    .select('id, event_title, date, status')
    .order('date', { ascending: true });

  if (eventsErr) {
    failures += 1;
    console.log(`events lookup ERROR ${eventsErr.message}`);
  } else {
    for (const ev of events || []) {
      const { data: seats, error: seatsErr } = await sb
        .from('seats')
        .select('id, status, price')
        .eq('event_id', ev.id);

      if (seatsErr) {
        failures += 1;
        console.log(`  ${ev.id} "${ev.event_title}" seats ERROR ${seatsErr.message}`);
        continue;
      }
      const counts = {};
      for (const s of seats || []) {
        const st = s.status || 'unknown';
        counts[st] = (counts[st] || 0) + 1;
      }
      console.log(
        `  ${ev.id} "${ev.event_title}" ${ev.date || ''}: ${seats?.length || 0} seat(s)`,
        counts
      );
    }
  }

  console.log('\n=== Recent bookings ===');
  const { data: bookings, error: bookingsErr } = await sb
    .from('bookings')
    .select('ticket_number, event_name, customer_name, seat_count, status, payment_status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (bookingsErr) {
    failures += 1;
    console.log(`bookings ERROR ${bookingsErr.message}`);
  } else {
    for (const b of bookings || []) {
      console.log(
        `  ${b.ticket_number} | ${b.event_name} | ${b.customer_name} | ${b.seat_count} seat(s) | ${b.status}/${b.payment_status}`
      );
    }
  }

  console.log(`\n${failures === 0 ? 'All Supabase checks passed.' : `${failures} Supabase check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
