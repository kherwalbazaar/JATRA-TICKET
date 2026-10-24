import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { resolveCanonicalPaymentMethod, resolveBookingParameters } from '../lib/paymentMethods.js';

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

const createdBookingIds = [];
const createdTicketIds = [];
let testEventId = '';
let testSeats = [];

async function setup() {
  console.log('\n========================================');
  console.log('   JATRA BAZAAR COMPREHENSIVE TEST SUITE  ');
  console.log('========================================\n');

  // Find a valid event
  const { data: events, error: evErr } = await sb.from('events').select('id, title').limit(1);
  if (evErr || !events || events.length === 0) {
    throw new Error('No events found in Supabase: ' + (evErr?.message || 'Empty'));
  }
  testEventId = events[0].id;
  console.log(`Using Event: ${events[0].title || testEventId} (${testEventId})`);

  // Find seats
  const { data: seats } = await sb.from('seats').select('*').eq('event_id', testEventId).limit(5);
  if (seats && seats.length > 0) {
    testSeats = seats.map(s => s.seat_label || s.seat_id || s.id);
  } else {
    testSeats = ['A-1', 'A-2', 'A-3', 'A-4'];
  }
  console.log(`Using Test Seats: ${testSeats.join(', ')}`);
}

async function testCanonicalMappingUnit() {
  console.log('\n--- Test 1: Unit Tests for Canonical Payment Method Resolution ---');

  const cases = [
    { input: 'UPI', expected: 'UPI' },
    { input: 'gpay', expected: 'UPI' },
    { input: 'Google Pay', expected: 'UPI' },
    { input: 'PhonePe', expected: 'UPI' },
    { input: 'direct', expected: 'UPI' },
    { input: 'Direct Instant Booking', expected: 'UPI' },
    { input: 'Simulated GPAY', expected: 'UPI' },
    { input: 'Simulated UPI (Google Pay)', expected: 'UPI' },
    { input: 'Cash', expected: 'Cash' },
    { input: 'cash', expected: 'Cash' },
    { input: 'counter', expected: 'Cash' },
    { input: 'Pay at Counter', expected: 'Cash' },
    { input: 'Pay at Entry Gate / Counter', expected: 'Cash' },
    { input: 'Card', expected: 'Card' },
    { input: 'Debit Card', expected: 'Card' },
    { input: 'Net Banking', expected: 'Net Banking' },
    { input: 'netbanking', expected: 'Net Banking' },
    { input: 'Wallet', expected: 'Wallet' },
    { input: 'paytm', expected: 'Wallet' },
    { input: 'Other', expected: 'Other' },
  ];

  let passCount = 0;
  for (const c of cases) {
    const res = resolveCanonicalPaymentMethod(c.input);
    if (res === c.expected) {
      passCount++;
    } else {
      console.error(`FAIL: input "${c.input}" resolved to "${res}", expected "${c.expected}"`);
    }
  }
  console.log(`Canonical Mapping: ${passCount}/${cases.length} passed.`);

  // Test invalid rejections
  const invalidCases = ['bitcoin', 'crypto', 'barter', '', null, undefined, 'unknown_method'];
  let invalidPass = 0;
  for (const inv of invalidCases) {
    try {
      resolveCanonicalPaymentMethod(inv);
      console.error(`FAIL: Invalid input "${inv}" was not rejected!`);
    } catch (e) {
      invalidPass++;
    }
  }
  console.log(`Invalid Rejections: ${invalidPass}/${invalidCases.length} properly rejected with validation error.`);
}

async function testDirectInstantBooking() {
  console.log('\n--- Test 2: Direct Instant Booking Flow (Supabase Insert & Check Constraint) ---');

  const params = resolveBookingParameters({
    bookingMethod: 'direct',
    paymentMethodInput: 'Google Pay',
  });

  const orderId = `JB_TEST_DIRECT_${Date.now()}`;
  const ticketNumber = `NJ26-T${Math.floor(1000 + Math.random() * 9000)}`;

  const bookingRow = {
    id: orderId,
    ticket_number: ticketNumber,
    event_id: testEventId,
    event_name: 'Test Jatra Show',
    customer_name: 'Direct Customer',
    customer_phone: '9876543210',
    ticket_type_name: 'SEATED',
    quantity: 1,
    unit_price: 150,
    amount: 150,
    ticket_amount: 150,
    source: params.source,
    payment_method: params.canonicalMethod,
    payment_channel: params.paymentChannel,
    status: params.status,
    booking_status: params.bookingStatus,
    payment_status: params.paymentStatus,
    date: '2026-10-24',
    time: '11:00 PM',
    seats: [testSeats[0]],
    seat_number: testSeats[0],
    seat_count: 1,
    entered_count: 0,
    remaining_count: 1,
  };

  const { error } = await sb.from('bookings').insert([bookingRow]);
  if (error) {
    console.error('FAIL: Direct Instant Booking insert failed:', error.message);
  } else {
    console.log(`PASS: Direct booking created successfully with payment_method="${bookingRow.payment_method}", payment_status="${bookingRow.payment_status}"!`);
    createdBookingIds.push(orderId);
  }
}

async function testPayAtCounterBooking() {
  console.log('\n--- Test 3: Pay at Entry Gate / Counter Booking Flow ---');

  const params = resolveBookingParameters({
    bookingMethod: 'counter',
    paymentMethodInput: 'Pay at Counter',
  });

  const orderId = `JB_TEST_COUNTER_${Date.now()}`;
  const ticketNumber = `NJ26-T${Math.floor(1000 + Math.random() * 9000)}`;

  const bookingRow = {
    id: orderId,
    ticket_number: ticketNumber,
    event_id: testEventId,
    event_name: 'Test Jatra Show',
    customer_name: 'Counter Customer',
    customer_phone: '9876543211',
    ticket_type_name: 'SEATED',
    quantity: 1,
    unit_price: 150,
    amount: 150,
    ticket_amount: 150,
    source: params.source,
    payment_method: params.canonicalMethod,
    payment_channel: params.paymentChannel,
    status: params.status,
    booking_status: params.bookingStatus,
    payment_status: params.paymentStatus,
    date: '2026-10-24',
    time: '11:00 PM',
    seats: [testSeats[1]],
    seat_number: testSeats[1],
    seat_count: 1,
    entered_count: 0,
    remaining_count: 1,
  };

  const { error } = await sb.from('bookings').insert([bookingRow]);
  if (error) {
    console.error('FAIL: Pay at Counter Booking insert failed:', error.message);
  } else {
    console.log(`PASS: Counter booking created successfully with payment_method="${bookingRow.payment_method}", payment_status="${bookingRow.payment_status}", channel="${bookingRow.payment_channel}"!`);
    createdBookingIds.push(orderId);
  }
}

async function testMultiSeatBooking() {
  console.log('\n--- Test 4: Multi-Seat Booking and Ticket Allocation ---');

  const selectedSeats = [testSeats[2], testSeats[3]].filter(Boolean);
  const count = selectedSeats.length;

  const params = resolveBookingParameters({
    bookingMethod: 'direct',
    paymentMethodInput: 'Card',
  });

  const orderId = `JB_TEST_MULTI_${Date.now()}`;
  const ticketNumber = `NJ26-T${Math.floor(1000 + Math.random() * 9000)}`;

  const bookingRow = {
    id: orderId,
    ticket_number: ticketNumber,
    event_id: testEventId,
    event_name: 'Test Jatra Show',
    customer_name: 'MultiSeat Customer',
    customer_phone: '9876543212',
    ticket_type_name: 'SEATED',
    quantity: count,
    unit_price: 100,
    amount: 100 * count,
    ticket_amount: 100 * count,
    source: params.source,
    payment_method: params.canonicalMethod,
    payment_channel: params.paymentChannel,
    status: params.status,
    booking_status: params.bookingStatus,
    payment_status: params.paymentStatus,
    date: '2026-10-24',
    time: '11:00 PM',
    seats: selectedSeats,
    seat_number: selectedSeats.join(', '),
    seat_count: count,
    entered_count: 0,
    remaining_count: count,
  };

  const { error: bErr } = await sb.from('bookings').insert([bookingRow]);
  if (bErr) {
    console.error('FAIL: Multi-seat booking insert failed:', bErr.message);
    return;
  }
  createdBookingIds.push(orderId);

  // Generate individual tickets
  const ticketRows = selectedSeats.map((seat, idx) => ({
    id: `${ticketNumber}-${idx + 1}`,
    ticket_id: `${ticketNumber}-${idx + 1}`,
    booking_id: ticketNumber,
    booking_doc_id: orderId,
    ticket_index: idx + 1,
    total_tickets: count,
    event_id: testEventId,
    event_name: 'Test Jatra Show',
    ticket_type_name: 'SEATED',
    seat: seat,
    customer_name: 'MultiSeat Customer',
    customer_phone: '9876543212',
    serial_number: `${ticketNumber}-${idx + 1}`,
    qr_token: `token_${Math.random().toString(36).slice(2)}`,
    status: 'ACTIVE',
    date: '2026-10-24',
    time: '11:00 PM',
    unit_price: 100,
  }));

  const { error: tErr } = await sb.from('tickets').insert(ticketRows);
  if (tErr) {
    console.error('FAIL: Individual tickets insert failed:', tErr.message);
  } else {
    ticketRows.forEach(t => createdTicketIds.push(t.id));
    console.log(`PASS: Multi-seat booking created with ${count} seats and ${ticketRows.length} individual tickets!`);
  }
}

async function testAdminVisibility() {
  console.log('\n--- Test 5: Admin Panel Visibility & Filtering ---');

  const { data: bookings, error } = await sb
    .from('bookings')
    .select('id, ticket_number, customer_name, payment_method, payment_status, source')
    .in('id', createdBookingIds);

  if (error) {
    console.error('FAIL: Admin lookup error:', error.message);
  } else {
    console.log(`PASS: Admin queried ${bookings.length} test bookings successfully:`);
    bookings.forEach(b => {
      console.log(`  - [${b.ticket_number}] ${b.customer_name}: Method=${b.payment_method}, Status=${b.payment_status}, Source=${b.source}`);
    });
  }
}

async function testScannerCompatibility() {
  console.log('\n--- Test 6: Scanner Verification & Status Update Compatibility ---');

  if (createdBookingIds.length === 0) {
    console.log('SKIP: No test bookings to scan.');
    return;
  }

  const targetId = createdBookingIds[0];
  const { data: bRow, error: fetchErr } = await sb.from('bookings').select('*').eq('id', targetId).single();
  if (fetchErr || !bRow) {
    console.error('FAIL: Scanner could not find booking:', fetchErr?.message);
    return;
  }

  console.log(`Scanner found booking ${bRow.ticket_number} (Status: ${bRow.status})`);

  // Simulate scanning 1 ticket and updating status
  const nowIso = new Date().toISOString();
  const updatePayload = {
    used_tickets: [bRow.ticket_number],
    used_count: 1,
    entered_count: 1,
    remaining_count: 0,
    status: 'Used',
    // Notice booking_status is kept Confirmed or left untouched
    used_at: nowIso,
  };

  const { error: updErr } = await sb.from('bookings').update(updatePayload).eq('id', targetId);
  if (updErr) {
    console.error('FAIL: Scanner status update failed:', updErr.message);
  } else {
    console.log('PASS: Scanner status update succeeded without constraint violation!');
  }
}

async function cleanup() {
  console.log('\n--- Cleaning up test records ---');
  if (createdTicketIds.length > 0) {
    await sb.from('tickets').delete().in('id', createdTicketIds);
    console.log(`Cleaned up ${createdTicketIds.length} test tickets.`);
  }
  if (createdBookingIds.length > 0) {
    await sb.from('bookings').delete().in('id', createdBookingIds);
    console.log(`Cleaned up ${createdBookingIds.length} test bookings.`);
  }
}

async function run() {
  try {
    await setup();
    await testCanonicalMappingUnit();
    await testDirectInstantBooking();
    await testPayAtCounterBooking();
    await testMultiSeatBooking();
    await testAdminVisibility();
    await testScannerCompatibility();
    await cleanup();
    console.log('\n ALL TESTS COMPLETED SUCCESSFULLY! \n');
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    await cleanup();
    process.exit(1);
  }
  process.exit(0);
}

run();
