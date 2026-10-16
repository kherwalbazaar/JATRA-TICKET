-- ============================================================
-- Migration 007: Google OAuth Authentication Support
-- JATRA BAZAAR — Customer Profiles & OAuth Integration
-- ============================================================

-- 1. Make mobile column nullable so Google OAuth users can authenticate first
ALTER TABLE public.profiles ALTER COLUMN mobile DROP NOT NULL;

-- 2. Update unique constraint so multiple NULLs are permitted
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_mobile_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS uq_profiles_mobile;

-- 3. Unique index only for non-null, non-empty mobile numbers
DROP INDEX IF EXISTS idx_profiles_unique_mobile;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_mobile 
  ON public.profiles(mobile) 
  WHERE mobile IS NOT NULL AND mobile != '';

-- 4. Index on email for rapid lookup of Google users
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
