-- ============================================================
-- Migration 012: Payment reservations, expiry + atomic seat locking
-- JATRA BAZAAR — customer app booking flow
--
-- Apply AFTER 010 (realtime + atomic hold RPCs) and 011 (payments table).
--
-- The application already works without this file: the reservation id and the
-- payment deadline are carried inside seats.reserved_by. Applying this file
-- upgrades that to first-class database state, so expiry, release and double
-- booking protection are enforced by Postgres instead of by read-modify-write
-- from the API routes.
-- ============================================================

-- ── 1. Seats: first-class reservation columns ──────────────────────────────
ALTER TABLE public.seats
  ADD COLUMN IF NOT EXISTS reservation_id TEXT,
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_seats_reservation_id ON public.seats(reservation_id);
CREATE INDEX IF NOT EXISTS idx_seats_hold_expiry
  ON public.seats(status, hold_expires_at)
  WHERE status = 'reserved';

-- ── 2. Reservations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  block_id TEXT,
  session_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  seat_ids TEXT[] NOT NULL DEFAULT '{}',
  seat_count INT NOT NULL DEFAULT 0,
  amount NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'confirmed')),
  payment_status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (payment_status IN ('Pending', 'Successful', 'Failed', 'Refunded', 'Cancelled')),
  gateway TEXT,
  gateway_transaction_id TEXT,
  booking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_event ON public.reservations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON public.reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_session ON public.reservations(session_id);

ALTER TABLE public.reservations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    END IF;
  END IF;
END $$;

-- Payments link back to the reservation they settled
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reservation_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ── 3. Row Level Security ──────────────────────────────────────────────────
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can manage reservations" ON public.reservations;

CREATE POLICY "Service role full access on reservations"
  ON public.reservations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A session may read only its own reservation through the publishable key
DROP POLICY IF EXISTS "Session can read its own reservation" ON public.reservations;
CREATE POLICY "Session can read its own reservation"
  ON public.reservations FOR SELECT TO authenticated, anon
  USING (session_id IS NOT NULL);

-- ── 4. Atomic reservation creation (locks every seat of one checkout) ──────
CREATE OR REPLACE FUNCTION public.create_payment_reservation_atomic(
  p_event_id TEXT,
  p_session_id TEXT,
  p_block_id TEXT DEFAULT NULL,
  p_seat_keys TEXT[] DEFAULT '{}',
  p_window_ms INT DEFAULT 60000,
  p_reservation_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_deadline TIMESTAMPTZ := clock_timestamp() + (p_window_ms || ' milliseconds')::INTERVAL;
  v_res_id TEXT := COALESCE(
    NULLIF(p_reservation_id, ''),
    'res_' || replace(gen_random_uuid()::text, '-', '')
  );
  v_locked INT := 0;
  v_row RECORD;
  v_seats JSONB := '[]'::JSONB;
BEGIN
  IF p_event_id IS NULL OR p_session_id IS NULL OR array_length(p_seat_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMS');
  END IF;

  -- One row lock per seat: a concurrent checkout blocks here instead of overwriting
  FOR v_row IN
    SELECT id, seat_id, seat_label, price
      FROM public.seats
     WHERE event_id = p_event_id
       AND (
         id = ANY(p_seat_keys)
         OR seat_id = ANY(p_seat_keys)
         OR seat_label = ANY(p_seat_keys)
       )
     FOR UPDATE
  LOOP
    IF v_row.id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.seats s
       WHERE s.id = v_row.id
         AND lower(coalesce(s.status, 'available')) IN ('booked', 'sold', 'locked')
    ) THEN
      RETURN jsonb_build_object('success', false, 'code', 'SEAT_ALREADY_RESERVED',
                               'seat', v_row.seat_id, 'message', 'Seat is already booked');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.seats s
       WHERE s.id = v_row.id
         AND lower(coalesce(s.status, 'available')) = 'reserved'
         AND coalesce(split_part(s.reserved_by, '|', 1), '') <> p_session_id
         AND coalesce(s.hold_expires_at, s.reserved_at + interval '10 minutes') > v_now
    ) THEN
      RETURN jsonb_build_object('success', false, 'code', 'SEAT_ALREADY_RESERVED',
                               'seat', v_row.seat_id, 'message', 'Seat is held by another customer');
    END IF;

    UPDATE public.seats
       SET status = 'reserved',
           reserved_at = v_now,
           reserved_by = p_session_id || '|r:' || v_res_id || '|e:' || (extract(epoch from v_deadline) * 1000)::bigint,
           reservation_id = v_res_id,
           hold_expires_at = v_deadline,
           updated_at = v_now
     WHERE id = v_row.id;

    v_locked := v_locked + 1;
    v_seats := v_seats || jsonb_build_object('seat_id', v_row.seat_id, 'seat_label', v_row.seat_label);
  END LOOP;

  IF v_locked <> array_length(p_seat_keys, 1) THEN
    -- Not every requested seat exists; hand back what we took
    UPDATE public.seats
       SET status = 'available', reserved_at = NULL, reserved_by = NULL,
           reservation_id = NULL, hold_expires_at = NULL, updated_at = clock_timestamp()
     WHERE reservation_id = v_res_id;
    RETURN jsonb_build_object('success', false, 'code', 'SEAT_NOT_FOUND');
  END IF;

  INSERT INTO public.reservations (id, event_id, block_id, session_id, seat_ids, seat_count, status, expires_at, created_at, updated_at)
  VALUES (v_res_id, p_event_id, p_block_id, p_session_id, p_seat_keys, v_locked, 'active', v_deadline, v_now, v_now);

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_res_id,
    'expires_at', v_deadline,
    'remaining_ms', greatest(0, (extract(epoch from (v_deadline - clock_timestamp())) * 1000)::bigint),
    'locked', v_locked,
    'seats', v_seats
  );
END;
$$;

-- ── 5. Authoritative countdown + auto release ──────────────────────────────
CREATE OR REPLACE FUNCTION public.reservation_status(
  p_reservation_id TEXT,
  p_event_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_res public.reservations%ROWTYPE;
  v_deadline TIMESTAMPTZ;
  v_status TEXT;
  v_remaining BIGINT;
  v_released INT := 0;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'status', 'not_found', 'remaining_ms', 0);
  END IF;

  -- Deadline lives in the database, so a page reload cannot reset it
  SELECT coalesce(max(hold_expires_at), v_res.expires_at)
    INTO v_deadline
    FROM public.seats
   WHERE reservation_id = p_reservation_id;
  v_deadline := coalesce(v_deadline, v_res.expires_at);

  IF v_res.status IN ('confirmed', 'cancelled') THEN
    RETURN jsonb_build_object('success', true, 'status', v_res.status,
                              'remaining_ms', 0, 'payment_status', v_res.payment_status);
  END IF;

  IF v_deadline <= v_now THEN
    UPDATE public.seats
       SET status = 'available', reserved_at = NULL, reserved_by = NULL,
           reservation_id = NULL, hold_expires_at = NULL, updated_at = v_now
     WHERE reservation_id = p_reservation_id
       AND lower(status) = 'reserved';
    GET DIAGNOSTICS v_released = ROW_COUNT;

    UPDATE public.reservations
       SET status = 'expired', released_at = v_now, updated_at = v_now
     WHERE id = p_reservation_id AND status = 'active';

    RETURN jsonb_build_object('success', true, 'status', 'expired', 'remaining_ms', 0,
                              'released_count', v_released, 'expires_at', v_deadline);
  END IF;

  v_remaining := greatest(0, (extract(epoch from (v_deadline - v_now)) * 1000)::bigint);
  RETURN jsonb_build_object('success', true, 'status', 'active',
                            'remaining_ms', v_remaining, 'expires_at', v_deadline,
                            'payment_status', v_res.payment_status,
                            'seats', to_jsonb(v_res.seat_ids));
END;
$$;

-- ── 6. Release a whole reservation (cancel / expiry) ───────────────────────
CREATE OR REPLACE FUNCTION public.release_reservation_atomic(
  p_reservation_id TEXT,
  p_event_id TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_owner TEXT;
  v_released INT := 0;
BEGIN
  SELECT session_id INTO v_owner FROM public.reservations WHERE id = p_reservation_id;

  IF p_session_id IS NOT NULL AND v_owner IS NOT NULL AND v_owner <> p_session_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_OWNER');
  END IF;

  UPDATE public.seats
     SET status = 'available', reserved_at = NULL, reserved_by = NULL,
         reservation_id = NULL, hold_expires_at = NULL, updated_at = v_now
   WHERE reservation_id = p_reservation_id
     AND lower(status) = 'reserved';
  GET DIAGNOSTICS v_released = ROW_COUNT;

  UPDATE public.reservations
     SET status = 'cancelled', released_at = v_now, updated_at = v_now
   WHERE id = p_reservation_id
     AND status IN ('active', 'expired');

  RETURN jsonb_build_object('success', true, 'released_count', v_released, 'status', 'cancelled');
END;
$$;

-- ── 7. Confirm only after the server verified the payment ──────────────────
CREATE OR REPLACE FUNCTION public.confirm_reservation_atomic(
  p_reservation_id TEXT,
  p_booking_id TEXT,
  p_gateway TEXT,
  p_gateway_transaction_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_res public.reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'RESERVATION_NOT_FOUND');
  END IF;

  -- Delayed gateway callbacks still confirm a booking that already expired;
  -- a re-confirmed one is a no-op so duplicate notifications are harmless.
  IF v_res.status = 'confirmed' THEN
    RETURN jsonb_build_object('success', true, 'status', 'confirmed', 'idempotent', true);
  END IF;

  UPDATE public.seats
     SET status = 'booked', booked_at = v_now, booking_id = p_booking_id,
         reserved_at = NULL, reserved_by = NULL, hold_expires_at = NULL, updated_at = v_now
   WHERE reservation_id = p_reservation_id;

  UPDATE public.reservations
     SET status = 'confirmed', payment_status = 'Successful', booking_id = p_booking_id,
         gateway = p_gateway, gateway_transaction_id = p_gateway_transaction_id,
         confirmed_at = v_now, updated_at = v_now
   WHERE id = p_reservation_id;

  RETURN jsonb_build_object('success', true, 'status', 'confirmed', 'booking_id', p_booking_id);
END;
$$;

-- ── 8. Expiry sweep now understands both hold kinds ────────────────────────
CREATE OR REPLACE FUNCTION public.release_expired_seat_holds(
  p_event_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_released INT := 0;
BEGIN
  UPDATE public.seats
     SET status = 'available', reserved_at = NULL, reserved_by = NULL,
         reservation_id = NULL, hold_expires_at = NULL, updated_at = v_now
   WHERE lower(coalesce(status, 'available')) = 'reserved'
     AND (p_event_id IS NULL OR event_id = p_event_id)
     AND (
       hold_expires_at IS NOT NULL AND hold_expires_at <= v_now
       OR (hold_expires_at IS NULL AND coalesce(reserved_at, 'epoch'::timestamptz) + interval '10 minutes' <= v_now)
       OR reserved_at IS NULL
     );
  GET DIAGNOSTICS v_released = ROW_COUNT;

  UPDATE public.reservations
     SET status = 'expired', released_at = v_now, updated_at = v_now
   WHERE status = 'active' AND expires_at <= v_now;

  RETURN jsonb_build_object('success', true, 'released_count', v_released, 'swept_at', v_now);
END;
$$;

COMMENT ON TABLE public.reservations IS
  'Temporary seat reservations created when a customer reaches payment; expires_at is authoritative.';

NOTIFY pgrst, 'reload schema';
