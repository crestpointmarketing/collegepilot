import { describe, it, expect } from 'vitest';
import { positioningJsonSchema } from './positioningSchema';
import {
  EVIDENCE_STATUS_ORDER, EVIDENCE_STATUS_META, DEFAULT_EVIDENCE_STATUS,
  HYPOTHESIS_KIND_ORDER, HYPOTHESIS_KIND_META,
  STUDENT_REACTION_ORDER, STUDENT_REACTION_META,
  APPLICATION_UNIT_ORDER, APPLICATION_UNIT_META,
  isValidConvergence, pathwayLabel,
  type ConfirmedDirection, type ApplicationPathway,
} from './journey';

describe('journey vocabularies', () => {
  it('every enum value has a meta entry', () => {
    for (const s of EVIDENCE_STATUS_ORDER) expect(EVIDENCE_STATUS_META[s]).toBeTruthy();
    for (const k of HYPOTHESIS_KIND_ORDER) expect(HYPOTHESIS_KIND_META[k]).toBeTruthy();
    for (const r of STUDENT_REACTION_ORDER) expect(STUDENT_REACTION_META[r]).toBeTruthy();
    for (const u of APPLICATION_UNIT_ORDER) expect(APPLICATION_UNIT_META[u]).toBeTruthy();
  });

  it('defaults to provided, and only "confirmed" counts as self-attested', () => {
    expect(DEFAULT_EVIDENCE_STATUS).toBe('provided');
    expect(EVIDENCE_STATUS_ORDER).toEqual(['provided', 'confirmed', 'planned']);
    expect(EVIDENCE_STATUS_ORDER.filter(s => EVIDENCE_STATUS_META[s].confirmed)).toEqual(['confirmed']);
  });
});

describe('isValidConvergence — one core identity + adjacent expressions', () => {
  const d = (hypothesisId: string, role: ConfirmedDirection['role']): ConfirmedDirection => ({ hypothesisId, role });

  it('accepts exactly one primary (+ optional one secondary + explores)', () => {
    expect(isValidConvergence([d('a', 'primary')])).toBe(true);
    expect(isValidConvergence([d('a', 'primary'), d('b', 'secondary'), d('c', 'exploratory'), d('d', 'exploratory')])).toBe(true);
  });

  it('rejects zero or multiple primaries, and multiple secondaries', () => {
    expect(isValidConvergence([d('a', 'secondary')])).toBe(false);              // no primary
    expect(isValidConvergence([d('a', 'primary'), d('b', 'primary')])).toBe(false); // 5 parallel personas guard
    expect(isValidConvergence([d('a', 'primary'), d('b', 'secondary'), d('c', 'secondary')])).toBe(false);
  });
});

describe('pathwayLabel', () => {
  const base: ApplicationPathway = {
    id: 'p1', schoolId: 'nyu', university: 'NYU', college: 'Stern', program: 'Khubani BTE',
    applicationUnit: 'special_program', round: 'ED', fit: 'Strong', admissionsLeverage: 'Moderate', status: 'provided',
  };
  it('joins the filled parts with a separator', () => {
    expect(pathwayLabel(base)).toBe('NYU · Stern · Khubani BTE · ED');
  });
  it('skips an empty college', () => {
    expect(pathwayLabel({ ...base, college: undefined, program: 'Computer Science', round: 'RD' }))
      .toBe('NYU · Computer Science · RD');
  });
});

describe('positioningJsonSchema', () => {
  it('builds a closed schema with a hypotheses array', () => {
    const schema = positioningJsonSchema() as { type?: string; additionalProperties?: boolean; properties?: Record<string, unknown> };
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties).toHaveProperty('hypotheses');
  });
});
