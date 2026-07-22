import { describe, it, expect } from 'vitest';
import { serializeConfirmedFocus } from './prompts';
import { primaryDirectionTitle } from './admissions/journey';
import type { Student } from '@/types';
import type { PositioningState, DirectionState } from './admissions/journey';

const positioning = {
  generatedAt: '2026-01-01',
  hypotheses: [
    { id: 'h1', kind: 'core_fit', label: 'Technology-to-Product Builder', supportingEvidence: [], missingEvidence: [], narrativeRisk: '', confidence: 'high', fieldTypes: [], careerPaths: [] },
    { id: 'h2', kind: 'strategic_adjacent', label: 'Applied ML Researcher', supportingEvidence: [], missingEvidence: [], narrativeRisk: '', confidence: 'medium', fieldTypes: [], careerPaths: [] },
  ],
  validations: [],
  confirmed: [{ hypothesisId: 'h1', role: 'primary' }, { hypothesisId: 'h2', role: 'secondary' }],
} as unknown as PositioningState;

const direction = {
  generatedAt: '2026-01-01',
  directions: [
    { id: 'd1', title: 'Computer Science + Business', category: 'direct_fit', chain: '', reason: '', fitAxes: [], overallFit: 'Strong', admissionsLeverage: 'Moderate', adjacent: [], preparationGaps: [] },
    { id: 'd2', title: 'Operations Research', category: 'strategic_adjacent', chain: '', reason: '', fitAxes: [], overallFit: 'Moderate', admissionsLeverage: 'Strong', adjacent: [], preparationGaps: [] },
  ],
  selected: [{ directionId: 'd1', role: 'primary' }],
} as unknown as DirectionState;

const asStudent = (o: Partial<Student>) => o as unknown as Student;

describe('primaryDirectionTitle', () => {
  it('returns null when direction is undefined or unconfirmed', () => {
    expect(primaryDirectionTitle(undefined)).toBeNull();
    expect(primaryDirectionTitle({ ...direction, selected: [] } as unknown as DirectionState)).toBeNull();
  });
  it('returns the confirmed primary direction title', () => {
    expect(primaryDirectionTitle(direction)).toBe('Computer Science + Business');
  });
});

describe('serializeConfirmedFocus — feeds the narrative call', () => {
  it('marks everything inferred when nothing is confirmed', () => {
    const out = serializeConfirmedFocus(asStudent({}));
    expect(out).toMatch(/none yet/i);
    expect(out).toMatch(/inferred|working/i);
    expect(out).not.toMatch(/authoritative/i);
  });

  it('emits confirmed identity + direction as authoritative, story/major only', () => {
    const out = serializeConfirmedFocus(asStudent({ positioning, direction }));
    expect(out).toMatch(/authoritative/i);
    expect(out).toContain('Technology-to-Product Builder'); // primary identity
    expect(out).toContain('Computer Science + Business');    // primary direction
    // the honesty boundary must be stated: never move a tier/band/probability
    expect(out).toMatch(/must NOT change any admit tier|must not move a tier|fixed by the engine/i);
  });

  it('still labels an unconfirmed half as inferred when only one is confirmed', () => {
    const out = serializeConfirmedFocus(asStudent({ direction })); // direction only, no identity
    expect(out).toMatch(/authoritative/i);
    expect(out).toContain('Computer Science + Business');
    expect(out).toMatch(/Identity: not yet confirmed/i);
  });
});
