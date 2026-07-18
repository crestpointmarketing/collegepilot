/**
 * Phase 0 — evidence data layer.
 *
 * Admission-policy facts per school, each carrying provenance metadata.
 * Principles:
 *  - Unknown data is OMITTED or marked isEstimated — never fabricated.
 *  - Judgment (ED strategic value) is labeled expert_estimate, never fact.
 *  - Policies change yearly; every fact is stamped with its admissionCycle
 *    and low/medium-confidence entries carry a verify-before-use note.
 *
 * Base stats (admit rate, SAT/GPA medians) still live in lib/schools.ts;
 * their provenance is recorded once in LEGACY_STATS_PROVENANCE below.
 */

import type {
  ConfidenceLevel,
  EarlyRoundType,
  EdStrategicValue,
  EvidenceMeta,
  Fact,
  MajorAdmissionFact,
  SourceType,
  TestPolicy,
} from './definitions';

const RETRIEVED_AT = '2026-07-17';
const CYCLE = '2025-26';
const VERIFY_NOTE = 'Verify against the official admissions page before relying on this for the current cycle.';

function fact<T>(value: T, overrides: Partial<EvidenceMeta> = {}): Fact<T> {
  const confidence = overrides.confidence ?? 'medium';
  return {
    value,
    meta: {
      sourceType: overrides.sourceType ?? 'third_party',
      admissionCycle: overrides.admissionCycle ?? CYCLE,
      retrievedAt: RETRIEVED_AT,
      confidence,
      isEstimated: overrides.isEstimated ?? false,
      appliesTo: overrides.appliesTo ?? 'institution',
      ...(overrides.sourceUrl ? { sourceUrl: overrides.sourceUrl } : {}),
      note: overrides.note ?? (confidence !== 'high' ? VERIFY_NOTE : undefined),
      ...(overrides.supersededBy ? { supersededBy: overrides.supersededBy } : {}),
    },
  };
}

/** ED-round pool rate: press/community-reported, always estimated, always biased by hooks. */
function edRate(value: number): Fact<number> {
  return fact(value, {
    sourceType: 'third_party',
    isEstimated: true,
    confidence: 'low',
    note: 'Press/community-reported ED-pool rate; the pool concentrates athletes, legacy and development cases, so unhooked odds run below this. Verify against current-cycle reporting.',
  });
}

/** Judgment-typed fact: ED leverage grades are counselor judgment, not published data. */
function edJudgment(value: EdStrategicValue, note: string): Fact<EdStrategicValue> {
  return fact(value, {
    sourceType: 'expert_estimate',
    isEstimated: true,
    note: `${note} Published ED/RD rate gaps carry selection bias (athletes, legacy, development cases concentrate in ED pools) — treat as leverage grade, not a probability multiplier.`,
  });
}

export interface SchoolAdmissionFacts {
  schoolId: string;
  testPolicy?: Fact<TestPolicy>;
  earlyRounds?: Fact<EarlyRoundType>;
  edStrategicValue?: Fact<EdStrategicValue>;
  /**
   * Published/press-reported ED-round admit rate, percent. POOL rate only:
   * ED pools concentrate athletes, legacy and development cases, so an
   * unhooked applicant's odds run below this number — quote it as context,
   * never as the applicant's probability.
   */
  edAdmitRatePct?: Fact<number>;
  /** CS/engineering major group — the only major group modeled in Phase 1. */
  csMajor?: Fact<MajorAdmissionFact>;
  /** Need-blind admission for international applicants. */
  intlNeedBlind?: Fact<boolean>;
  /** Whether institutional need-based aid exists for internationals at all. */
  intlAidAvailable?: Fact<boolean>;
  /** Public universities: how much residency shifts odds. */
  inStateAdvantage?: Fact<'strong' | 'moderate' | 'none'>;
}

/** Provenance for the base stats that remain in lib/schools.ts. */
export const LEGACY_STATS_PROVENANCE: EvidenceMeta = {
  sourceType: 'cds_official',
  admissionCycle: '2024-25',
  retrievedAt: RETRIEVED_AT,
  confidence: 'medium',
  isEstimated: false,
  appliesTo: 'institution',
  note: 'Overall admit rate + median SAT/GPA from Common Data Set aggregations; csAccept figures are third-party/community estimates (confidence: low) except where a program publishes them.',
};

// Shorthand confidences
const HI: ConfidenceLevel = 'high';
const LO: ConfidenceLevel = 'low';
const EST = { isEstimated: true, confidence: LO as ConfidenceLevel };
const OFFICIAL: SourceType = 'official_program';

export const SCHOOL_FACTS: Record<string, SchoolAdmissionFacts> = {
  /* ── Ivy League ─────────────────────────────────────────── */
  harvard: {
    schoolId: 'harvard',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Reinstated SAT/ACT requirement starting with fall-2025 entry.' }),
    earlyRounds: fact<EarlyRoundType>('REA', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'REA signals interest but the early pool is heavily hooked; net statistical gain for unhooked applicants is modest.'),
    intlNeedBlind: fact(true, { confidence: HI }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },
  princeton: {
    schoolId: 'princeton',
    testPolicy: fact<TestPolicy>('optional', { ...EST, note: `Test-optional as of last verified cycle; several peers have reinstated requirements. ${VERIFY_NOTE}` }),
    earlyRounds: fact<EarlyRoundType>('REA', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'REA carries signal value; early pool is hook-heavy.'),
    intlNeedBlind: fact(true, { confidence: HI }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },
  yale: {
    schoolId: 'yale',
    testPolicy: fact<TestPolicy>('flexible', { confidence: HI, note: 'Test-flexible: scores required but AP/IB accepted in place of SAT/ACT.' }),
    earlyRounds: fact<EarlyRoundType>('REA', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'REA signal value; hook-heavy early pool.'),
    intlNeedBlind: fact(true, { confidence: HI }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },
  columbia: {
    schoolId: 'columbia',
    testPolicy: fact<TestPolicy>('optional', { confidence: HI, note: 'Announced permanently test-optional (2023).' }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED fills a large share of the class; binding commitment is the main real leverage an unhooked applicant controls.'),
    edAdmitRatePct: edRate(11),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  upenn: {
    schoolId: 'upenn',
    testPolicy: fact<TestPolicy>('required', { note: 'Announced reinstating test requirement; confirm effective entry year.' }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED historically fills ~50% of the class.'),
    edAdmitRatePct: edRate(15),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  cornell: {
    schoolId: 'cornell',
    testPolicy: fact<TestPolicy>('required', { note: 'Announced test requirement returning for fall-2026 entry; confirm current cycle.' }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED admit rate meaningfully above RD even net of hooks; admits by college.'),
    edAdmitRatePct: edRate(17),
    csMajor: fact<MajorAdmissionFact>(
      { admitRatePct: 8, competitiveness: 'high', directAdmit: true, internalTransfer: 'hard' },
      { appliesTo: 'college', isEstimated: true, note: 'Admits by college (CoE/CAS); CS-specific rate is a community estimate.' },
    ),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  brown: {
    schoolId: 'brown',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Reinstated SAT/ACT requirement starting with fall-2025 entry.' }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED fills a large share of the class.'),
    edAdmitRatePct: edRate(14),
    intlNeedBlind: fact(true, { note: 'Announced need-blind for international applicants beginning with the class of 2029.' }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },
  dartmouth: {
    schoolId: 'dartmouth',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'First to reinstate (Feb 2024), effective fall-2025 entry.' }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED fills a large share of the class.'),
    edAdmitRatePct: edRate(17),
    intlNeedBlind: fact(true, { note: 'Need-blind for internationals since the 2022-23 cycle.' }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },

  /* ── STEM elites ────────────────────────────────────────── */
  mit: {
    schoolId: 'mit',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Reinstated in 2022 — earliest reinstatement.' }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Unrestricted EA; MIT states no admit-rate advantage — value is planning, not odds.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'standard', directAdmit: false, internalTransfer: 'open' },
      { confidence: HI, note: 'No admission by major — any admit can declare Course 6. The constraint is getting in at all.' },
    ),
    intlNeedBlind: fact(true, { confidence: HI }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },
  stanford: {
    schoolId: 'stanford',
    testPolicy: fact<TestPolicy>('required', { note: 'Announced requirement returning for fall-2026 entry; confirm current cycle.' }),
    earlyRounds: fact<EarlyRoundType>('REA', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'REA signal value; hook-heavy pool.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'standard', directAdmit: false, internalTransfer: 'open' },
      { confidence: HI, note: 'No major-based admission; CS declaration is open after enrollment.' },
    ),
    intlNeedBlind: fact(false, { note: 'Need-aware for internationals despite generous aid once admitted.' }),
    intlAidAvailable: fact(true, { confidence: HI }),
  },
  caltech: {
    schoolId: 'caltech',
    testPolicy: fact<TestPolicy>('required', { note: 'Reinstated after a test-blind period; confirm current cycle.' }),
    earlyRounds: fact<EarlyRoundType>('REA', { ...EST, note: `Early program type has changed in recent cycles. ${VERIFY_NOTE}` }),
    edStrategicValue: edJudgment('limited', 'Early round at Caltech carries little statistical advantage.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'standard', directAdmit: false, internalTransfer: 'open' },
      { confidence: HI, note: 'No admission by major.' },
    ),
    intlNeedBlind: fact(false, { ...EST }),
    intlAidAvailable: fact(true),
  },
  cmu: {
    schoolId: 'cmu',
    testPolicy: fact<TestPolicy>('required', { note: 'Announced reinstating test requirement; confirm effective entry year.' }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED helps at CMU overall, but SCS explicitly gives ED little edge — leverage depends on which college.'),
    csMajor: fact<MajorAdmissionFact>(
      { admitRatePct: 7, competitiveness: 'extreme', directAdmit: true, internalTransfer: 'very_hard' },
      { sourceType: OFFICIAL, appliesTo: 'program', note: 'SCS admits directly to the school; internal transfer into SCS is rare and GPA-gated.' },
    ),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { note: 'CMU offers essentially no need-based aid to international undergraduates.' }),
  },
  harvey_mudd: {
    schoolId: 'harvey_mudd',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED1/ED2 available; class is small so binding interest matters.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true, { ...EST, note: 'Limited international aid; verify.' }),
  },

  /* ── Top privates ───────────────────────────────────────── */
  uchicago: {
    schoolId: 'uchicago',
    testPolicy: fact<TestPolicy>('optional', { confidence: HI, note: 'Long-standing "No Harm" test-optional policy.' }),
    earlyRounds: fact<EarlyRoundType>('EA_ED', { confidence: HI, note: 'Offers EA, ED1 and ED2.' }),
    edStrategicValue: edJudgment('high_leverage', 'UChicago leans heavily on binding rounds for yield; ED1/ED2 is a real lever for demonstrated-interest-driven admission.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'standard', directAdmit: false, internalTransfer: 'open' },
      { note: 'No admission by major.' },
    ),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  northwestern: {
    schoolId: 'northwestern',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED fills roughly half the class.'),
    edAdmitRatePct: edRate(20),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  duke: {
    schoolId: 'duke',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED admit rate runs several times RD; even discounting hooks the binding round matters.'),
    edAdmitRatePct: edRate(13),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  jhopkins: {
    schoolId: 'jhopkins',
    testPolicy: fact<TestPolicy>('required', { note: 'Announced test requirement returning for fall-2026 entry; confirm current cycle.' }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED1/ED2 fill a large share of the class.'),
    edAdmitRatePct: edRate(15),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  vanderbilt: {
    schoolId: 'vanderbilt',
    testPolicy: fact<TestPolicy>('optional', { note: 'Extended test-optional multiple cycles; confirm current cycle.' }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED1/ED2 admit rates far exceed RD.'),
    edAdmitRatePct: edRate(15),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  rice: {
    schoolId: 'rice',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED meaningful but Rice RD remains comparatively holistic.'),
    edAdmitRatePct: edRate(13),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  notredame: {
    schoolId: 'notredame',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('REA', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'REA non-binding but restrictive; signal value.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  washu: {
    schoolId: 'washu',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED1/ED2 fill a large share of the class.'),
    edAdmitRatePct: edRate(27),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  emory: {
    schoolId: 'emory',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED1/ED2 admit rates far exceed RD.'),
    edAdmitRatePct: edRate(30),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  georgetown: {
    schoolId: 'georgetown',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Georgetown never fully dropped testing.' }),
    earlyRounds: fact<EarlyRoundType>('REA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Georgetown EA defers rather than denies and offers no statistical edge.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true, { ...EST }),
  },
  tufts: {
    schoolId: 'tufts',
    testPolicy: fact<TestPolicy>('optional', { note: 'Multi-cycle test-optional; confirm current cycle.' }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'Yield-protective school; binding interest counts. Watch for "Tufts syndrome" in RD.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true),
  },
  usc: {
    schoolId: 'usc',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA', { note: 'EA added recently; no ED. Merit-scholarship consideration tied to early deadline.' }),
    edStrategicValue: edJudgment('limited', 'No binding round; EA mainly matters for scholarship timelines.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'hard' },
      { ...EST, appliesTo: 'college', note: 'Viterbi admits by major; CS is among the most competitive.' },
    ),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { ...EST, note: 'Very limited need aid for internationals; merit possible.' }),
  },
  wake_forest: {
    schoolId: 'wake_forest',
    testPolicy: fact<TestPolicy>('optional', { confidence: HI, note: 'Test-optional pioneer (since 2008).' }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED demonstrates interest at a yield-conscious school.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { ...EST }),
  },
  northeastern: {
    schoolId: 'northeastern',
    testPolicy: fact<TestPolicy>('optional', { confidence: HI }),
    earlyRounds: fact<EarlyRoundType>('EA_ED', { confidence: HI, note: 'Offers EA, ED1, ED2.' }),
    edStrategicValue: edJudgment('high_leverage', 'Extremely yield-driven admissions; binding ED materially changes the read.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'moderate' },
      { ...EST, appliesTo: 'college', note: 'Khoury admits by college; CS pool is competitive.' },
    ),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { ...EST }),
  },
  nyu: {
    schoolId: 'nyu',
    testPolicy: fact<TestPolicy>('flexible', { confidence: HI, note: 'Long-standing test-flexible policy (accepts AP/IB/others).' }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED admit rate runs well above RD at a yield-obsessed school.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'moderate', directAdmit: true, internalTransfer: 'moderate' },
      { ...EST, appliesTo: 'college', note: 'CAS/Courant vs Tandon differ; CS competitive but not UIUC/CMU-tier gated.' },
    ),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { note: 'NYU aid for internationals is minimal relative to cost.' }),
  },
  bc: {
    schoolId: 'bc',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED1/ED2 meaningful at a yield-aware school.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { ...EST }),
  },
  bu: {
    schoolId: 'bu',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED1_ED2', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'ED admit rate roughly double RD; heavy yield management.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { ...EST }),
  },
  tulane: {
    schoolId: 'tulane',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA_ED', { confidence: HI }),
    edStrategicValue: edJudgment('high_leverage', 'Famously interest-driven: RD admit rate collapses vs EA/ED. Applying RD-only is a structural mistake here.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(false, { ...EST }),
  },
  cwru: {
    schoolId: 'cwru',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA_ED', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED/EA both available; interest tracking matters.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true, { ...EST, note: 'Merit aid available to internationals; need aid limited.' }),
  },
  rochester: {
    schoolId: 'rochester',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('ED', { confidence: HI }),
    edStrategicValue: edJudgment('moderate', 'ED signals interest; school is aid-generous for strong profiles.'),
    intlNeedBlind: fact(false),
    intlAidAvailable: fact(true, { ...EST }),
  },

  /* ── UC system (test-blind, no early rounds, need-aware+no-aid intl) ── */
  berkeley: {
    schoolId: 'berkeley',
    testPolicy: fact<TestPolicy>('blind', { confidence: HI, note: 'UC system is permanently test-free.' }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI, note: 'Single Nov 30 deadline; no ED/EA.' }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'extreme', directAdmit: true, internalTransfer: 'very_hard' },
      { note: 'EECS and (since fall 2023) L&S CS are direct-admission, among the most competitive majors in the country.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI, note: 'No need-based aid for international/OOS students in the UC system.' }),
    inStateAdvantage: fact('moderate', { note: 'CA residents are the mandated majority of the class.' }),
  },
  ucla: {
    schoolId: 'ucla',
    testPolicy: fact<TestPolicy>('blind', { confidence: HI }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { admitRatePct: 4, competitiveness: 'extreme', directAdmit: true, internalTransfer: 'very_hard' },
      { appliesTo: 'major', isEstimated: true, note: 'CS sits in Samueli engineering; admit rate is a community estimate.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate'),
  },
  ucsd: {
    schoolId: 'ucsd',
    testPolicy: fact<TestPolicy>('blind', { confidence: HI }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'very_hard' },
      { note: 'CSE is a capped major; entering it after enrollment is lottery/GPA-gated.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate'),
  },
  ucsb: {
    schoolId: 'ucsb',
    testPolicy: fact<TestPolicy>('blind', { confidence: HI }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'hard' },
      { ...EST, note: 'CS in College of Engineering is capped.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate'),
  },
  uci: {
    schoolId: 'uci',
    testPolicy: fact<TestPolicy>('blind', { confidence: HI }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'hard' },
      { ...EST, note: 'CS admit rate runs well below the campus average.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate'),
  },
  ucdavis: {
    schoolId: 'ucdavis',
    testPolicy: fact<TestPolicy>('blind', { confidence: HI }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'moderate', directAdmit: true, internalTransfer: 'moderate' },
      { ...EST },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate'),
  },

  /* ── Top publics ────────────────────────────────────────── */
  umich: {
    schoolId: 'umich',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Unrestricted EA; main value is avoiding the late-pool deferral churn.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'hard' },
      { note: 'Since the 2024 enrollment-pathway change, first-year applicants effectively apply to CS; discovering CS after enrolling is now gated.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate', { note: 'OOS admit rate runs meaningfully below in-state.' }),
  },
  uva: {
    schoolId: 'uva',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA_ED', { confidence: HI, note: 'Offers both EA and binding ED.' }),
    edStrategicValue: edJudgment('moderate', 'ED reinstated recently; real but modest leverage for unhooked applicants.'),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('strong', { confidence: HI, note: 'Roughly two-thirds of seats are reserved for Virginians; OOS pool is far more selective.' }),
  },
  unc: {
    schoolId: 'unc',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Non-binding EA only.'),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('strong', { sourceType: 'state_data', confidence: HI, note: 'State-mandated ~82% in-state cap; OOS admit rate is single-digit-to-low-teens.' }),
  },
  georgia_tech: {
    schoolId: 'georgia_tech',
    testPolicy: fact<TestPolicy>('required', { note: 'USG reinstated test requirements at research universities; confirm effective entry year.' }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI, note: 'EA1 (in-state) and EA2 (all); no ED.' }),
    edStrategicValue: edJudgment('limited', 'Non-binding EA only.'),
    csMajor: fact<MajorAdmissionFact>(
      { admitRatePct: 10, competitiveness: 'high', directAdmit: true, internalTransfer: 'moderate' },
      { isEstimated: true, note: 'CS admit rate community-estimated; major declared on application.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('strong', { note: 'In-state admit rate runs roughly 3× OOS/international.' }),
  },
  uiuc: {
    schoolId: 'uiuc',
    testPolicy: fact<TestPolicy>('optional', { ...EST }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Non-binding EA only.'),
    csMajor: fact<MajorAdmissionFact>(
      { admitRatePct: 6, competitiveness: 'extreme', directAdmit: true, internalTransfer: 'very_hard' },
      { appliesTo: 'major', note: 'Grainger CS is direct-admit with a single-digit rate while the campus admits ~45% — the single biggest school-vs-major gap in this dataset. CS+X majors are a materially easier side door.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate', { ...EST }),
  },
  uw: {
    schoolId: 'uw',
    testPolicy: fact<TestPolicy>('blind', { note: 'UW announced permanently not considering SAT/ACT; verify current wording.' }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI, note: 'Single Nov 15 deadline.' }),
    edStrategicValue: edJudgment('not_offered', 'No early rounds exist.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'extreme', directAdmit: true, internalTransfer: 'very_hard' },
      { note: 'Allen School is direct-to-major since 2019; admission as a non-CS admit and transferring in later is close to impossible. Rate for OOS/intl CS is community-estimated single digits.', isEstimated: true },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('strong', { note: 'Direct-to-major CS seats skew heavily toward WA residents.' }),
  },
  purdue: {
    schoolId: 'purdue',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Reinstated test requirement (fall-2024 entry).' }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Non-binding EA; CS applicants should treat EA as the de facto deadline (major capacity fills).'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'high', directAdmit: true, internalTransfer: 'hard' },
      { note: 'Direct-to-major; CS admit rate runs far below the campus average and EA is effectively required for CS.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('none', { ...EST, note: 'Purdue is comparatively OOS/international-friendly for a public.' }),
  },
  wisc: {
    schoolId: 'wisc',
    testPolicy: fact<TestPolicy>('optional', { note: 'Announced test-optional through at least 2027; confirm.' }),
    earlyRounds: fact<EarlyRoundType>('EA', { confidence: HI }),
    edStrategicValue: edJudgment('limited', 'Non-binding EA only.'),
    csMajor: fact<MajorAdmissionFact>(
      { competitiveness: 'moderate', directAdmit: false, internalTransfer: 'moderate' },
      { ...EST, note: 'L&S CS declaration is GPA-gated but not lottery-style capped.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('moderate', { ...EST }),
  },
  ufl: {
    schoolId: 'ufl',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Florida public system never dropped the test requirement.' }),
    earlyRounds: fact<EarlyRoundType>('none', { ...EST, note: 'Priority deadline structure rather than EA/ED; verify current plans.' }),
    edStrategicValue: edJudgment('not_offered', 'No binding early round.'),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('strong', { note: 'Heavily in-state by mandate and by aid structure (Bright Futures).' }),
  },
  utaustin: {
    schoolId: 'utaustin',
    testPolicy: fact<TestPolicy>('required', { confidence: HI, note: 'Reinstated test requirement (fall-2025 entry).' }),
    earlyRounds: fact<EarlyRoundType>('none', { confidence: HI, note: 'Priority deadline (Nov 1) rather than EA/ED.' }),
    edStrategicValue: edJudgment('not_offered', 'No binding early round.'),
    csMajor: fact<MajorAdmissionFact>(
      { admitRatePct: 6, competitiveness: 'extreme', directAdmit: true, internalTransfer: 'very_hard' },
      { appliesTo: 'major', note: 'CS admits by major; internal transfer into CS is effectively closed. Turing program is more selective still.' },
    ),
    intlNeedBlind: fact(false, { confidence: HI }),
    intlAidAvailable: fact(false, { confidence: HI }),
    inStateAdvantage: fact('strong', { sourceType: 'state_data', confidence: HI, note: 'Top-6% auto-admit consumes ~75%+ of seats; OOS/international pool is far more selective (single-digit effective rates for CS).' }),
  },
};

export function getSchoolFacts(schoolId: string): SchoolAdmissionFacts | undefined {
  return SCHOOL_FACTS[schoolId];
}
