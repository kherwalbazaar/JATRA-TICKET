-- ============================================================
-- Migration 006: Atomic Daily SMS Limits & Concurrency Safety
-- JATRA BAZAAR — Real OTP Authentication & SMS Quota Management
-- ============================================================

-- 1. Ensure tracking columns exist on public.sms_daily_logs
ALTER TABLE public.sms_daily_logs
  ADD COLUMN IF NOT EXISTS last_provider_request_id TEXT,
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;

-- 2. Atomic check for customer's daily SMS quota
CREATE OR REPLACE FUNCTION public.atomic_check_daily_sms(
  p_mobile TEXT,
  p_ist_date TEXT,
  p_max_limit INT DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_sent_count INT := 0;
  v_failed_count INT := 0;
  v_allowed BOOLEAN := true;
  v_remaining INT := p_max_limit;
BEGIN
  SELECT sent_count, failed_count
  INTO v_sent_count, v_failed_count
  FROM public.sms_daily_logs
  WHERE mobile = p_mobile AND ist_date = p_ist_date;

  IF NOT FOUND THEN
    v_sent_count := 0;
    v_failed_count := 0;
  END IF;

  v_remaining := GREATEST(0, p_max_limit - v_sent_count);
  v_allowed := v_sent_count < p_max_limit;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'sent_count', v_sent_count,
    'failed_count', v_failed_count,
    'remaining', v_remaining,
    'max_limit', p_max_limit,
    'ist_date', p_ist_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 3. Atomic recording of SMS delivery outcome
-- Increments sent_count ONLY on confirmed provider acceptance (p_success = true)
-- Increments failed_count separately without counting toward daily quota (p_success = false)
CREATE OR REPLACE FUNCTION public.atomic_record_sms_delivery(
  p_mobile TEXT,
  p_ist_date TEXT,
  p_success BOOLEAN,
  p_provider_request_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_sent INT;
  v_new_failed INT;
BEGIN
  INSERT INTO public.sms_daily_logs (
    mobile,
    ist_date,
    sent_count,
    failed_count,
    last_provider_request_id,
    last_failure_reason,
    created_at,
    updated_at
  )
  VALUES (
    p_mobile,
    p_ist_date,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_provider_request_id,
    p_error_message,
    now(),
    now()
  )
  ON CONFLICT (mobile, ist_date)
  DO UPDATE SET
    sent_count = CASE
      WHEN p_success THEN public.sms_daily_logs.sent_count + 1
      ELSE public.sms_daily_logs.sent_count
    END,
    failed_count = CASE
      WHEN NOT p_success THEN public.sms_daily_logs.failed_count + 1
      ELSE public.sms_daily_logs.failed_count
    END,
    last_provider_request_id = COALESCE(p_provider_request_id, public.sms_daily_logs.last_provider_request_id),
    last_failure_reason = CASE
      WHEN NOT p_success THEN p_error_message
      ELSE public.sms_daily_logs.last_failure_reason
    END,
    updated_at = now()
  RETURNING sent_count, failed_count
  INTO v_new_sent, v_new_failed;

  RETURN jsonb_build_object(
    'success', true,
    'sent_count', v_new_sent,
    'failed_count', v_new_failed,
    'remaining', GREATEST(0, 3 - v_new_sent)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 4. Atomic reset of daily SMS quota and unconsumed OTPs (Dev / Admin tool)
CREATE OR REPLACE FUNCTION public.atomic_reset_daily_sms(
  p_mobile TEXT,
  p_ist_date TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  IF p_ist_date IS NOT NULL THEN
    DELETE FROM public.sms_daily_logs
    WHERE mobile = p_mobile AND ist_date = p_ist_date;
  ELSE
    DELETE FROM public.sms_daily_logs
    WHERE mobile = p_mobile;
  END IF;

  DELETE FROM public.customer_otps
  WHERE mobile = p_mobile;

  RETURN jsonb_build_object(
    'success', true,
    'mobile', p_mobile,
    'sent_count', 0,
    'remaining', 3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
