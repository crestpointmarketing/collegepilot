'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ScrollText, Sparkles, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BlueprintDocument } from '@/components/blueprint/BlueprintDocument';
import type { Blueprint } from '@/lib/admissions/blueprint';

const LOADING_STEPS = [
  'Reading the profile and computed assessment',
  'Designing the core identity and distinctive capability',
  'Building the operating system and brand DNA',
  'Positioning against the applicant archetype',
  'Drafting the future-self direction',
  'Collecting the master claim register',
];

/** Strip control chars inside strings + trailing commas (mirrors strategy page). */
function repairJson(input: string): string {
  let inString = false;
  let escaped = false;
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === '\\' && inString) { out += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; out += c; continue; }
    if (inString && (c === '\n' || c === '\r')) { out += ' '; continue; }
    if (inString && c === '\t') { out += ' '; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function isBlueprint(v: unknown): v is Blueprint {
  return !!v && typeof v === 'object' && (v as Blueprint).version === 1 && !!(v as Blueprint).identity;
}

export default function BlueprintPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, blueprints, strategies, saveBlueprint } = useApp();
  const student = students.find(s => s.id === studentId);
  const blueprint = blueprints[studentId] ?? null;
  const hasStrategy = !!strategies[studentId]?.v2?.assessment;

  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!student || generating) return;
    setGenerating(true);
    setGenError(null);
    setLoadingStep(0);
    const stepTimer = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 9000);
    try {
      const res = await fetch('/api/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Invalid response from server${fullText.trim() ? `: ${fullText.trim().slice(0, 240)}` : ''}`);
      }
      const raw: unknown = JSON.parse(repairJson(jsonMatch[0]));
      if (raw && typeof raw === 'object' && 'error' in raw) {
        throw new Error(String((raw as { error: unknown }).error));
      }
      if (!isBlueprint(raw)) {
        throw new Error('The AI returned an incomplete Blueprint. Please regenerate.');
      }
      const savedOk = await saveBlueprint(studentId, raw);
      if (!savedOk) {
        setGenError('The Blueprint was generated and saved on the server, but this window could not sync its local copy. Reload the page to pick it up.');
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Blueprint generation failed.');
    } finally {
      clearInterval(stepTimer);
      setGenerating(false);
    }
  }

  if (!student) {
    return <div className="animate-fade-in text-[var(--muted)]">Student not found.</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">Blueprint</h1>
          <p className="text-[var(--muted)] mt-1">Designing the person before designing the application — an evidence-labeled strategy book.</p>
        </div>
        {blueprint && !generating && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--line-strong)] text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors"
          >
            <RefreshCw size={14} /> Regenerate
          </button>
        )}
      </div>

      {genError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-700">{genError}</p>
        </div>
      )}

      {generating ? (
        <div className="bg-white rounded-card shadow-card px-8 py-10">
          <div className="flex items-center gap-2.5 mb-6">
            <Loader2 size={18} className="text-[var(--accent)] animate-spin" />
            <span className="text-[15px] font-semibold text-[var(--ink)]">Designing the Blueprint…</span>
          </div>
          <div className="flex flex-col gap-2.5 max-w-md">
            {LOADING_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {i < loadingStep
                  ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  : i === loadingStep
                    ? <Loader2 size={16} className="text-[var(--accent)] animate-spin shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-[var(--line-strong)] shrink-0" />}
                <span className={`text-[13px] ${i <= loadingStep ? 'text-[var(--ink)]' : 'text-[var(--muted-2)]'}`}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : blueprint ? (
        <BlueprintDocument blueprint={blueprint} />
      ) : (
        <div className="bg-white rounded-card shadow-card px-8 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-4" style={{ color: 'var(--accent)' }}>
            <ScrollText size={26} />
          </div>
          <h2 className="text-[19px] font-semibold text-[var(--ink)]">Generate {student.name.split(' ')[0]}&apos;s Blueprint</h2>
          <p className="text-[14px] text-[var(--muted)] mt-2 max-w-md mx-auto leading-relaxed">
            An identity-first strategy book: core identity, positioning against the applicant archetype, and future direction — every claim carries an evidence label, nothing is invented.
          </p>
          <p className="text-[12.5px] text-[var(--muted-2)] mt-2">
            {hasStrategy
              ? 'Reuses the assessment from the generated strategy — no re-grading.'
              : 'A strategy has not been generated yet; the Blueprint will run its own profile assessment first.'}
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg text-white text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Sparkles size={16} /> Generate Blueprint
          </button>
        </div>
      )}
    </div>
  );
}
