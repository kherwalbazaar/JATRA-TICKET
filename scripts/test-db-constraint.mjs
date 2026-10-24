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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const candidateValues = [
  'UPI',
  'Cash',
  'Card',
  'Net Banking',
  'Wallet',
  'Other',
  'Direct Booking',
  'direct',
  'Pay at Counter',
  'counter',
  'Paytm',
  'paytm',
  'online',
  'Simulated UPI (Google Pay)',
  'Simulated PAY AT COUNTER',
  'PHONEPE',
];

async function testCandidate(val) {
  const testId = `TEST_CONSTRAINT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testTicket = `NJ26-TEST-${Math.floor(Math.random() * 100000)}`;

  // Find a valid event_id
  const { data: ev } = await sb.from('events').select('id').limit(1).maybeSingle();
  const eventId = ev?.id || 'evt_test';

  const testRow = {
    id: testId,
    ticket_number: testTicket,
    event_id: eventId,
    customer_name: 'Constraint Probe',
    customer_phone: '9999999999',
    ticket_type_name: 'SEATED',
    quantity: 1,
    unit_price: 10,
    amount: 10,
    source: 'Online',
    payment_method: val,
    date: '2026-10-24',
    time: '11:00 PM',
    status: 'Confirmed',
  };

  const { error } = await sb.from('bookings').insert([testRow]);

  if (error) {
    console.log(`Value "${val}" => REJECTED:`, error.message);
  } else {
    console.log(`Value "${val}" => ACCEPTED!`);
    // Delete the test row immediately
    await sb.from('bookings').delete().eq('id', testId);
  }
}

async function run() {
  console.log('--- TESTING PAYMENT METHOD VALUES AGAINST SUPABASE CONSTRAINT ---');
  for (const val of candidateValues) {
    await testCandidate(val);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
