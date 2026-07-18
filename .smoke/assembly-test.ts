/**
 * Offline smoke: fixture assessment → engine → Strategy assembly → zod round-trip.
 * Verifies everything the route does EXCEPT the two LLM calls.
 * Run: npx tsx .smoke/assembly-test.ts
 */
import { SAMPLE_STUDENTS } from '@/lib/data';
import { SCHOOLS } from '@/lib/schools';
import { DIMENSION_KEYS, type ProfileAssessment } from '@/lib/admissions/assessment';
import { runEngine } from '@/lib/admissions/engine';
import { strategySchema } from '@/lib/schemas';
import type { Strategy } from '@/types';

const dim = (tier: ProfileAssessment['dimensions'][keyof ProfileAssessment['dimensions']]['tier'], verifiability: 'externally_verified' | 'link_verified' | 'self_reported_only' = 'link_verified') => ({
  tier, evidence: ['fixture'], missing: [], risks: [], verifiability, confidence: 'medium' as const, reader_interpretation: 'fixture read', overstatement_risk: 'low' as const,
});

const assessment: ProfileAssessment = {
  dimensions: Object.fromEntries(DIMENSION_KEYS.map(k => [k, dim('strong')])) as ProfileAssessment['dimensions'],
  spike: { has_spike: true, domain: 'applied ML', summary: 'Research depth with a published artifact.' },
  profile_read: 'Strong technical applicant.',
  key_risks: ['CS gating at publics', 'essay execution'],
  assessment_confidence: 'medium',
  assessment_gaps: [],
};

const student = SAMPLE_STUDENTS.find(s => s.name.includes('Ethan')) ?? SAMPLE_STUDENTS[0];
const engine = runEngine(student, assessment, SCHOOLS);

// Mirror the route's assembleStrategy shape with placeholder narrative text
const entry = (ev: (typeof engine.selected)[number]) => ({
  name: ev.short, chance: `${ev.band.min}–${ev.band.max}%`, note: `${ev.tierLabel} placeholder note.`,
});
const strategy: Strategy = {
  analysis: { spike_assessment: 'x', academic_rigor: 'x', profile_read: 'x', key_risks: 'x' },
  positioning: { type: 'x', identity: 'x', strengths: ['a', 'b', 'c'], weaknesses: ['a', 'b'] },
  competitiveness: {
    top10: { level: engine.portfolio.competitivenessLevels.top10, note: 'x' },
    top20: { level: engine.portfolio.competitivenessLevels.top20, note: 'x' },
    top50: { level: engine.portfolio.competitivenessLevels.top50, note: 'x' },
    bullets: ['a', 'b'],
  },
  schools: {
    reach: engine.selected.filter(e => e.uiBucket === 'reach').map(entry),
    match: engine.selected.filter(e => e.uiBucket === 'match').map(entry),
    safety: engine.selected.filter(e => e.uiBucket === 'safety').map(entry),
  },
  strategy: { ed_ea: 'x', narrative: 'x' },
  plan: [{ month: 'Aug 2026', tasks: 'x' }],
  meta: {
    overall_success_probability: `${engine.portfolio.pAtLeastOne.lowerPct}–${engine.portfolio.pAtLeastOne.upperPct}%`,
    assessment: 'x',
    improvement_levers: ['Action → effect (by deadline)'],
  },
  v2: {
    version: 2, generatedAt: new Date().toISOString(),
    assessment, evaluations: engine.selected, portfolio: engine.portfolio,
    levers: [{ action: 'x', dimension: 'major_preparation', deadline: 'Aug 2026', expected_effect: 'x', rationale: 'x' }],
  },
};

const parsed = strategySchema.safeParse(JSON.parse(JSON.stringify(strategy)));
if (!parsed.success) {
  console.error('SCHEMA ROUND-TRIP FAILED:', parsed.error.issues.slice(0, 5));
  process.exit(1);
}

console.log(`Student: ${student.name} — engine evaluated ${engine.evaluations.length}, selected ${engine.selected.length}`);
for (const ev of engine.selected) {
  console.log(`  ${ev.short.padEnd(16)} ${ev.uiBucket.padEnd(7)} ${ev.tierLabel.padEnd(12)} ${String(ev.band.min).padStart(2)}–${ev.band.max}%  base=${ev.baseRateUsed.pct}%(${ev.baseRateUsed.scope})  trace=${ev.trace.length}  flags=[${ev.flags.join(',')}]`);
}
const p = engine.portfolio;
console.log(`P(≥1): ${p.pAtLeastOne.lowerPct}–${p.pAtLeastOne.upperPct}% | shutout=${p.shutoutRisk} | coverage R${p.coverage.reach}/M${p.coverage.match}/S${p.coverage.safety} | warnings=[${p.warnings.join(',')}]`);
console.log(`Levels: T10=${p.competitivenessLevels.top10} T20=${p.competitivenessLevels.top20} T50=${p.competitivenessLevels.top50}`);
console.log('ASSEMBLY + SCHEMA ROUND-TRIP OK');


