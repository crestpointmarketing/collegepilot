import { describe, expect, it } from 'vitest';
import { SCHOOLS } from '../schools';
import type { Student } from '@/types';
import type { DimensionAssessment, ProfileAssessment } from './assessment';
import { DIMENSION_KEYS } from './assessment';
import { evaluateSchool, extractStudentNumbers, matchesRegionOrState, runEngine, summarizePortfolio } from './engine';
import { tierIndex } from './definitions';

/* ── Fixtures ─────────────────────────────────────────────── */

function dim(overrides: Partial<DimensionAssessment> = {}): DimensionAssessment {
  return {
    tier: 'solid',
    evidence: ['fixture evidence'],
    missing: [],
    risks: [],
    verifiability: 'link_verified',
    confidence: 'medium',
    reader_interpretation: 'Reads as solid on first pass.',
    overstatement_risk: 'low',
    ...overrides,
  };
}

function makeAssessment(dimOverrides: Partial<Record<(typeof DIMENSION_KEYS)[number], Partial<DimensionAssessment>>> = {}, confidence: 'high' | 'medium' | 'low' = 'medium'): ProfileAssessment {
  return {
    dimensions: Object.fromEntries(
      DIMENSION_KEYS.map(k => [k, dim(dimOverrides[k])]),
    ) as ProfileAssessment['dimensions'],
    spike: { has_spike: false, domain: '', summary: 'No clear spike.' },
    profile_read: 'Fixture read.',
    key_risks: ['risk one', 'risk two'],
    assessment_confidence: confidence,
    assessment_gaps: [],
  };
}

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'test', name: 'Test Student', grade: 11, school: 'Test High', city: 'Austin',
    major: 'Computer Science', secondary: '', gpa: '4.0', gpaType: 'Weighted',
    sat: '1550', act: '', apCount: 8, strengths: [], weak: [],
    citizenship: 'US Citizen', schoolType: 'Public', competitiveness: '',
    firstGen: 'No', targetRange: 'Top 20', risk: 'Balanced', preferred: '',
    traits: '', angles: '', color: '#000', status: 'Draft', updated: '',
    activities: [], awards: [],
    ...overrides,
  };
}

const byId = (id: string) => {
  const s = SCHOOLS.find(x => x.id === id);
  if (!s) throw new Error(`fixture school missing: ${id}`);
  return s;
};

function evaluate(student: Student, schoolId: string, assessment = makeAssessment()) {
  return evaluateSchool(student, extractStudentNumbers(student), assessment, byId(schoolId));
}

/* ── Selectivity ceiling ──────────────────────────────────── */

describe('selectivity ceiling', () => {
  it('never rates a sub-8% school above reach, even for a stellar verified profile', () => {
    const assessment = makeAssessment({
      curriculum_rigor_in_context: { tier: 'exceptional', confidence: 'high' },
      extracurricular_distinction: { tier: 'exceptional', verifiability: 'externally_verified', confidence: 'high' },
      academic_readiness: { tier: 'exceptional', confidence: 'high' },
    }, 'high');
    const ev = evaluate(makeStudent({ sat: '1600', gpa: '4.3' }), 'harvard', assessment);
    expect(tierIndex(ev.tier)).toBeLessThanOrEqual(tierIndex('reach'));
    expect(ev.trace.some(t => t.ruleId === 'selectivity_ceiling')).toBe(true);
  });
});

/* ── Major-gated schools ──────────────────────────────────── */

describe('gated majors', () => {
  it('uses the CS program rate, not the campus rate, for a CS applicant at UIUC', () => {
    const ev = evaluate(makeStudent(), 'uiuc');
    expect(ev.baseRateUsed.scope).toBe('major');
    expect(ev.baseRateUsed.pct).toBeLessThan(10); // 6% CS, not 45% campus
    expect(tierIndex(ev.tier)).toBeLessThanOrEqual(tierIndex('reach'));
  });

  it('does not apply CS gating to a non-CS applicant at UIUC', () => {
    const ev = evaluate(makeStudent({ major: 'History', secondary: '' }), 'uiuc');
    expect(ev.baseRateUsed.scope).toBe('institution');
    expect(tierIndex(ev.tier)).toBeGreaterThanOrEqual(tierIndex('possible'));
  });

  it('flags major_locked where internal transfer is effectively closed', () => {
    const ev = evaluate(makeStudent(), 'uw');
    expect(ev.flags).toContain('major_locked');
  });
});

/* ── Test policy ──────────────────────────────────────────── */

describe('test policy', () => {
  it('ignores SAT entirely at test-blind UCs', () => {
    const low = evaluate(makeStudent({ sat: '1300' }), 'berkeley');
    const high = evaluate(makeStudent({ sat: '1600' }), 'berkeley');
    expect(low.trace.find(t => t.ruleId === 'test_blind')).toBeTruthy();
    expect(low.tier).toBe(high.tier);
  });

  it('penalizes a missing score at a test-required school and flags it', () => {
    const ev = evaluate(makeStudent({ sat: '' }), 'mit');
    expect(ev.flags).toContain('test_required_no_score');
    expect(ev.trace.find(t => t.ruleId === 'test_missing_required')?.stepDelta).toBe(-1);
  });

  it('recommends withholding a far-below-median score at a test-optional school instead of penalizing', () => {
    const ev = evaluate(makeStudent({ sat: '1400', major: 'History' }), 'columbia');
    expect(ev.flags).toContain('withhold_score_recommended');
    expect(ev.trace.find(t => t.ruleId === 'sat_withhold')?.stepDelta).toBe(0);
  });
});

/* ── Residency ────────────────────────────────────────────── */

describe('residency', () => {
  it('penalizes out-of-state applicants at resident-favoring publics', () => {
    const ev = evaluate(makeStudent({ major: 'History', stateResidency: 'California' }), 'unc');
    expect(ev.trace.find(t => t.ruleId === 'out_of_state')?.stepDelta).toBe(-1);
  });

  it('boosts in-state applicants at the same school', () => {
    const ev = evaluate(makeStudent({ major: 'History', stateResidency: 'North Carolina' }), 'unc');
    expect(ev.trace.find(t => t.ruleId === 'in_state')?.stepDelta).toBe(1);
  });

  it('treats internationals as non-residents', () => {
    const ev = evaluate(makeStudent({ major: 'History', citizenship: 'International (China)', stateResidency: 'Texas' }), 'utaustin');
    expect(ev.trace.find(t => t.ruleId === 'out_of_state')).toBeTruthy();
  });

  it('assumes non-resident (conservatively, with a visible trace) when residency is unknown at a strong in-state public', () => {
    const ev = evaluate(makeStudent({ major: 'History', stateResidency: undefined }), 'uva');
    const rec = ev.trace.find(t => t.ruleId === 'residency_unknown');
    expect(rec?.stepDelta).toBe(-1);
    expect(ev.assessmentConfidence).toBe('low');
  });

  it('never rates a strong in-state public above Possible for a non-resident, however strong', () => {
    const stellar = makeAssessment({
      curriculum_rigor_in_context: { tier: 'exceptional', confidence: 'high' },
      extracurricular_distinction: { tier: 'exceptional', verifiability: 'externally_verified', confidence: 'high' },
    }, 'high');
    const ev = evaluate(makeStudent({ major: 'History', sat: '1590', stateResidency: 'California' }), 'uva', stellar);
    expect(tierIndex(ev.tier)).toBeLessThanOrEqual(tierIndex('possible'));
    // In-state applicants are not subject to the cap
    const inState = evaluate(makeStudent({ major: 'History', sat: '1590', stateResidency: 'Virginia' }), 'uva', stellar);
    expect(tierIndex(inState.tier)).toBeGreaterThan(tierIndex(ev.tier));
  });
});

/* ── International aid ────────────────────────────────────── */

describe('international need-based aid', () => {
  const intl = { citizenship: 'International (F-1)', needBasedAid: 'Yes' as const, major: 'History' };

  it('applies a need-aware penalty at need-aware privates', () => {
    const ev = evaluate(makeStudent({ ...intl }), 'nyu');
    expect(ev.trace.find(t => t.ruleId === 'intl_need_aware')?.stepDelta).toBe(-1);
  });

  it('does not penalize at need-blind schools', () => {
    const ev = evaluate(makeStudent({ ...intl }), 'harvard');
    expect(ev.trace.find(t => t.ruleId === 'intl_need_aware')).toBeUndefined();
    expect(ev.trace.find(t => t.ruleId === 'intl_need_blind')).toBeTruthy();
  });

  it('flags missing financial safety where internationals get no need aid', () => {
    const ev = evaluate(makeStudent({ ...intl }), 'berkeley');
    expect(ev.flags).toContain('no_intl_need_aid');
  });
});

/* ── Verifiability discount ───────────────────────────────── */

describe('verifiability', () => {
  it('credits an unverified exceptional spike but lowers confidence and flags overstatement — "not yet verified" ≠ "lower quality"', () => {
    const unverified = makeAssessment({
      extracurricular_distinction: { tier: 'exceptional', verifiability: 'self_reported_only' },
    });
    const verified = makeAssessment({
      extracurricular_distinction: { tier: 'exceptional', verifiability: 'externally_verified', confidence: 'high' },
    }, 'high');
    const evU = evaluate(makeStudent({ major: 'History' }), 'tufts', unverified);
    const evV = evaluate(makeStudent({ major: 'History' }), 'tufts', verified);
    // Same tier credit in both cases…
    expect(evU.trace.find(t => t.ruleId === 'distinction')?.stepDelta).toBe(1);
    expect(evV.trace.find(t => t.ruleId === 'distinction')?.stepDelta).toBe(1);
    expect(evU.tier).toBe(evV.tier);
    // …but the unverified one carries low confidence, a wider band, and a flag
    expect(evU.assessmentConfidence).toBe('low');
    expect(evU.flags).toContain('overstatement_risk');
    expect(evU.band.max - evU.band.min).toBeGreaterThan(evV.band.max - evV.band.min);
  });

  it('caps link_verified credit confidence at medium', () => {
    const linked = makeAssessment({
      major_preparation: { tier: 'exceptional', verifiability: 'link_verified', confidence: 'high' },
    });
    const ev = evaluate(makeStudent({ major: 'History' }), 'tufts', linked);
    expect(ev.trace.find(t => t.ruleId === 'distinction')?.confidence).toBe('medium');
  });

  it('withholds credit only for conflicting_or_incomplete evidence', () => {
    const conflicting = makeAssessment({
      extracurricular_distinction: { tier: 'exceptional', verifiability: 'conflicting_or_incomplete' },
    });
    const ev = evaluate(makeStudent({ major: 'History' }), 'tufts', conflicting);
    expect(ev.trace.find(t => t.ruleId === 'distinction_conflicting')?.stepDelta).toBe(0);
    expect(ev.flags).toContain('conflicting_evidence');
  });
});

/* ── Very Likely triple gate + declared unknowns ──────────── */

describe('very likely gate', () => {
  it('holds Very Likely at Likely when affordability is unconfirmed', () => {
    const student = makeStudent({ major: 'History', sat: '1560', needBasedAid: undefined });
    const ev = evaluate(student, 'purdue');
    expect(tierIndex(ev.tier)).toBeLessThanOrEqual(tierIndex('likely'));
    if (ev.trace.some(t => t.ruleId === 'very_likely_gate')) {
      expect(ev.flags).toContain('very_likely_gated');
    }
  });

  it('allows Very Likely when the family states no aid need and the major is not gated', () => {
    const student = makeStudent({ major: 'History', sat: '1560', needBasedAid: 'No' });
    const ev = evaluate(student, 'purdue');
    expect(ev.trace.find(t => t.ruleId === 'very_likely_gate')).toBeUndefined();
    expect(ev.tier).toBe('very_likely');
  });

  it('declares unknowns instead of silently assuming', () => {
    const ev = evaluate(makeStudent({ needBasedAid: 'Unsure' }), 'harvard');
    expect(ev.unknowns).toContain('hooks_not_modeled');
    expect(ev.unknowns).toContain('financial_need_unstated');
    // Harvard has no CS-gating fact → major-specific data unavailable for a CS applicant
    expect(ev.unknowns).toContain('major_specific_data_unavailable');
  });
});

/* ── ED commitment (round-aware leverage) ─────────────────── */

describe('ed commitment', () => {
  it('grants one bounded step for a committed ED at a high-leverage school, still under the selectivity ceiling', () => {
    const noEd = evaluate(makeStudent({ major: 'History' }), 'columbia');
    const withEd = evaluate(makeStudent({ major: 'History', edChoiceId: 'columbia' }), 'columbia');
    expect(withEd.trace.find(t => t.ruleId === 'ed_commitment')?.stepDelta).toBe(1);
    expect(withEd.flags).toContain('ed_committed');
    expect(tierIndex(withEd.tier)).toBeGreaterThanOrEqual(tierIndex(noEd.tier));
    // Columbia is sub-8% — even committed ED can never beat the Reach ceiling
    expect(tierIndex(withEd.tier)).toBeLessThanOrEqual(tierIndex('reach'));
  });

  it('gives no step for a committed early round with limited leverage', () => {
    const ev = evaluate(makeStudent({ major: 'History', edChoiceId: 'mit' }), 'mit');
    expect(ev.trace.find(t => t.ruleId === 'ed_commitment')).toBeUndefined();
    expect(ev.trace.find(t => t.ruleId === 'ed_commitment_limited')?.stepDelta).toBe(0);
  });

  it('does not apply the ED step at schools other than the committed one', () => {
    const ev = evaluate(makeStudent({ major: 'History', edChoiceId: 'columbia' }), 'duke');
    expect(ev.trace.find(t => t.ruleId === 'ed_commitment')).toBeUndefined();
    expect(ev.trace.find(t => t.ruleId === 'ed_opportunity')).toBeTruthy();
  });

  it('quotes the reported ED-pool rate as biased context in the rationale', () => {
    const ev = evaluate(makeStudent({ major: 'History', edChoiceId: 'upenn' }), 'upenn');
    const rec = ev.trace.find(t => t.ruleId === 'ed_commitment');
    expect(rec?.rationale).toMatch(/ED-pool rate ~15%.*hook-biased/);
  });
});

/* ── Stable timeline task ids ─────────────────────────────── */

describe('timeline task ids', () => {
  it('keeps ids stable across plan reordering and unrelated edits', async () => {
    const { deriveTimelineTasks } = await import('../timelineTasks');
    const planA = [
      { month: 'August 2026', tasks: 'Draft the personal statement. Ask two teachers for recommendations.' },
      { month: 'September 2026', tasks: 'Submit SAT scores.' },
    ];
    const planB = [
      { month: 'September 2026', tasks: 'Submit SAT scores. Book campus visits.' },
      { month: 'August 2026', tasks: 'Draft the personal statement. Ask two teachers for recommendations.' },
    ];
    const idsA = new Map(deriveTimelineTasks(planA).map(t => [t.text, t.id]));
    const idsB = new Map(deriveTimelineTasks(planB).map(t => [t.text, t.id]));
    for (const [text, id] of idsA) {
      expect(idsB.get(text)).toBe(id);
    }
    // New task gets a new id; duplicates are disambiguated deterministically
    expect(idsB.get('Book campus visits.')).toBeTruthy();
  });
});

/* ── Single-count principle ───────────────────────────────── */

describe('single-count principle', () => {
  it('never lets one evidence source produce two numeric steps in an evaluation', () => {
    const stellar = makeAssessment({
      curriculum_rigor_in_context: { tier: 'exceptional', confidence: 'high' },
      extracurricular_distinction: { tier: 'exceptional', verifiability: 'externally_verified', confidence: 'high' },
      major_preparation: { tier: 'exceptional', verifiability: 'externally_verified', confidence: 'high' },
    }, 'high');
    for (const id of ['mit', 'cornell', 'unc', 'purdue', 'berkeley']) {
      const ev = evaluate(makeStudent({ needBasedAid: 'Yes', citizenship: 'International' }), id, stellar);
      const numericRuleIds = ev.trace.filter(t => t.stepDelta !== 0).map(t => t.ruleId);
      expect(new Set(numericRuleIds).size).toBe(numericRuleIds.length);
      // extracurricular_distinction and major_preparation share ONE credit
      expect(numericRuleIds.filter(r => r === 'distinction').length).toBeLessThanOrEqual(1);
    }
  });
});

/* ── Uncertainty is visible ───────────────────────────────── */

describe('confidence and bands', () => {
  it('widens the band when assessment confidence is low', () => {
    const confident = evaluate(makeStudent({ major: 'History' }), 'bu', makeAssessment({}, 'high'));
    const shaky = evaluate(makeStudent({ major: 'History' }), 'bu', makeAssessment({}, 'low'));
    expect(shaky.band.max - shaky.band.min).toBeGreaterThan(confident.band.max - confident.band.min);
  });

  it('every non-zero adjustment carries a rationale and basis', () => {
    const ev = evaluate(makeStudent({ citizenship: 'International', needBasedAid: 'Yes' }), 'cmu');
    for (const t of ev.trace) {
      expect(t.rationale.length).toBeGreaterThan(10);
      expect(t.basis).toBeTruthy();
    }
  });
});

/* ── Portfolio math ───────────────────────────────────────── */

describe('portfolio summary', () => {
  it('bounds P(at least one) between perfectly-correlated and independent', () => {
    const student = makeStudent();
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    const { lowerPct, upperPct } = result.portfolio.pAtLeastOne;
    expect(lowerPct).toBeLessThanOrEqual(upperPct);
    expect(lowerPct).toBeGreaterThanOrEqual(0);
    expect(upperPct).toBeLessThanOrEqual(100);
  });

  it('marks shutout risk high/critical for an all-reach list', () => {
    const student = makeStudent({ sat: '1450', targetRange: 'Top 10' });
    const nums = extractStudentNumbers(student);
    const assessment = makeAssessment();
    const reachOnly = ['harvard', 'yale', 'princeton', 'stanford', 'mit', 'columbia']
      .map(id => evaluateSchool(student, nums, assessment, byId(id)));
    const summary = summarizePortfolio(reachOnly, reachOnly);
    expect(['high', 'critical']).toContain(summary.shutoutRisk);
    expect(summary.warnings).toContain('no_admission_safety');
  });

  it('respects risk-appetite portfolio targets and hard region exclusions when no list is given', () => {
    const student = makeStudent({ risk: 'Conservative', excludedRegions: ['West'], major: 'History' });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    expect(result.targets).toEqual({ reach: 2, match: 4, safety: 3 });
    const schoolsById = new Map(SCHOOLS.map(s => [s.id, s]));
    for (const ev of result.selected) {
      expect(schoolsById.get(ev.schoolId)!.region).not.toBe('West');
    }
  });
});

/* ── Preferred-list-driven selection ──────────────────────── */

describe('preferred school list', () => {
  it("analyzes exactly the student's structured picks — no substitutions", () => {
    const ids = ['mit', 'stanford', 'cmu', 'georgia_tech', 'purdue', 'utaustin'];
    const student = makeStudent({ preferredSchoolIds: ids });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    expect(result.selected.map(e => e.schoolId).sort()).toEqual([...ids].sort());
  });

  it('resolves a legacy free-text list by name and reports unmatched names', () => {
    const student = makeStudent({ preferred: 'MIT, Stanford, Hogwarts School of Magic' });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    expect(result.selected.map(e => e.schoolId).sort()).toEqual(['mit', 'stanford']);
    expect(result.portfolio.unmatchedPreferred).toEqual(['Hogwarts School of Magic']);
    expect(result.portfolio.warnings).toContain('unmatched_preferred_schools');
  });

  it('suggests safety/match additions for an all-reach list instead of silently padding it', () => {
    const student = makeStudent({ preferredSchoolIds: ['mit', 'stanford', 'caltech', 'cmu'] });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    expect(result.selected).toHaveLength(4);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every(s => s.uiBucket !== 'reach')).toBe(true);
    expect(result.portfolio.warnings).toContain('no_admission_safety');
    expect(['high', 'critical']).toContain(result.portfolio.shutoutRisk);
  });

  it('makes no suggestions when the list already covers match and safety', () => {
    const student = makeStudent({ preferredSchoolIds: ['mit', 'georgia_tech', 'purdue', 'wisc', 'utaustin', 'ucdavis'] });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    const count = (b: string) => result.selected.filter(e => e.uiBucket === b).length;
    if (count('match') >= 2 && count('safety') >= 2) {
      expect(result.suggestions).toHaveLength(0);
    }
  });

  it('matches geography preferences by region name, state name, or state abbreviation', () => {
    const rice = byId('rice');       // Houston, TX — region South
    const berkeley = byId('berkeley'); // CA — region West
    expect(matchesRegionOrState('Texas', rice)).toBe(true);
    expect(matchesRegionOrState('TX', rice)).toBe(true);
    expect(matchesRegionOrState('South', rice)).toBe(true);
    expect(matchesRegionOrState('Texas', berkeley)).toBe(false);
    expect(matchesRegionOrState('California', berkeley)).toBe(true);
    expect(matchesRegionOrState('West', berkeley)).toBe(true);
  });

  it('drops state-excluded schools from engine picks', () => {
    const student = makeStudent({ major: 'History', excludedRegions: ['California'] });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    const schoolsById = new Map(SCHOOLS.map(s => [s.id, s]));
    for (const ev of result.selected) {
      expect(schoolsById.get(ev.schoolId)!.state).not.toBe('CA');
    }
  });

  it('caps the list at 20 schools', () => {
    const ids = SCHOOLS.slice(0, 25).map(s => s.id);
    const student = makeStudent({ preferredSchoolIds: ids });
    const result = runEngine(student, makeAssessment(), SCHOOLS);
    expect(result.selected.length).toBeLessThanOrEqual(20);
  });
});
