# CollegePilot — Architecture, Framework & Implementation

> Reference document for the CollegePilot platform: what it is, how it's built,
> how each part works, and where the current refactor (Blueprint Journey) stands.
> Status labels are honest: **[done]** shipped, **[partial]** in progress,
> **[planned]** not yet built.

---

## 1. What it is

CollegePilot is a US college-admissions **strategy** platform. It is not an essay
generator — it turns a student's objective record into an evidence-based,
auditable strategy and, ultimately, a **Blueprint™**: a versioned personal
strategy book.

**North-star product flow — "Blueprint Journey"** (see `MEMORY` /
`blueprint-journey-methodology`):

```
Evidence → Identity → Direction → Program → Portfolio → Blueprint
```

Core principles that constrain every feature:

- **Person before school.** No school recommendation before a validated direction.
- **The unit of choice is an Application Pathway** (University → College → Program → Round), not a school name.
- **No false precision.** Admissions likelihood is expressed as *tiers and wide bands*, never fabricated 0–100 scores or unpublished admit rates.
- **Honesty labels everywhere.** Objective facts carry an evidence status; AI interpretation is separated from stated fact; the identity is a hypothesis the *student* validates, not an AI decree.
- **Numeric authority lives in deterministic code**, not the LLM.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.10** (App Router) — note `AGENTS.md`: this version has breaking changes vs. older Next; consult `node_modules/next/dist/docs/` |
| UI runtime | **React 19.2.4** (React Compiler lint rules in force) |
| Language | **TypeScript 5** (strict) |
| Styling | **Tailwind CSS v4** + CSS-variable design tokens (`app/globals.css`) |
| Auth + DB | **Supabase** (Postgres + Row Level Security), `@supabase/ssr` 0.10 / `@supabase/supabase-js` 2.104 |
| LLM | **Anthropic SDK 0.91** (`claude-sonnet-5` for generation), beta structured outputs |
| Validation | **zod 4** |
| Web data | Firecrawl + Perplexity (deep research), Exa (`lib/exa.ts`) |
| Icons | lucide-react | Markdown | react-markdown + remark-gfm |
| Tests | **Vitest 3** |
| Hosting | **Vercel** (GitHub-integrated, production branch = `main`) |

---

## 3. Repository structure

```
app/
  (auth)/               login / reset-password
  (app)/                authenticated shell (sidebar + <main>)
    dashboard/          student roster
    students/[studentId]/
      overview/ profile/ assessment/ strategy/ blueprint/
      timeline/ schools/ schools/[schoolId]/ research/
      documents/ downloads/
  api/                  ao-perspective chat blueprint positioning
                        programs research strategy   (route handlers)
components/
  ui/                   shared primitives (design system) — PageHeader, Card, Chip…
  assessment/ blueprint/ intelligence/ profile/ shared/ layout/ chat/
context/AppContext.tsx  single client-side data store
lib/
  admissions/           the admissions engine (see §7)
  ai.ts prompts.ts blueprintPrompt.ts rateLimit.ts schemas.ts
  data.ts schools.ts    sample students + 50-school fact base
  supabase.ts supabase.server.ts
types/index.ts          canonical data model
supabase/*.sql          table definitions + RLS
docs/                   this document
proxy.ts                auth middleware
```

---

## 4. Routing, pages & auth gate

The app is a single sidebar shell (`components/layout/Sidebar.tsx` +
`NavLinks.tsx`); there is no per-student tab bar. `proxy.ts` (Next middleware)
gates everything: unauthenticated requests to any non-public path
(`/`, `/reset-password`, `/auth/*`) redirect to `/`.

Per-student pages (route folder name === nav id):

| Page | Role today | Journey stage |
|---|---|---|
| `overview` | Summary hub (assessment + portfolio + alerts + priorities) | cross-cutting |
| `profile` | Objective record entry; per-item **evidence confirmation** [done] | Stage 0 |
| `assessment` | 10-dimension AI read + readiness % | Stage 0→1 |
| `blueprint` | **Identity hypotheses → student validation → Seed → full Blueprint** [partial] | Stage 1 + 6 |
| `strategy` | Portfolio generator: tiers/bands, ED/EA, execution plan | Stage 4–5 (currently mis-sequenced *before* schools) |
| `schools` / `schools/[schoolId]` | School list + per-school intelligence | Stage 3 |
| `research` | Per-school Match/Strategy + deep web research | Stage 3 (to fold into schools) |
| `timeline` `documents` `downloads` | Execution / asset generation / export | Stage 6 downstream |

---

## 5. Data model (`types/index.ts`)

- **`Student`** — required core (name, grade, gpa/sat/act, major, strengths, risk tolerance…) + extensive optional academic/context fields, `activities[]`, `awards[]`, `courses[]`, `projects[]`, preferences (`preferredSchoolIds`, `notAttendIds`, `edChoiceId`…). Journey additions: **`evidenceStatus?: Record<string, EvidenceStatus>`** [done], **`positioning?: PositioningState`** [done].
- **`Strategy`** — UI-facing generated strategy: `positioning`, `competitiveness`, `schools{reach,match,safety}`, `strategy{ed_ea,narrative}`, `plan[]`, `meta`, and the audit payload **`v2: StrategyV2`** (assessment + engine evaluations + portfolio + levers).
- **`School`** — 50-school fact base (`lib/schools.ts`): admit rate, `csAccept`, medians, ranking, majors, highlights, deadlines, etc.
- **`Blueprint`** (`lib/admissions/blueprint.ts`) — six-volume book + `ClaimStatus` honesty labels + auto-collected claim register.
- **Journey models** (`lib/admissions/journey.ts`): `EvidenceStatus` (provided/confirmed/planned), `PositioningHypothesis` + validation + `ConfirmedDirection`, `ApplicationPathway` (Univ→College→Program→Round + Application Unit + Fit/Leverage tiers).

---

## 6. State & persistence

- **Client store — `context/AppContext.tsx`.** One provider loads all data at
  auth time and exposes `students`, `schools`, `strategies`, `blueprints`,
  `tweaks`, plus actions `saveStudent` / `saveStudentDraft` / `saveStrategy` /
  `saveBlueprint` / `markDocumentReady` / `seedSampleStudents` / `deleteStudent` /
  `signOut`. Pages read the current student via `useParams` + `students.find`.
- **Supabase tables** (all per-user RLS: `auth.uid() = user_id`):
  `students`, `strategies`, `blueprints`, `school_research`, `school_programs`,
  `schools`. `strategies`/`blueprints` are keyed `(student_id, user_id)` with
  ownership-preserving FK cascades. Blueprint loading is **best-effort** — a
  missing `blueprints` table never blanks the workspace.
- **Two Supabase clients**: `lib/supabase.ts` (`createClient`, browser) and
  `lib/supabase.server.ts` (`createServerSupabaseClient`, cookie-based, used by
  route handlers).

---

## 7. The admissions engine — core IP (`lib/admissions/`)

A five-layer, auditable pipeline. **The LLM only grades qualitatively; all
numbers come from deterministic code.**

1. **Definitions (`definitions.ts`)** — the uncertainty vocabulary:
   likelihood tiers `unlikely / reach / possible / likely / very_likely` with
   wide bands (`TIER_META`); `ConfidenceLevel`; `selectivityCeiling()` (sub-8%
   schools capped at Reach); source-provenance priority; policy vocab
   (test policy, early-round type, ED strategic value, major competitiveness).
2. **Facts (`schoolFacts.ts` + `schools.ts`)** — 50 schools with admit rates,
   program-specific `csAccept`, medians, and provenance.
3. **Assessment (`assessment.ts`)** — the LLM's only job: grade **10 dimensions**
   (`academic_readiness`, `curriculum_rigor_in_context`, `major_preparation`,
   `intellectual_vitality`, `extracurricular_distinction`, `leadership_impact`,
   `narrative_coherence`, `institutional_fit`, `application_readiness`,
   `financial_residency_context`) each with tier (`exceptional…concern`),
   evidence, gaps, verifiability, confidence, overstatement risk. No
   probabilities, no school names.
4. **Engine (`engine.ts`, `ENGINE_VERSION 2.2.0`, `DATA_CYCLE 2025-26`)** —
   deterministic calibration. Per school: base tier from admit rate, adjusted by
   SAT-vs-median, GPA gap, gated-major penalty, residency, international+aid,
   rigor, distinction/spike (verification-weighted), ED commitment; hard
   selectivity ceilings; **single-count principle** (each evidence piece moves a
   tier once) with a full `trace`. Bands **widen when data/assessment confidence
   is low** (uncertainty made visible). Portfolio math: `P(≥1 admit)` band,
   coverage, shutout risk, warnings, competitiveness levels.
5. **Match (`schoolMatch.ts`)** — per-school, no new data: `FitLevel`
   (Excellent/Strong/Moderate/Limited/**Unknown**) across six axes; Unknown never
   drags the overall down. Also `computeApplicationStrategy` (round, essay
   angles, material gaps). `schoolStructure.ts` gives hand-verified
   College→Program trees + qualitative program reputation (never fake rank #s).

---

## 8. AI generation layer

**Pattern (`callStructured`)** — forced tool call + zod `safeParse` + one retry
that feeds validation errors back to the model. Two modes:

- **strict** (`betas: ['structured-outputs-2025-11-13']`, `tool.strict = true`):
  constrained decoding guarantees schema conformance. **Caveat: the compiled
  grammar has a size limit** — large schemas 400 with "compiled grammar is too
  large" (cannot be detected locally; only the live API rejects it). Fixes:
  split into smaller strict calls, flatten via array+key-enum, or ↓.
- **non-strict**: normal forced tool call, no grammar compiled → no size limit;
  relies on zod + retry. Used for the large Blueprint spine and positioning
  schemas. (See `MEMORY/strict-structured-outputs`.)

All object nodes are closed with `closeObjects()` for strict mode. Every LLM
route: Supabase auth + ownership check, per-user rate limit (`lib/rateLimit.ts`),
`ANTHROPIC_API_KEY` guard, and a **whitespace-heartbeat stream** (survives
gateway TTFB timeouts) that ends with a single JSON blob; results are persisted
**server-side** so they survive client disconnect.

| Route | Calls | Output |
|---|---|---|
| `/api/strategy` | assessment (strict) + narrative (strict) + deterministic engine | full `Strategy` (+`v2`) → `strategies` table |
| `/api/blueprint` | reuses stored assessment + spine (**non-strict**) | identity spine (Vol I/III/IV); anchored to confirmed positioning when present → `blueprints` table [partial] |
| `/api/positioning` | reuses assessment + hypotheses (**non-strict**) | 3–5 `PositioningHypothesis` for student validation [done] |
| `/api/ao-perspective` | 1 plain call | AO first-read (labeled AI simulation) |
| `/api/research` | Firecrawl + Perplexity | per-school deep research → `school_research` |
| `/api/programs` | web data | program structure cache → `school_programs` |
| `/api/chat` | streaming | assistant chat |

---

## 9. Blueprint Journey — refactor status

Rebuilding the platform around the six-stage flow (see `docs`/artifacts). Each
stage ships independently; the engine/assessment/portfolio are reused.

| Stage | Page | Status |
|---|---|---|
| Foundation — journey data models | `lib/admissions/journey.ts` | **[done]** |
| 0 Objective Evidence — per-item confirmation | `profile` | **[done]** |
| 1 Identity — hypotheses → student validation → Seed | `blueprint` + `/api/positioning` | **[done]** |
| 2 Academic Direction (majors/program types, no schools) | *(new)* | **[planned]** |
| 3 Program & School Discovery — Application Pathways, fold in `research` | `schools` | **[planned]** |
| 4–5 Portfolio — longlist→shortlist→~15 pathways | `strategy` (re-sequence) | **[planned]** |
| 6 Full Blueprint — Vols II/V/VI + versioning + PDF export | `blueprint` | **[partial]** (spine done) |
| G Nav re-sequence + Overview as progress tracker | `NavLinks` / `overview` | **[planned]** |

**Blueprint versions**: Seed v0.1 (after Stage 1) → Strategy v0.5 (after 3–4) →
Application v1.0 (after 5) → v1.1+ updates.

---

## 10. Design system

- **Tokens (`app/globals.css`)** — CSS variables consumed through Tailwind v4:
  `--ink` / `--ink-soft` / `--muted` / `--muted-2`, `--accent` (+50/100/600),
  `--line` / `--line-strong`, `--bg` / `--bg-soft`, status pairs
  (`--green/amber/red/slate-50/600`), `--radius-card`, `--radius-pill`,
  `--shadow-card`, font `--font-sans` (Inter).
- **Shared primitives (`components/ui/`)** — the single source of truth,
  extracted 2026-07: **`PageHeader`**, **`Card`** (canonical section container:
  eyebrow + title + icon + actions + optional status tint), **`Chip`** with one
  semantic **`Tone`** vocabulary (`neutral/accent/positive/warning/critical/info`),
  **`StatTile`**, **`EmptyState`**, **`PrimaryButton`/`GhostButton`**.
- **Type scale**: h1 28/semibold · card title 15/semibold · eyebrow 10.5/bold/
  uppercase/tracking. Rhythm: cards `gap-4`, card padding `px-6 py-4`.
- **Unification status**: the primitives exist and `overview` is rebuilt on them
  as the reference page. **[planned]**: migrate the remaining older pages
  (`assessment`, `strategy`, `schools`, `research`, `timeline`, `documents`,
  `downloads`) to the primitives, deleting ~7 duplicate card wrappers and ~15
  ad-hoc chip definitions. Change a token/primitive once → whole platform updates.
- Theme: the app is light-themed; artifacts/exports are theme-aware separately.

---

## 11. Deployment

- **Vercel + GitHub integration.** Pushing to **`main`** (the production branch)
  auto-builds a Production deployment. Domains: `collegepilot.ethanli.ai`,
  `collegepilot.vercel.app`.
- **Required Production env vars**: `ANTHROPIC_API_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`.
- **DB migrations** are hand-run SQL in `supabase/` (e.g. `blueprints.sql` must be
  applied before the Blueprint feature can persist).
- Verification: the GitHub Deployments API + `gh` (environment/state) is the
  independent source of truth for whether a Production deploy actually succeeded.

---

## 12. Testing

Vitest suites (~78 tests): `engine.test.ts` (39), `schoolMatch.test.ts` (13),
`schoolStructure.test.ts` (6), `blueprint.test.ts` (3), `journey.test.ts` (7),
`data.test.ts`, `schemas.test.ts`, `userDisplay.test.ts`. Honesty invariants are
enforced by tests (e.g. reputation signals contain no fabricated program-rank
numbers; the claim register surfaces every non-confirmed claim; `isValidConvergence`
allows only one Primary identity). Standard gate: `npm run check`
(lint + typecheck + test) plus `npm run build`.

---

## 13. Known constraints & gotchas

- **Strict structured-output grammar-size limit** — large schemas must go
  non-strict; not detectable locally. (`MEMORY/strict-structured-outputs`.)
- **Never round-trip source files through PowerShell 5.1** — it double-encodes
  UTF-8 into mojibake and once left raw NUL bytes in `profile/page.tsx`. Use Node
  or the editor tools for byte-level fixes.
- **Wide bands are intentional.** The same tier band can appear on schools of
  different selectivity; this is "no false precision," not a bug. The remaining
  UX gap is surfacing each school's actual admit rate alongside the tier.
- **Design unification and the Journey re-sequencing are in progress** — treat
  page sequencing and any per-page card/chip code as transitional until the
  `components/ui` migration completes.

---

*Living document — update the status labels as the Blueprint Journey refactor and
the design-system migration progress.*
