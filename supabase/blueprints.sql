-- Blueprints table
-- Stores the full six-volume Blueprint JSON per student per user.
-- Mirrors public.strategies (ownership-preserving cascade + per-user RLS).
-- Run this once against the project database (Supabase SQL editor or CLI).

CREATE TABLE IF NOT EXISTS public.blueprints (
  student_id  TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (student_id, user_id)
);

-- Remove legacy orphan rows before enforcing ownership-preserving cascades.
DELETE FROM public.blueprints AS bp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.students AS student
  WHERE student.id = bp.student_id
    AND student.user_id = bp.user_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blueprints_student_owner_fkey'
      AND conrelid = 'public.blueprints'::regclass
  ) THEN
    ALTER TABLE public.blueprints
      ADD CONSTRAINT blueprints_student_owner_fkey
      FOREIGN KEY (student_id, user_id)
      REFERENCES public.students (id, user_id)
      ON DELETE CASCADE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own blueprints" ON public.blueprints;
CREATE POLICY "Users manage their own blueprints"
  ON public.blueprints
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
