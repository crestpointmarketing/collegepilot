-- ============================================================
-- ASE — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Students table
-- Stores full Student JSON per user.
-- Composite PK (id, user_id) allows each user to have their own
-- set of student records with the same app-level IDs (s1, s7, etc.)
CREATE TABLE IF NOT EXISTS public.students (
  id          TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

-- Strategies table
-- Stores full Strategy JSON per student per user.
CREATE TABLE IF NOT EXISTS public.strategies (
  student_id  TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (student_id, user_id)
);

-- ── Row Level Security ──────────────────────────────────────
-- Each authenticated user can only read/write their own rows.

ALTER TABLE public.students  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own students"
  ON public.students
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own strategies"
  ON public.strategies
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Schools table (global reference data, same for all users)
CREATE TABLE IF NOT EXISTS public.schools (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all schools
CREATE POLICY "Authenticated users read schools"
  ON public.schools FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can seed schools (first-time setup)
CREATE POLICY "Authenticated users seed schools"
  ON public.schools FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
