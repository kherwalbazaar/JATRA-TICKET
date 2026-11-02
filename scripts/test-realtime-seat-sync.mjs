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
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Helper to create independent customer clients
function createCustomerSession(name) {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sessionId = `sess_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return { name, client, sessionId };
}

async function runRealtimeSeatTestSuite() {
  console.log('================================================================');
  console.log('   JATRA BAZAAR — REAL-TIME SEAT RESERVATION VERIFICATION SUITE ');
  console.log('================================================================\n');

  // 1. Fetch available test event and seats
  const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: events, error: evErr } = await adminClient
    .from('events')
    .select('id, event_title, title')
    .limit(2);

  if (evErr || !events || events.length === 0) {
    throw new Error('No events found for testing: ' + evErr?.message);
  }

  const event1 = events[0];
  const event2 = events[1] || events[0];
  console.log(`Event 1: "${event1.event_title || event1.title}" (${event1.id})`);
  console.log(`Event 2: "${event2.event_title || event2.title}" (${event2.id})\n`);

  // Find 4 test seats in Event 1
  const { data: event1Seats, error: sErr } = await adminClient
    .from('seats')
    .select('*')
    .eq('event_id', event1.id)
    .eq('status', 'available')
    .limit(4);

  if (sErr || !event1Seats || event1Seats.length < 3) {
    throw new Error('Insufficient available seats in Event 1 for testing');
  }

  const testSeatA = event1Seats[0];
  const testSeatB = event1Seats[1];
  const testSeatC = event1Seats[2];
  console.log(`Test Seats in Event 1:`);
  console.log(`  Seat 1: id=${testSeatA.id}, label=${testSeatA.seat_label}, status=${testSeatA.status}`);
  console.log(`  Seat 2: id=${testSeatB.id}, label=${testSeatB.seat_label}, status=${testSeatB.status}`);
  console.log(`  Seat 3: id=${testSeatC.id}, label=${testSeatC.seat_label}, status=${testSeatC.status}\n`);

  // Create independent sessions: Customer A, Customer B, Customer C (Event 2)
  const custA = createCustomerSession('Customer_A');
  const custB = createCustomerSession('Customer_B');
  const custC = createCustomerSession('Customer_C_Event2');

  const channelTopic1 = `realtime:seats:${event1.id}`;
  const channelTopic2 = `realtime:seats:${event2.id}`;

  let bReceivedA1Reserved = false;
  let bReceivedA1Released = false;
  let bReceivedA3Booked = false;
  let cReceivedLeakOnEvent2 = false;

  console.log('--- Step 1: Connecting Customer Sessions to Realtime Channels ---');
  // Subscribe Customer B to Event 1
  const chB = custB.client.channel(channelTopic1)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'seats',
      filter: `event_id=eq.${event1.id}`,
    }, (payload) => {
      const seat = payload.new || {};
      console.log(`  [Customer B PG-Listener] Received seat update: ${seat.seat_label || seat.id} -> ${seat.status}`);
      if ((seat.id === testSeatA.id || seat.seat_label === testSeatA.seat_label) && seat.status === 'reserved') {
        bReceivedA1Reserved = true;
      }
      if ((seat.id === testSeatA.id || seat.seat_label === testSeatA.seat_label) && seat.status === 'available') {
        bReceivedA1Released = true;
      }
      if ((seat.id === testSeatC.id || seat.seat_label === testSeatC.seat_label) && seat.status === 'booked') {
        bReceivedA3Booked = true;
      }
    })
    .on('broadcast', { event: 'seat_change' }, (msg) => {
      const seat = msg.payload?.new || msg.new || {};
      console.log(`  [Customer B Broadcast-Listener] Received seat update: ${seat.seat_label || seat.id} -> ${seat.status}`);
      if ((seat.id === testSeatA.id || seat.seat_label === testSeatA.seat_label) && seat.status === 'reserved') {
        bReceivedA1Reserved = true;
      }
      if ((seat.id === testSeatA.id || seat.seat_label === testSeatA.seat_label) && seat.status === 'available') {
        bReceivedA1Released = true;
      }
      if ((seat.id === testSeatC.id || seat.seat_label === testSeatC.seat_label) && seat.status === 'booked') {
        bReceivedA3Booked = true;
      }
    });

  // Subscribe Customer C to Event 2 (Isolation check)
  const chC = custC.client.channel(channelTopic2)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'seats',
      filter: `event_id=eq.${event2.id}`,
    }, (payload) => {
      console.log(`  [Customer C Event 2] Unexpected leak:`, payload);
      cReceivedLeakOnEvent2 = true;
    })
    .on('broadcast', { event: 'seat_change' }, (msg) => {
      if (msg.payload?.eventId === event1.id) {
        console.log(`  [Customer C Event 2] Broadcast leaked from Event 1!`, msg);
        cReceivedLeakOnEvent2 = true;
      }
    });

  // Subscribe Customer A to Event 1
  const chA = custA.client.channel(channelTopic1);

  await Promise.all([
    new Promise((r) => chB.subscribe(r)),
    new Promise((r) => chC.subscribe(r)),
    new Promise((r) => chA.subscribe(r)),
  ]);

  console.log('Customer A, B, and C channels subscribed successfully.\n');
  await new Promise((r) => setTimeout(r, 1000));

  // -------------------------------------------------------------------------
  // Test A & B: Customer A reserves Seat 1 -> Customer B receives update
  // -------------------------------------------------------------------------
  console.log(`--- Test 1: Customer A reserves Seat ${testSeatA.seat_label} ---`);
  const nowIso = new Date().toISOString();
  const { data: reserveRes, error: resErr } = await custA.client
    .from('seats')
    .update({
      status: 'reserved',
      reserved_at: nowIso,
      reserved_by: custA.sessionId,
      updated_at: nowIso,
    })
    .eq('id', testSeatA.id)
    .select();

  if (resErr) {
    console.error('Reservation failed:', resErr);
  } else {
    console.log(`Customer A reserved seat in database: ${testSeatA.seat_label} (Status: reserved)`);
    // Broadcast notification
    await chA.send({
      type: 'broadcast',
      event: 'seat_change',
      payload: {
        eventType: 'UPDATE',
        new: reserveRes[0],
        eventId: event1.id,
      },
    });
  }

  // Wait for delivery to Customer B
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`Result: Customer B observed reservation: ${bReceivedA1Reserved ? 'PASS (Realtime OK)' : 'FAIL'}\n`);

  // -------------------------------------------------------------------------
  // Test 2: Double-Booking Race Condition Prevention (Simultaneous Booking)
  // -------------------------------------------------------------------------
  console.log(`--- Test 2: Simultaneous Double-Booking Race Condition on Seat ${testSeatB.seat_label} ---`);
  console.log(`Both Customer A and Customer B attempt to reserve ${testSeatB.seat_label} concurrently...`);

  // Attempt atomic reservation via direct concurrency check (mimicking server RPC/transaction)
  const attemptReservation = async (cust, seat) => {
    // 1. Check current status
    const { data: cur } = await cust.client
      .from('seats')
      .select('status, reserved_at, reserved_by')
      .eq('id', seat.id)
      .single();

    const isAvailable =
      !cur?.status ||
      cur.status === 'available' ||
      (cur.status === 'reserved' && (Date.now() - Date.parse(cur.reserved_at)) > 10 * 60 * 1000);

    if (!isAvailable) {
      return {
        success: false,
        code: 'SEAT_ALREADY_RESERVED',
        message: 'This seat has just been reserved by another customer. Please select another seat.',
      };
    }

    const stamp = new Date().toISOString();
    const { data: updated, error } = await cust.client
      .from('seats')
      .update({
        status: 'reserved',
        reserved_at: stamp,
        reserved_by: cust.sessionId,
        updated_at: stamp,
      })
      .eq('id', seat.id)
      .eq('status', 'available')
      .select();

    if (error || !updated || updated.length === 0) {
      return {
        success: false,
        code: 'SEAT_ALREADY_RESERVED',
        message: 'This seat has just been reserved by another customer. Please select another seat.',
      };
    }

    return { success: true, seat: updated[0] };
  };

  const [raceResA, raceResB] = await Promise.all([
    attemptReservation(custA, testSeatB),
    attemptReservation(custB, testSeatB),
  ]);

  console.log(`Customer A attempt:`, raceResA.success ? 'SUCCESS' : raceResA.message);
  console.log(`Customer B attempt:`, raceResB.success ? 'SUCCESS' : raceResB.message);

  const exactlyOneSucceeded = (raceResA.success && !raceResB.success) || (!raceResA.success && raceResB.success);
  const correctMessage =
    (!raceResA.success && raceResA.message.includes('Please select another seat')) ||
    (!raceResB.success && raceResB.message.includes('Please select another seat'));

  console.log(`Result: Double booking prevented: ${exactlyOneSucceeded ? 'PASS' : 'FAIL'}`);
  console.log(`Result: Rejection message verified: ${correctMessage ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------------------
  // Test 3: Customer A Cancels Reservation -> Seat becomes Available
  // -------------------------------------------------------------------------
  console.log(`--- Test 3: Customer A Cancels Reservation on Seat ${testSeatA.seat_label} ---`);
  const cancelStamp = new Date().toISOString();
  const { data: cancelRes } = await custA.client
    .from('seats')
    .update({
      status: 'available',
      reserved_at: null,
      reserved_by: null,
      updated_at: cancelStamp,
    })
    .eq('id', testSeatA.id)
    .select();

  await chA.send({
    type: 'broadcast',
    event: 'seat_change',
    payload: {
      eventType: 'UPDATE',
      new: cancelRes[0],
      eventId: event1.id,
    },
  });

  await new Promise((r) => setTimeout(r, 2000));
  console.log(`Result: Customer B received release update: ${bReceivedA1Released ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------------------
  // Test 4: Booking Completed -> Seat becomes Booked (Red)
  // -------------------------------------------------------------------------
  console.log(`--- Test 4: Customer A Completes Booking on Seat ${testSeatC.seat_label} ---`);
  const bookStamp = new Date().toISOString();
  const { data: bookedRes } = await custA.client
    .from('seats')
    .update({
      status: 'booked',
      booked_at: bookStamp,
      booking_id: `NJ26-TEST-${Date.now()}`,
      reserved_at: null,
      reserved_by: null,
      updated_at: bookStamp,
    })
    .eq('id', testSeatC.id)
    .select();

  await chA.send({
    type: 'broadcast',
    event: 'seat_change',
    payload: {
      eventType: 'UPDATE',
      new: bookedRes[0],
      eventId: event1.id,
    },
  });

  await new Promise((r) => setTimeout(r, 2000));
  console.log(`Result: Customer B received booked update: ${bReceivedA3Booked ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------------------
  // Test 5: Revert test seat 3 to available to leave database in clean state
  // -------------------------------------------------------------------------
  console.log('--- Cleaning Up Test Seats ---');
  await adminClient
    .from('seats')
    .update({
      status: 'available',
      booked_at: null,
      booking_id: null,
      reserved_at: null,
      reserved_by: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', [testSeatA.id, testSeatB.id, testSeatC.id]);

  // Clean up channels
  custA.client.removeChannel(chA);
  custB.client.removeChannel(chB);
  custC.client.removeChannel(chC);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                     TEST SUMMARY REPORT                        ');
  console.log('================================================================');
  console.log(`1. Real-Time Reservation Delivery:       ${bReceivedA1Reserved ? 'PASSED' : 'FAILED'}`);
  console.log(`2. Race Condition / Double Booking:       ${exactlyOneSucceeded ? 'PASSED' : 'FAILED'}`);
  console.log(`3. Collision Error Messaging:             ${correctMessage ? 'PASSED' : 'FAILED'}`);
  console.log(`4. Real-Time Cancellation / Release:      ${bReceivedA1Released ? 'PASSED' : 'FAILED'}`);
  console.log(`5. Real-Time Booking Confirmation (Red):  ${bReceivedA3Booked ? 'PASSED' : 'FAILED'}`);
  console.log(`6. Multi-Event Channel Isolation:         ${!cReceivedLeakOnEvent2 ? 'PASSED' : 'FAILED'}`);
  console.log('================================================================\n');

  const allPassed =
    bReceivedA1Reserved &&
    exactlyOneSucceeded &&
    correctMessage &&
    bReceivedA1Released &&
    bReceivedA3Booked &&
    !cReceivedLeakOnEvent2;

  process.exit(allPassed ? 0 : 1);
}

runRealtimeSeatTestSuite().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
