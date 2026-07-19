import { describe, expect, it } from 'vitest';
import { SCHOOLS } from '../schools';
import type { Student } from '@/types';
import { DIMENSION_KEYS, type DimensionAssessment, type ProfileAssessment } from './assessment';
import { computeApplicationStrategy, computeSchoolMatch } from './schoolMatch';

function dim(o: Partial<DimensionAssessment> = {}): DimensionAssessment {
  return {
    tier: 'solid', evidence: ['fixture evidence'], missing: [], risks: [],
    verifiability: 'link_verified', confidence: 'medium',
    reader_interpretation: 'reads solid', overstatement_risk: 'low', ...o,
  };
}

function assessment(over: Partial<Record<(typeof DIMENSION_KEYS)[number], Partial<DimensionAssessment>>> = {}, spike = true): ProfileAssessment {
  return {
    dimensions: Object.fromEntries(DIMENSION_KEYS.map(k => [k, dim(over[k])])) as ProfileAssessment['dimensions'],
    spike: { has_spike: spike, domain: 'applied ML systems', summary: 'Verified research spike.' },
    profile_read: 'Strong technical applicant.',
    key_risks: ['a', 'b'],
    assessment_confidence: 'medium',
    assessment_gaps: ['no publication', 'essays not drafted'],
  };
}

function student(o: Partial<Student> = {}): Student {
  return {
    id: 'test', name: 'Test', grade: 12, school: 'HS', city: 'Austin',
    major: 'Computer Science', secondary: '', gpa: '4.0', gpaType: 'Weighted',
    sat: '1550', act: '', apCount: 8, strengths: [], weak: [],
    citizenship: 'US Citizen', schoolType: 'Public', competitiveness: '',
    firstGen: 'No', targetRange: 'Top 20', risk: 'Balanced', preferred: '',
    traits: '', angles: '', color: '#000', status: 'Draft', updated: '',
    activities: [], awards: [], ...o,
  };
}

const byId = (id: string) => SCHOOLS.find(s => s.id === id)!;

describe('computeSchoolMatch', () => {
  it('produces qualitative fit levels, never bare numeric scores', () => {
    const m = computeSchoolMatch(student(), byId('cornell'), assessment());
    expect(m.axes).toHaveLength(6);
    for (const axis of m.axes) {
      expect(['Excellent', 'Strong', 'Moderate', 'Limited', 'Unknown']).toContain(axis.level);
      expect(axis.rationale.length).toBeGreaterThan(10);
    }
    // overall is a word, not a number
    expect(['Excellent', 'Strong', 'Moderate', 'Limited', 'Unknown']).toContain(m.overall);
  });

  it('only counts verified strengths, and flags self-reported ones as weaknesses', () => {
    const m = computeSchoolMatch(student(), byId('cornell'), assessment({
      major_preparation: { tier: 'exceptional', verifiability: 'externally_verified' },
      intellectual_vitality: { tier: 'exceptional', verifiability: 'self_reported_only' },
    }));
    expect(m.strengths.some(s => s.label === 'Major preparation')).toBe(true);
    // self-reported exceptional shows up as a weakness, not a strength
    expect(m.strengths.some(s => s.label === 'Intellectual vitality')).toBe(false);
    expect(m.weaknesses.some(w => w.label.startsWith('Unverified'))).toBe(true);
  });

  it('ranks the intended major first and marks gated CS programs with a caution', () => {
    const m = computeSchoolMatch(student({ major: 'Computer Science' }), byId('uiuc'), assessment({
      major_preparation: { tier: 'exceptional', verifiability: 'externally_verified' },
    }));
    const cs = m.majorRecommendations.find(r => /computer science/i.test(r.major));
    expect(cs).toBeTruthy();
    expect(m.majorRecommendations[0].fit).toBe('Excellent');
    // UIUC CS is extreme-gated → caution present
    expect(cs?.gated).toBe(true);
    expect(cs?.caution).toMatch(/gated|direct-admit|harder/i);
  });

  it('holds overall fit down to the weakest KNOWN gating axis', () => {
    const m = computeSchoolMatch(
      student({ major: 'History' }), // not an MIT strength → program fit limited
      byId('mit'),
      assessment(),
    );
    expect(m.overall).toBe('Limited');
  });

  it('degrades gracefully instead of crashing when a dimension key is missing', () => {
    const a = assessment();
    // Simulate an older/partial persisted assessment missing several keys.
    const partial = { ...a, dimensions: { ...a.dimensions } } as ProfileAssessment;
    delete (partial.dimensions as Record<string, unknown>).academic_readiness;
    delete (partial.dimensions as Record<string, unknown>).major_preparation;
    delete (partial.dimensions as Record<string, unknown>).leadership_impact;
    expect(() => computeSchoolMatch(student(), byId('cornell'), partial)).not.toThrow();
    const m = computeSchoolMatch(student(), byId('cornell'), partial);
    expect(m.axes).toHaveLength(6);
  });

  it('does not tag an unrelated school major as intended via loose substring matching', () => {
    // Economics student: "Engineering" / "Computer Science" must NOT be flagged
    // as their intended major just because of substring overlap.
    const m = computeSchoolMatch(student({ major: 'Economics' }), byId('cornell'), assessment());
    const eng = m.majorRecommendations.find(r => /engineering|computer science/i.test(r.major));
    if (eng) expect(eng.isIntended).toBe(false);
  });

  it('never lets missing preference data (Unknown) drag overall fit below the known axes', () => {
    // Strong verified profile, no stated setting/size prefs → culture Unknown.
    const m = computeSchoolMatch(
      student({ preferredSettings: [], preferredSchoolSizes: [] }),
      byId('cornell'),
      assessment({
        academic_readiness: { tier: 'exceptional', verifiability: 'externally_verified' },
        major_preparation: { tier: 'exceptional', verifiability: 'externally_verified' },
        narrative_coherence: { tier: 'strong' },
        intellectual_vitality: { tier: 'strong' },
      }),
    );
    expect(m.axes.find(a => a.key === 'culture')?.level).toBe('Unknown');
    expect(m.overall).not.toBe('Unknown');
    expect(m.overall).not.toBe('Limited');
  });
});

describe('computeApplicationStrategy', () => {
  it('recommends binding ED at a high-leverage school for an unconstrained applicant', () => {
    const s = byId('cornell');
    const a = assessment();
    const strat = computeApplicationStrategy(student({ needBasedAid: 'No' }), s, a, computeSchoolMatch(student({ needBasedAid: 'No' }), s, a));
    expect(strat.recommendedRound).toBe('ED');
    expect(strat.roundStrength).toBe('Excellent');
  });

  it('steers an aid-dependent international away from binding ED', () => {
    const s = byId('cornell');
    const a = assessment();
    const st = student({ citizenship: 'International (F-1)', needBasedAid: 'Yes' });
    const strat = computeApplicationStrategy(st, s, a, computeSchoolMatch(st, s, a));
    expect(strat.recommendedRound).toBe('RD');
    expect(strat.roundRationale).toMatch(/aid|financ/i);
  });

  it('derives essay angles from the verified spike and surfaces assessment gaps as material to-dos', () => {
    const s = byId('mit');
    const a = assessment();
    const strat = computeApplicationStrategy(student(), s, a, computeSchoolMatch(student(), s, a));
    expect(strat.essayAngles.some(e => /applied ML systems/i.test(e))).toBe(true);
    expect(strat.materialGaps.length).toBeGreaterThan(0);
  });

  it('recommends non-binding EA where no binding round exists', () => {
    const s = byId('mit'); // EA
    const a = assessment();
    const strat = computeApplicationStrategy(student(), s, a, computeSchoolMatch(student(), s, a));
    expect(strat.recommendedRound).toBe('EA');
  });

  it('does not steer into binding ED at a school where ED leverage is limited/not-recommended', () => {
    // Georgetown offers REA (not binding ED) — but test the general rule via a
    // school with EA_ED + limited leverage: prefer the non-binding EA.
    const s = byId('cwru'); // EA_ED, moderate
    const a = assessment();
    const strat = computeApplicationStrategy(student(), s, a, computeSchoolMatch(student(), s, a));
    // Whatever it recommends, it must never contradict itself by printing
    // "not recommended leverage" while recommending ED.
    expect(strat.roundRationale.toLowerCase()).not.toMatch(/not recommended leverage/);
    if (strat.recommendedRound === 'ED') {
      // If it does pick ED, it must be because leverage is real, not the fallthrough.
      expect(strat.roundRationale).not.toMatch(/limited leverage/i);
    }
  });

  it('never tells a student to avoid their own intended major', () => {
    // Intended CS at a gated school, but weak prep → Limited + gated.
    const st = student({ major: 'Computer Science' });
    const s = byId('uiuc');
    const a = assessment({ major_preparation: { tier: 'developing', verifiability: 'self_reported_only' } });
    const match = computeSchoolMatch(st, s, a);
    const strat = computeApplicationStrategy(st, s, a, match);
    if (strat.avoid) expect(strat.avoid.toLowerCase()).not.toContain('computer science');
  });
});
