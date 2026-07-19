import { describe, expect, it } from 'vitest';
import { SCHOOLS } from '../schools';
import { buildSchoolStructure, deriveProgramReputation } from './schoolStructure';

const byId = (id: string) => SCHOOLS.find(s => s.id === id)!;

describe('buildSchoolStructure', () => {
  it('returns a hand-verified hierarchy for a flagship (CMU)', () => {
    const s = buildSchoolStructure(byId('cmu'));
    expect(s.confidence).toBe('high');
    expect(s.colleges.some(c => /School of Computer Science/i.test(c.name))).toBe(true);
    // has real departments, not just a flat major list
    const scs = s.colleges.find(c => /School of Computer Science/i.test(c.name))!;
    expect(scs.departments.length).toBeGreaterThan(1);
  });

  it('degrades honestly for a non-verified school (flattened + low confidence)', () => {
    const s = buildSchoolStructure(byId('tulane'));
    expect(s.confidence).toBe('low');
    expect(s.note).toMatch(/not verified|not yet detailed/i);
    // the single college is the flattened major list
    expect(s.colleges).toHaveLength(1);
    expect(s.colleges[0].departments[0].programs.length).toBeGreaterThan(0);
  });
});

describe('deriveProgramReputation', () => {
  it('never emits a fabricated program-rank number — only the sourced overall rank', () => {
    for (const id of ['cornell', 'mit', 'uiuc', 'tulane', 'rochester']) {
      const r = deriveProgramReputation(byId(id), 'Computer Science');
      // overall rank references the institution rank only
      expect(r.overallRankingNote).toContain(`#${byId(id).ranking}`);
      // field tier is a word, not a number
      expect(['Nationally Recognized', 'Strong', 'Solid', 'Emerging']).toContain(r.fieldTier);
      // no "#N" program-rank claims anywhere in the signals
      const joined = r.signals.join(' ');
      expect(joined).not.toMatch(/#\d+/);
      // disclaimer explicitly disowns official program ranking
      expect(r.disclaimer).toMatch(/not an official program ranking/i);
    }
  });

  it('grades a top CS school as Nationally Recognized and a weak-signal school lower', () => {
    const mit = deriveProgramReputation(byId('mit'), 'Computer Science');
    expect(mit.fieldTier).toBe('Nationally Recognized');
    const tulane = deriveProgramReputation(byId('tulane'), 'Computer Science');
    // Tulane is not topRanked and has no CS highlights → not Nationally Recognized
    expect(tulane.fieldTier).not.toBe('Nationally Recognized');
  });

  it('surfaces CS gating as a demand signal explicitly labeled not-a-ranking', () => {
    const r = deriveProgramReputation(byId('uiuc'), 'Computer Science');
    expect(r.signals.some(s => /demand signal|competitive/i.test(s))).toBe(true);
  });

  it('flags an unoffered field as Emerging with a verify note', () => {
    // A niche field no school in the set lists as a distinct major.
    const r = deriveProgramReputation(byId('tulane'), 'Nuclear Engineering');
    expect(r.fieldTier).toBe('Emerging');
    expect(r.signals.join(' ')).toMatch(/no evidence|verify/i);
  });
});
