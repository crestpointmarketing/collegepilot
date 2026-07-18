import { describe, expect, it } from 'vitest';
import { CHAR_LIMITS } from './characterLimits';
import { SAMPLE_STUDENTS, upgradeSampleStudentProfile } from './data';

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

  it('includes the latest internships, startup work, and VLA research', () => {
    expect(ethan?.activities.map(activity => activity.org)).toEqual(expect.arrayContaining([
      'OneSource Cloud',
      'DreamCollege.ai',
      'PomeloLabs',
      'UT Dallas STEM Bridge / IRVL',
      'Elocutionist',
      'Zeitgeist (Independent Project)',
    ]));
    expect(ethan?.activities.every(activity => activity.desc.length <= CHAR_LIMITS.activityDesc)).toBe(true);
    expect(ethan?.activities.find(activity => activity.org === 'OneSource Cloud')?.period).toBe('Summer 2025–Present');
    expect(ethan?.projects?.map(project => project.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(ethan?.projects?.find(project => project.id === 'p3')?.outcome).toContain('80% success');
    expect(ethan?.projects?.find(project => project.id === 'p3')?.period).toBe('Summer 2026');
  });

  it('upgrades an existing Ethan sample without creating or replacing unrelated students', () => {
    const oldEthan = { ...ethan!, sampleProfileRevision: undefined, activities: ethan!.activities.slice(0, 6), projects: [] };
    const upgraded = upgradeSampleStudentProfile(oldEthan);
    const unrelated = SAMPLE_STUDENTS.find(student => student.id === 's1')!;

    expect(upgraded.sampleProfileRevision).toBe('2026-07-17-online-presence-links');
    expect(upgraded.activities).toHaveLength(10);
    expect(upgraded.projects).toHaveLength(5);
    expect(upgraded.status).toBe('Draft');
    expect(upgraded.websiteUrl).toBe('https://www.ethanli.ai');
    expect(upgraded.githubUrl).toBe('https://github.com/3than777');
    expect(upgraded.projects?.every(project => project.links?.every(link => link.url.startsWith('https://')))).toBe(true);
    expect(upgradeSampleStudentProfile({ ...oldEthan, status: 'Strategy Generated' }).status).toBe('Needs Review');
    expect(upgradeSampleStudentProfile(unrelated)).toBe(unrelated);
  });
});
