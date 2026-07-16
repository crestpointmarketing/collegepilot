import { describe, expect, it } from 'vitest';
import { SAMPLE_STUDENTS } from './data';

describe('Ethan Li final Grade-11 transcript', () => {
  const ethan = SAMPLE_STUDENTS.find(student => student.id === 's7');

  it('contains every credit-bearing row from the official AAR', () => {
    expect(ethan).toBeDefined();
    expect(ethan?.transcriptRevision).toBe('2026-06-11-final');
    expect(ethan?.courses).toHaveLength(32);
    expect(ethan?.courses?.reduce((total, course) => total + (course.credit ?? 0), 0)).toBe(30);
  });

  it('preserves pre-high-school and AP Computer Science A lab context', () => {
    const preHighSchool = ethan?.courses?.filter(course => course.year === 'Pre-9') ?? [];
    expect(preHighSchool.map(course => course.id)).toEqual(['c4', 'c9', 'c10', 'c27', 'c28']);

    const labRows = ethan?.courses?.filter(course => course.transcriptCode === 'APTACSAL:P') ?? [];
    expect(labRows).toHaveLength(2);
    expect(labRows.map(course => [course.gradeSem1, course.gradeSem2, course.credit])).toEqual([
      ['93', '', 0.5],
      ['', '93', 0.5],
    ]);
  });

  it('does not invent AP exam scores from course grades', () => {
    expect(ethan?.courses?.filter(course => course.level === 'AP').every(course => course.apScore === undefined)).toBe(true);
  });
});
