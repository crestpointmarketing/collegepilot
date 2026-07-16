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

-- Remove legacy orphan rows before enforcing ownership-preserving cascades.
DELETE FROM public.strategies AS strategy
WHERE NOT EXISTS (
  SELECT 1
  FROM public.students AS student
  WHERE student.id = strategy.student_id
    AND student.user_id = strategy.user_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'strategies_student_owner_fkey'
      AND conrelid = 'public.strategies'::regclass
  ) THEN
    ALTER TABLE public.strategies
      ADD CONSTRAINT strategies_student_owner_fkey
      FOREIGN KEY (student_id, user_id)
      REFERENCES public.students (id, user_id)
      ON DELETE CASCADE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── Row Level Security ──────────────────────────────────────
-- Each authenticated user can only read/write their own rows.

ALTER TABLE public.students  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own students" ON public.students;
CREATE POLICY "Users manage their own students"
  ON public.students
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own strategies" ON public.strategies;
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
DROP POLICY IF EXISTS "Authenticated users read schools" ON public.schools;
CREATE POLICY "Authenticated users read schools"
  ON public.schools FOR SELECT
  TO authenticated
  USING (true);

-- Schools are shipped as read-only application reference data. Do not allow
-- individual accounts to mutate the shared table.
DROP POLICY IF EXISTS "Authenticated users seed schools" ON public.schools;
REVOKE INSERT, UPDATE, DELETE ON public.schools FROM authenticated;

-- School research cache
-- Stores AI-generated program research per user so strategy/chat can reuse it.
CREATE TABLE IF NOT EXISTS public.school_research (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name   TEXT        NOT NULL,
  program       TEXT        NOT NULL,
  data          JSONB       NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, school_name, program)
);

ALTER TABLE public.school_research
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS school_name TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT,
  ADD COLUMN IF NOT EXISTS data JSONB,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.school_research
SET
  school_name = COALESCE(school_name, 'Unknown school'),
  program = COALESCE(program, 'Unknown program'),
  data = COALESCE(data, '{}'::jsonb),
  generated_at = COALESCE(generated_at, now()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.school_research
  ALTER COLUMN school_name SET NOT NULL,
  ALTER COLUMN program SET NOT NULL,
  ALTER COLUMN data SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_research_user_school_program_key'
      AND conrelid = 'public.school_research'::regclass
  ) THEN
    ALTER TABLE public.school_research
      ADD CONSTRAINT school_research_user_school_program_key
      UNIQUE (user_id, school_name, program);
  END IF;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.school_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own school research" ON public.school_research;
CREATE POLICY "Users manage their own school research"
  ON public.school_research
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- School program cache
-- Stores official-source majors, honors programs, certificates, and tracks by school.
CREATE TABLE IF NOT EXISTS public.school_programs (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name   TEXT        NOT NULL,
  program_name  TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'Major',
  department    TEXT,
  source_url    TEXT        NOT NULL,
  source_title  TEXT,
  confidence    TEXT        NOT NULL DEFAULT 'Medium',
  data          JSONB       DEFAULT '{}'::jsonb,
  fetched_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, school_name, program_name, source_url)
);

ALTER TABLE public.school_programs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS school_name TEXT,
  ADD COLUMN IF NOT EXISTS program_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Major',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_title TEXT,
  ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.school_programs
SET
  school_name = COALESCE(school_name, 'Unknown school'),
  program_name = COALESCE(program_name, 'Unknown program'),
  category = COALESCE(category, 'Major'),
  source_url = COALESCE(source_url, ''),
  confidence = COALESCE(confidence, 'Medium'),
  data = COALESCE(data, '{}'::jsonb),
  fetched_at = COALESCE(fetched_at, now()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.school_programs
  ALTER COLUMN school_name SET NOT NULL,
  ALTER COLUMN program_name SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN source_url SET NOT NULL,
  ALTER COLUMN confidence SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_programs_user_school_program_source_key'
      AND conrelid = 'public.school_programs'::regclass
  ) THEN
    ALTER TABLE public.school_programs
      ADD CONSTRAINT school_programs_user_school_program_source_key
      UNIQUE (user_id, school_name, program_name, source_url);
  END IF;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.school_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own school programs" ON public.school_programs;
CREATE POLICY "Users manage their own school programs"
  ON public.school_programs
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_updated_at ON public.students;
CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS school_research_updated_at ON public.school_research;
CREATE TRIGGER school_research_updated_at
  BEFORE UPDATE ON public.school_research
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS school_programs_updated_at ON public.school_programs;
CREATE TRIGGER school_programs_updated_at
  BEFORE UPDATE ON public.school_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
