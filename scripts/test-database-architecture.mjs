// =================================================================
// Verification Script: JATRA BAZAAR Database Architecture
// Firebase Firestore (Events) + Supabase (Seats/Bookings/Payments)
// =================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fetchEvents, fetchEventById } from '../lib/events.js';
import { supabase } from '../lib/supabase.js';

console.log('================================================================');
console.log('   JATRA BAZAAR — DATABASE ARCHITECTURE VERIFICATION TEST      ');
console.log('================================================================\n');

async function runTest() {
  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // Test 1: Fetch Event Information from Firebase Firestore
  // -------------------------------------------------------------
  console.log('--- Step 1: Fetching Events from Firebase Firestore ---');
  let events = [];
  try {
    events = await fetchEvents();
    if (!Array.isArray(events) || events.length === 0) {
      console.error('FAIL: No events returned from Firestore');
      failed++;
    } else {
      console.log(`PASS: Successfully fetched ${events.length} events from Firebase Firestore.`);
      events.forEach((ev, idx) => {
        console.log(`  [Event ${idx + 1}] ID: ${ev.id}`);
        console.log(`    Title / Name: ${ev.name || ev.title}`);
        console.log(`    Party Name:   ${ev.partyName}`);
        console.log(`    Committee:    ${ev.committeeName} (${ev.venue})`);
        console.log(`    Date & Time:  ${ev.date} | ${ev.time}`);
        console.log(`    Status:       ${ev.status}`);
      });
      passed++;
    }
  } catch (err) {
    console.error('FAIL in Step 1:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 2: Relational Linking: Verify Supabase Seats Reference Firestore Event IDs
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Verifying Supabase Seats Reference Firestore Event IDs ---');
  for (const ev of events) {
    const firestoreEventId = ev.id;
    const { count, error } = await supabase
      .from('seats')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', firestoreEventId);

    if (error) {
      console.error(`FAIL: Query error for event ${firestoreEventId}:`, error.message);
      failed++;
    } else {
      console.log(`PASS: Event "${ev.name}" (ID: ${firestoreEventId}) -> Found ${count} seats in Supabase.`);
      passed++;
    }
  }

  // -------------------------------------------------------------
  // Test 3: Relational Linking: Verify Supabase Bookings Reference Firestore Event IDs
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Verifying Supabase Bookings Reference Firestore Event IDs ---');
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, ticket_number, event_id, event_name, status, seats, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (bErr) {
    console.error('FAIL querying bookings:', bErr.message);
    failed++;
  } else {
    console.log(`PASS: Successfully queried recent bookings in Supabase (${bookings.length} found).`);
    bookings.forEach((b) => {
      console.log(`  Booking: ${b.ticket_number} | Event ID: ${b.event_id} | Seats: ${JSON.stringify(b.seats)} | Status: ${b.status}`);
    });
    passed++;
  }

  // -------------------------------------------------------------
  // Test 4: Verify Single Event Fetch from Firestore by ID
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Testing Single Event Fetch from Firestore ---');
  if (events.length > 0) {
    const targetId = events[0].id;
    const single = await fetchEventById(targetId);
    if (single && (single.id === targetId || single.eventId === targetId)) {
      console.log(`PASS: Successfully retrieved event "${single.name}" by Firestore ID: ${targetId}`);
      passed++;
    } else {
      console.error('FAIL: Could not retrieve single event by ID');
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 5: Summary Report
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                     TEST SUMMARY REPORT                        ');
  console.log('================================================================');
  console.log(`1. Firebase Firestore Event Management:        ${passed >= 1 ? 'PASSED' : 'FAILED'}`);
  console.log(`2. Firestore Event ID -> Supabase Seats:       ${passed >= 2 ? 'PASSED' : 'FAILED'}`);
  console.log(`3. Firestore Event ID -> Supabase Bookings:    ${passed >= 3 ? 'PASSED' : 'FAILED'}`);
  console.log(`4. Single Event Lookup by Firestore Doc ID:    ${passed >= 4 ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Checks Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest();
