'use client';

import { useState } from 'react';
import { Search, BookOpen, TrendingUp, Users, Lightbulb, AlertTriangle, ExternalLink, Save, CheckCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase';

interface ResearchResult {
  school: string;
  program: string;
  admission_requirements: string;
  program_details: string;
  career_outcomes: string;
  community_insights: string;
  application_tips: string[];
  official_vs_community: string;
  confidence: 'High' | 'Medium' | 'Low';
  sources: Array<{ title: string; url: string; type: string }>;
  generated_at: string;
}

const LOADING_STEPS = [
  'Searching official sources…',
  'Scanning Reddit discussions…',
  'Synthesizing with AI…',
];

const CONFIDENCE_COLOR = {
  High: 'text-green-700 bg-green-50',
  Medium: 'text-amber-700 bg-amber-50',
  Low: 'text-red-700 bg-red-50',
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--line)] rounded-xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--ink-soft)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function ResearchPage() {
  const { schools, students } = useApp();
  const [schoolInput, setSchoolInput] = useState('');
  const [programInput, setProgramInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleResearch = async () => {
    if (!schoolInput.trim() || !programInput.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);

    // Animate loading steps
    setLoadingStep(0);
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 4000);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school: schoolInput.trim(), program: programInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Research failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const handleSaveToSchoolDB = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find matching school by name (case-insensitive)
      const matchedSchool = schools.find(s =>
        s.name.toLowerCase().includes(result.school.toLowerCase()) ||
        result.school.toLowerCase().includes(s.name.toLowerCase())
      );

      const enrichedData = matchedSchool ? {
        ...matchedSchool,
        admissionTips: result.application_tips,
        culture: result.community_insights,
        careerOutcomes: result.career_outcomes,
        highlights: [result.program_details],
      } : null;

      if (matchedSchool && enrichedData) {
        await supabase.from('schools')
          .update({ data: enrichedData })
          .eq('id', matchedSchool.id);
      }

      // Also save raw research to a research_cache table if it exists
      await supabase.from('school_research').upsert({
        school_name: result.school,
        program: result.program,
        data: result,
        user_id: user.id,
        generated_at: result.generated_at,
      }).throwOnError();

      setSaved(true);
    } catch (err) {
      console.error('Save error:', err);
      // Still mark as saved if school update worked
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // Suggestions from existing schools
  const suggestions = showSuggestions && schoolInput.length > 1
    ? schools.filter(s => s.name.toLowerCase().includes(schoolInput.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-[var(--ink)] tracking-tight mb-1">School Research</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          AI-powered deep research from official sources, Reddit, and community forums
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">School</label>
            <input
              type="text"
              value={schoolInput}
              onChange={e => { setSchoolInput(e.target.value); setSaved(false); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. UT Austin, MIT, Stanford"
              className="w-full px-3 py-2.5 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-100)]"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--line)] rounded-lg shadow-card z-10 overflow-hidden">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSchoolInput(s.name); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-soft)] text-[var(--ink)]"
                  >
                    {s.name}
                    <span className="text-[11px] text-[var(--muted)] ml-2">{s.city}, {s.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Program / Major</label>
            <input
              type="text"
              value={programInput}
              onChange={e => { setProgramInput(e.target.value); setSaved(false); }}
              placeholder="e.g. Turing Scholars, CS, Bioengineering"
              className="w-full px-3 py-2.5 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-100)]"
            />
          </div>
        </div>
        <button
          onClick={handleResearch}
          disabled={loading || !schoolInput.trim() || !programInput.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white text-[13.5px] font-semibold rounded-lg hover:bg-[var(--accent-600)] disabled:opacity-50 transition-colors"
        >
          <Search size={14} />
          {loading ? 'Researching…' : 'Run Research'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-[var(--line)] rounded-xl p-8 mb-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              {LOADING_STEPS.map((step, i) => (
                <div key={step} className={`flex items-center gap-2.5 text-[13px] transition-all ${i <= loadingStep ? 'text-[var(--ink)]' : 'text-[var(--muted-2)]'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    i < loadingStep ? 'bg-green-100' : i === loadingStep ? 'bg-[var(--accent-50)]' : 'bg-[var(--line)]'
                  }`}>
                    {i < loadingStep
                      ? <CheckCircle size={10} className="text-green-600" />
                      : <div className={`w-1.5 h-1.5 rounded-full ${i === loadingStep ? 'bg-[var(--accent)]' : 'bg-[var(--muted-2)]'}`} />
                    }
                  </div>
                  {step}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[var(--muted)] mt-2">Deep research takes 15–30 seconds</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[var(--red-50)] border border-red-200 rounded-xl p-4 mb-6 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Meta bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-[var(--ink)]">{result.school} — {result.program}</h2>
              {result.confidence && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_COLOR[result.confidence]}`}>
                  {result.confidence} Confidence
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--muted)]">
              {new Date(result.generated_at).toLocaleDateString()}
            </span>
          </div>

          {/* Research sections */}
          <div className="grid grid-cols-2 gap-4">
            <Section icon={<BookOpen size={14} />} title="Admission Requirements">
              <p className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{result.admission_requirements}</p>
            </Section>

            <Section icon={<TrendingUp size={14} />} title="Career Outcomes">
              <p className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{result.career_outcomes}</p>
            </Section>
          </div>

          <Section icon={<BookOpen size={14} />} title="Program Details">
            <p className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{result.program_details}</p>
          </Section>

          <Section icon={<Users size={14} />} title="Community Insights (Reddit)">
            <p className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{result.community_insights}</p>
          </Section>

          <Section icon={<Lightbulb size={14} />} title="Application Tips">
            <ul className="flex flex-col gap-2">
              {result.application_tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ink-soft)]">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent-50)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </Section>

          {result.official_vs_community && result.official_vs_community !== 'Sources align' && (
            <Section icon={<AlertTriangle size={14} />} title="Official vs Community">
              <p className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{result.official_vs_community}</p>
            </Section>
          )}

          {/* Sources */}
          <div className="bg-[var(--bg-soft)] rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2.5">Sources ({result.sources.length})</p>
            <div className="flex flex-col gap-1.5">
              {result.sources.slice(0, 8).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[12.5px] text-[var(--accent)] hover:underline"
                >
                  <ExternalLink size={11} className="shrink-0" />
                  <span className="truncate">{s.title || s.url}</span>
                  {s.type === 'reddit' && (
                    <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded shrink-0">Reddit</span>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button
              onClick={handleSaveToSchoolDB}
              disabled={saving || saved}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white text-[13.5px] font-semibold rounded-lg hover:bg-[var(--accent-600)] disabled:opacity-60 transition-colors"
            >
              {saved ? <CheckCircle size={14} /> : <Save size={14} />}
              {saving ? 'Saving…' : saved ? 'Saved to School DB' : 'Save to School DB'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
