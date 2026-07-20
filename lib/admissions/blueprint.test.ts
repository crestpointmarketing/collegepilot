import { describe, it, expect } from 'vitest';
import { collectClaimRegister, type Blueprint } from './blueprint';
import { blueprintSpineJsonSchema } from './blueprintSchema';

/** A minimal Blueprint with one verify claim and one confirmed claim. */
function fixture(): Omit<Blueprint, 'claimRegister'> {
  const emptyIdentity: Blueprint['identity'] = {
    coreIdentity: 'Technology-to-Product Builder',
    distinctiveCapability: 'Technology Translator',
    positioningStatement: { text: 'X', status: 'working_hypothesis', verifyAction: 'confirm with student' },
    firstPersonDraft: '', intrinsicMotivation: '', craft: '', purpose: '', avoids: [],
    operatingSystem: [],
    brandDna: [{ trait: 'Rigor', internalQuestion: 'What happens under load?', evidence: { text: 'benchmarks', status: 'confirmed' } }],
    growthJourney: [],
  };
  return {
    version: 1, generatedAt: '', studentId: 's1', studentName: 'Test', status: 'working_draft',
    draftLabel: 'v0.1', thesis: '',
    executiveOverview: { coreIdentity: '', primaryNarrative: '', bestFitModel: '', currentEarlyRecommendation: '', guardrail: '' },
    identity: emptyIdentity,
    positioning: { archetypeLabel: '', archetypeComparison: [], positioningDecision: '', strengthsGapsRisks: [
      { area: 'Metrics', assessment: '46% figure', risk: 'method unclear', action: 'document dataset', status: 'verify' },
    ], mostImportantRisk: { risk: '', strongerMessage: '' } },
    futureSelf: { futureIdentity: '', plausibleDirections: [], notTheCenter: [], learningAgenda: [] },
    evidence: { academicFoundation: [], threePillars: [], caseStudies: [
      { name: 'SpeakWise', headline: '', layers: [], strategicMeaning: '', bestUses: [],
        verifyGaps: [{ text: 'individual contribution', status: 'verify', verifyAction: 'write contribution memo' }] },
    ], rangeEvidence: [] },
    programFit: { needs: [], landscape: [], fitMatrix: [], priorityPrograms: [], roundStrategy: [], bindingPrinciple: '' },
    narrative: { masterLine: '', schoolEmphasis: [], commonAppDirections: [], activitiesArchitecture: [], resumeHeadline: '', recommendations: [], interviewStoryBank: [] },
    familyReviewQuestions: [], next30Days: [],
  };
}

describe('collectClaimRegister', () => {
  it('surfaces every non-confirmed claim and skips confirmed ones', () => {
    const reg = collectClaimRegister(fixture());
    const claims = reg.map(r => r.claim);
    expect(claims).toContain('individual contribution');   // case-study verify gap
    expect(claims).toContain('46% figure');                // positioning verify risk
    expect(claims).toContain('X');                          // working_hypothesis positioning statement
    expect(claims).not.toContain('benchmarks');            // confirmed → excluded
  });

  it('carries the required action and status through', () => {
    const reg = collectClaimRegister(fixture());
    const speak = reg.find(r => r.claim === 'individual contribution');
    expect(speak?.status).toBe('verify');
    expect(speak?.requiredAction).toBe('write contribution memo');
    expect(speak?.location).toContain('SpeakWise');
  });
});

describe('blueprintSpineJsonSchema', () => {
  it('builds a closed strict-output schema without throwing', () => {
    const schema = blueprintSpineJsonSchema();
    expect(schema).toBeTruthy();
    expect((schema as { type?: string }).type).toBe('object');
    expect((schema as { additionalProperties?: boolean }).additionalProperties).toBe(false);
    // spine top-level fields present
    const props = (schema as { properties?: Record<string, unknown> }).properties ?? {};
    for (const k of ['thesis', 'executiveOverview', 'identity', 'positioning', 'futureSelf', 'familyReviewQuestions', 'next30Days']) {
      expect(props).toHaveProperty(k);
    }
  });
});
