-- Essay Guide tables (E1) — run once in the Supabase SQL editor.
--
-- Design notes:
--  * The seeded 20-school prompt LIBRARY lives in code (lib/essays/promptLibrary.ts,
--    versioned like schoolFacts). Custom prompts are stored inline on the project
--    row (custom_prompt JSONB). Only per-student STATE lives in these tables.
--  * essay_revisions and essay_reviews are append-only: RLS grants SELECT/INSERT
--    but no UPDATE — history can never be silently rewritten.

CREATE TABLE IF NOT EXISTS public.essay_projects (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     TEXT        NOT NULL,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id      TEXT        NOT NULL,
  program        TEXT,
  prompt_id      TEXT,                 -- id in the code prompt library (null for custom)
  custom_prompt  JSONB,                -- { promptText, wordLimit?, promptType?, note? }
  selected_angle_id UUID,
  workflow_status TEXT       NOT NULL DEFAULT 'not_started',
  due_date       DATE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (student_id, user_id) REFERENCES public.students (id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.essay_angles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES public.essay_projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,   -- EssayAngle: angle, evidence, hook, risks, questions, status
  disposition TEXT        NOT NULL DEFAULT 'proposed',  -- proposed | saved | rejected | selected
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.essay_revisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES public.essay_projects(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revision_number INT         NOT NULL,
  name            TEXT,
  content         TEXT        NOT NULL,
  word_count      INT         NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'student',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, revision_number)
);

CREATE TABLE IF NOT EXISTS public.essay_reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id   UUID        NOT NULL REFERENCES public.essay_revisions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data          JSONB       NOT NULL,  -- AO read, rubric, quoted annotations, claims, questions
  model_version TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.essay_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_angles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_reviews   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own essay_projects" ON public.essay_projects;
CREATE POLICY "own essay_projects" ON public.essay_projects
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own essay_angles" ON public.essay_angles;
CREATE POLICY "own essay_angles" ON public.essay_angles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Append-only history: SELECT + INSERT only.
DROP POLICY IF EXISTS "read own essay_revisions" ON public.essay_revisions;
CREATE POLICY "read own essay_revisions" ON public.essay_revisions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert own essay_revisions" ON public.essay_revisions;
CREATE POLICY "insert own essay_revisions" ON public.essay_revisions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own essay_reviews" ON public.essay_reviews;
CREATE POLICY "read own essay_reviews" ON public.essay_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert own essay_reviews" ON public.essay_reviews;
CREATE POLICY "insert own essay_reviews" ON public.essay_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
