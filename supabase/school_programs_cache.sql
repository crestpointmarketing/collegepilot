-- Run this once in Supabase SQL Editor to enable program dropdown caching.
-- The app can still fetch live programs without this table, but cached dropdowns need it.

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

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS school_programs_updated_at ON public.school_programs;
CREATE TRIGGER school_programs_updated_at
  BEFORE UPDATE ON public.school_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.school_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own school programs" ON public.school_programs;
CREATE POLICY "Users manage their own school programs"
  ON public.school_programs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
