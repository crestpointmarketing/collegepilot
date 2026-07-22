import { describe, it, expect } from 'vitest';
import { ESSAY_PROMPT_LIBRARY, LIBRARY_SCHOOL_IDS, promptsForSchool } from './promptLibrary';
import { PROMPT_TYPES } from './types';
import { SCHOOLS } from '../schools';

describe('essay prompt library integrity', () => {
  it('covers the 20 core schools', () => {
    expect(LIBRARY_SCHOOL_IDS.length).toBe(20);
  });

  it('every schoolId resolves to a real school', () => {
    const ids = new Set(SCHOOLS.map(s => s.id));
    for (const p of ESSAY_PROMPT_LIBRARY) expect(ids.has(p.schoolId), p.schoolId).toBe(true);
  });

  it('every prompt has a valid type, cycle, status, and unique id', () => {
    const seen = new Set<string>();
    for (const p of ESSAY_PROMPT_LIBRARY) {
      expect(PROMPT_TYPES).toContain(p.promptType);
      expect(p.admissionCycle).toMatch(/^\d{4}-\d{2}$/);
      expect(['current', 'needs_verification', 'expired']).toContain(p.status);
      expect(p.promptText.length).toBeGreaterThan(20);
      expect(seen.has(p.id), `duplicate id ${p.id}`).toBe(false);
      seen.add(p.id);
    }
  });

  it('honesty: only official-source prompts may be marked current', () => {
    for (const p of ESSAY_PROMPT_LIBRARY) {
      if (p.status === 'current') expect(p.sourceType).toBe('official');
    }
  });

  it('UC schools carry the 8 PIQs', () => {
    for (const uc of ['berkeley', 'ucla', 'ucsd']) {
      expect(promptsForSchool(uc).length).toBe(8);
    }
  });
});
