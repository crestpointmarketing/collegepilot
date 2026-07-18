/**
 * Standalone end-to-end test of the v2 generation pipeline:
 * assessment (LLM, forced tool) → engine (deterministic) → narrative (LLM, forced tool).
 * Bypasses auth/Supabase — exercises exactly what the route does.
 * Run: npx tsx --env-file=.env.local <this file>  (from repo root)
 */
import Anthropic from '@anthropic-ai/sdk';
import { SAMPLE_STUDENTS } from '@/lib/data';
import { SCHOOLS } from '@/lib/schools';
import {
  profileAssessmentSubmissionSchema, profileAssessmentJsonSchema,
  narrativeOutputSchema, narrativeOutputJsonSchema,
} from '@/lib/admissions/assessment';
import { runEngine } from '@/lib/admissions/engine';
import {
  ASSESSMENT_SYSTEM_PROMPT, NARRATIVE_SYSTEM_PROMPT,
  buildAssessmentPrompt, buildNarrativePrompt,
} from '@/lib/prompts';

const MODEL = 'claude-sonnet-5';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callStructured(system: string, prompt: string, toolName: string, inputSchema: Record<string, unknown>, maxTokens: number) {
  const stream = client.beta.messages.stream({
    model: MODEL, max_tokens: maxTokens, system,
    betas: ['structured-outputs-2025-11-13'],
    messages: [{ role: 'user', content: prompt }],
    tools: [{ name: toolName, description: toolName, input_schema: inputSchema as never, strict: true }],
    tool_choice: { type: 'tool', name: toolName },
  });
  const msg = await stream.finalMessage();
  const block = msg.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('no tool_use block');
  return block.input;
}

async function main() {
  const student = SAMPLE_STUDENTS.find(s => s.name.includes('Ethan')) ?? SAMPLE_STUDENTS[0];
  console.log(`Student: ${student.name} (${student.id}), major: ${student.major}, SAT: ${student.sat}`);

  console.log('\n[1/3] Assessment call…');
  const t0 = Date.now();
  const rawAssessment = await callStructured(
    ASSESSMENT_SYSTEM_PROMPT, buildAssessmentPrompt(student),
    'submit_assessment', profileAssessmentJsonSchema(), 12000,
  );
  const assessment = profileAssessmentSubmissionSchema.parse(rawAssessment);
  console.log(`    ok in ${((Date.now() - t0) / 1000).toFixed(1)}s — confidence: ${assessment.assessment_confidence}, spike: ${assessment.spike.has_spike} (${assessment.spike.domain})`);
  for (const [k, d] of Object.entries(assessment.dimensions)) {
    console.log(`    ${k.padEnd(30)} ${d.tier.padEnd(12)} ${d.verifiability.padEnd(22)} conf=${d.confidence}`);
  }

  console.log('\n[2/3] Deterministic engine…');
  const engine = runEngine(student, assessment, SCHOOLS);
  console.log(`    evaluated ${engine.evaluations.length} schools, selected ${engine.selected.length}`);
  for (const ev of engine.selected) {
    console.log(`    ${ev.short.padEnd(16)} ${ev.uiBucket.padEnd(7)} ${ev.tierLabel.padEnd(12)} ${String(ev.band.min).padStart(2)}–${ev.band.max}%  base=${ev.baseRateUsed.pct}% (${ev.baseRateUsed.scope})  dataConf=${ev.dataConfidence} flags=[${ev.flags.join(',')}]`);
  }
  const p = engine.portfolio;
  console.log(`    P(≥1): ${p.pAtLeastOne.lowerPct}–${p.pAtLeastOne.upperPct}%  shutout=${p.shutoutRisk}  warnings=[${p.warnings.join(',')}]`);
  console.log(`    levels: T10=${p.competitivenessLevels.top10} T20=${p.competitivenessLevels.top20} T50=${p.competitivenessLevels.top50}`);

  console.log('\n[3/3] Narrative call…');
  const t1 = Date.now();
  const rawNarrative = await callStructured(
    NARRATIVE_SYSTEM_PROMPT, buildNarrativePrompt(student, assessment, engine),
    'submit_report', narrativeOutputJsonSchema(), 20000,
  );
  const narrative = narrativeOutputSchema.parse(rawNarrative);
  console.log(`    ok in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log(`    positioning: ${narrative.positioning.type}`);
  console.log(`    school notes: ${narrative.school_notes.length} (selected: ${engine.selected.length})`);
  const missingNotes = engine.selected.filter(ev => !narrative.school_notes.some(n => n.school.toLowerCase() === ev.short.toLowerCase()));
  console.log(`    missing notes for: ${missingNotes.map(m => m.short).join(', ') || 'none'}`);
  console.log(`    ed_ea: ${narrative.ed_ea_strategy.slice(0, 160)}…`);
  console.log(`    levers: ${narrative.levers.map(l => `${l.action.slice(0, 50)} [${l.dimension}]`).join(' | ')}`);
  console.log(`    plan months: ${narrative.plan.map(pl => pl.month).join(', ')}`);

  // Guardrail: narrative must not contain invented percentages beyond quoted bands
  const inventedPp = JSON.stringify(narrative).match(/\+\d+\s*pp/gi);
  console.log(`\n    invented "+Npp" claims: ${inventedPp ? inventedPp.join(', ') : 'none ✓'}`);
  console.log('\nPIPELINE OK');
}

main().catch(e => { console.error('PIPELINE FAILED:', e.message ?? e); process.exit(1); });



