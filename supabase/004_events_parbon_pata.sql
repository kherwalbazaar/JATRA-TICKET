-- ============================================================
-- Migration 004: Events seed — PARBON PATA (real show data)
-- JATRA BAZAAR — Customer app reads public.events via lib/events.js
-- Safe & Idempotent: Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Ensure the events table exists (matches normalizeSupabaseEvent in lib/events.js)
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  date DATE,
  event_title TEXT,
  title TEXT,
  party_name TEXT,
  committee_name TEXT,
  organizer TEXT,
  venue TEXT,
  address TEXT,
  committee_location TEXT,
  city TEXT,
  description TEXT,
  actors TEXT[],
  poster TEXT,
  additional_banners TEXT[],
  start_time TEXT,
  time TEXT,
  entry_time TEXT,
  status TEXT DEFAULT 'upcoming',
  total_capacity INTEGER DEFAULT 0,
  tickets_sold INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Realtime: allow postgres_changes on public.events (used by subscribeRealtimeEvents)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication may not exist on non-Supabase local setups; ignore.
  NULL;
END $$;

-- 3. Row Level Security — public read, writes for admin/service_role
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated select events" ON public.events;
DROP POLICY IF EXISTS "Service role full access on events" ON public.events;

CREATE POLICY "Allow anon and authenticated select events"
  ON public.events
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role full access on events"
  ON public.events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Clean up any dummy test row
DELETE FROM public.events WHERE id = 'parbon-pata-2026-10-22';

-- 5. Seed / Upsert the real PARBON PATA show (OCT 22 2026, Basipitha, Khunta)
INSERT INTO public.events (
  id,
  date,
  event_title,
  title,
  party_name,
  committee_name,
  organizer,
  venue,
  address,
  committee_location,
  city,
  description,
  poster,
  additional_banners,
  entry_time,
  start_time,
  time,
  status,
  total_capacity,
  tickets_sold,
  total_revenue,
  actors,
  writer,
  director,
  singer,
  phone,
  trailer_url
) VALUES (
  'grkob7qf2CVAGzmErahv',
  '2026-10-22',
  'PARBON PATA',
  'AAM KHATIR JIWI TINJ MA LOH KAN NOTE KOYOG MERE GATINJ BAGIYAM KAAN',
  'RAMRAJ GAYAN MOHAL',
  'ADIM LAHAH MANDAWA',
  'ADIM LAHAH MANDAWA',
  'Basipitha, Khunta, Mayurbhanj, Odisha - 757035',
  'Basipitha, Khunta, Mayurbhanj, Odisha - 757035',
  'Bahanada, Khunta, Mayurbhanj',
  'Mayurbhanj',
  'Adim Lahah Mandawa is a grand Jatra performance featuring traditional folk art, music, and cultural storytelling. Experience the vibrant colors and rhythms of Odisha''s rich theatrical heritage.',
  'https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg',
  ARRAY['https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg'],
  '9:00 PM',
  '11:00 PM',
  '11:00 PM - 5:00 AM',
  'upcoming',
  575,
  6,
  325.56,
  ARRAY['Biswanth', 'Dasarath'],
  'Maheswar Soren',
  'Dasarath Sing',
  'Suzki Somay',
  '+91 6372859599',
  'https://youtu.be/2fV_X3KzdxQ?si=3BTE0zHmzwXylnrm'
)
ON CONFLICT (id) DO UPDATE SET
  date = EXCLUDED.date,
  event_title = EXCLUDED.event_title,
  title = EXCLUDED.title,
  party_name = EXCLUDED.party_name,
  committee_name = EXCLUDED.committee_name,
  organizer = EXCLUDED.organizer,
  venue = EXCLUDED.venue,
  address = EXCLUDED.address,
  committee_location = EXCLUDED.committee_location,
  city = EXCLUDED.city,
  description = EXCLUDED.description,
  poster = EXCLUDED.poster,
  additional_banners = EXCLUDED.additional_banners,
  entry_time = EXCLUDED.entry_time,
  start_time = EXCLUDED.start_time,
  time = EXCLUDED.time,
  status = EXCLUDED.status,
  actors = EXCLUDED.actors,
  writer = EXCLUDED.writer,
  director = EXCLUDED.director,
  singer = EXCLUDED.singer,
  phone = EXCLUDED.phone,
  trailer_url = EXCLUDED.trailer_url,
  updated_at = now();

-- 6. Instantly reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
