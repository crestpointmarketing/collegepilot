'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Search, X, Plus, CalendarDays, Banknote, GraduationCap, Users, TrendingUp, BookOpen, Lightbulb } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageHeader, PrimaryButton, AlertCard } from '@/components/ui';
import { fitScore, tierFor } from '@/lib/schools';
import { TierBadge } from '@/components/shared/TierBadge';
import { FitBar } from '@/components/shared/FitBar';
import { PortfolioPanel } from '@/components/portfolio/PortfolioPanel';
import type { School, SchoolEntry, Strategy } from '@/types';

const ALL_REGIONS = ['West', 'East', 'Midwest', 'South'] as const;
const ALL_SIZES = ['Small', 'Medium', 'Large'] as const;
const ALL_TYPES = ['Public', 'Private'] as const;
const ALL_SETTINGS = ['Urban', 'Suburban', 'Rural'] as const;
const ALL_VIBES = ['Research', 'Quant', 'Builder'];

function ChipBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-pill text-[12.5px] font-medium border transition-all duration-100 ${
        active
          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
          : 'bg-white text-[var(--ink-soft)] border-[var(--line-strong)] hover:bg-[var(--bg-soft)]'
      }`}
    >
      {label}
    </button>
  );
}

export default function SchoolsPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, schools, strategies, saveStrategy, saveStudentDraft } = useApp();
  const activeStudent = students.find(s => s.id === studentId) ?? null;
  const currentStrategy = strategies[studentId] ?? null;
  const [saveMessage, setSaveMessage] = useState('');
  const [togglingAttend, setTogglingAttend] = useState(false);

  // Acceptability test: mark a school the student would NOT actually attend.
  const handleToggleAttend = async (schoolId: string) => {
    if (!activeStudent || togglingAttend) return;
    const current = activeStudent.notAttendIds ?? [];
    const next = current.includes(schoolId) ? current.filter(id => id !== schoolId) : [...current, schoolId];
    setTogglingAttend(true);
    try {
      await saveStudentDraft({ ...activeStudent, notAttendIds: next });
    } finally {
      setTogglingAttend(false);
    }
  };

  // Fit scores are only meaningful against the real student's numbers
  const profile = {
    gpa: activeStudent?.gpa ?? '',
    sat: activeStudent?.sat ?? '',
    major: activeStudent?.major ?? '',
  };

  const [pendingFilters, setPendingFilters] = useState({
    type: [] as string[],
    size: [] as string[],
    regions: [] as string[],
    settings: [] as string[],
    vibes: [] as string[],
    topRanked: false,
    majorQuery: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(pendingFilters);
  const [sortKey, setSortKey] = useState<'fit' | 'ranking' | 'accept'>('fit');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerSchool, setDrawerSchool] = useState<School | null>(null);

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const pf = pendingFilters;
  const setPf = (patch: Partial<typeof pendingFilters>) =>
    setPendingFilters(prev => ({ ...prev, ...patch }));

  const filtered = useMemo(() => {
    let list = [...schools];
    const f = appliedFilters;
    if (f.type.length) list = list.filter(s => f.type.includes(s.type));
    if (f.size.length) list = list.filter(s => f.size.includes(s.size));
    if (f.regions.length) list = list.filter(s => f.regions.includes(s.region));
    if (f.settings.length) list = list.filter(s => f.settings.includes(s.setting));
    if (f.vibes.length) list = list.filter(s => f.vibes.some(v => s.vibe.includes(v)));
    if (f.topRanked) list = list.filter(s => s.topRanked);
    if (f.majorQuery) list = list.filter(s => s.majors.some(m => m.toLowerCase().includes(f.majorQuery.toLowerCase())));
    return list;
  }, [appliedFilters, schools]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === 'fit') return fitScore(b, profile.gpa, profile.sat) - fitScore(a, profile.gpa, profile.sat);
      if (sortKey === 'ranking') return a.ranking - b.ranking;
      if (sortKey === 'accept') return a.accept - b.accept;
      return 0;
    });
  }, [filtered, sortKey, profile.gpa, profile.sat]);

  const handleAddToStrategy = (ids: Set<string>) => {
    if (!currentStrategy || !activeStudent || ids.size === 0) return;

    const next: Strategy = {
      ...currentStrategy,
      schools: {
        reach: [...currentStrategy.schools.reach],
        match: [...currentStrategy.schools.match],
        safety: [...currentStrategy.schools.safety],
      },
    };

    const existing = new Set([
      ...next.schools.reach,
      ...next.schools.match,
      ...next.schools.safety,
    ].map(s => s.name.toLowerCase()));

    let added = 0;
    for (const id of ids) {
      const school = schools.find(s => s.id === id);
      if (!school || existing.has(school.name.toLowerCase())) continue;
      const scoreTier = tierFor(school, profile.gpa, profile.sat);
      // No heuristic percentage here — the AI strategy model is the single
      // source of calibrated probabilities; regenerating fills this in.
      const entry: SchoolEntry = {
        name: school.name,
        chance: '—',
        note: `${scoreTier} fit based on ${activeStudent.name}'s GPA/SAT profile and ${school.majors.slice(0, 2).join(', ')} program fit. Regenerate the strategy for a calibrated admit estimate.`,
      };
      if (scoreTier === 'Reach') next.schools.reach.push(entry);
      if (scoreTier === 'Match') next.schools.match.push(entry);
      if (scoreTier === 'Safety') next.schools.safety.push(entry);
      existing.add(school.name.toLowerCase());
      added += 1;
    }

    if (added === 0) {
      setSaveMessage('Selected schools are already in the strategy.');
      return;
    }

    setSelected(new Set());
    setSaveMessage('Saving…');
    void saveStrategy(studentId, next).then(ok => {
      setSaveMessage(ok
        ? `${added} school${added === 1 ? '' : 's'} added to strategy.`
        : 'Failed to save — your changes may not persist. Check your connection and try again.');
    });
  };

  if (!activeStudent) return <div className="text-[var(--muted)]">Student not found.</div>;

  const v2 = currentStrategy?.v2 ?? null;

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      {/* Portfolio analysis of the student's own list (when a v2 strategy exists) */}
      {v2 && (
        <PortfolioPanel
          student={activeStudent}
          v2={v2}
          saving={togglingAttend}
          onToggleAttend={handleToggleAttend}
        />
      )}

      <PageHeader
        title="Find Your Best-Fit Schools"
        sub={`Showing fit scores for ${activeStudent.name}`}
        actions={
          selected.size > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-[13.5px] text-[var(--muted)]">{selected.size} selected</span>
              <PrimaryButton onClick={() => handleAddToStrategy(selected)} className={!currentStrategy ? 'opacity-50 pointer-events-none' : ''}>
                <Plus size={14} /> Add to Strategy
              </PrimaryButton>
            </div>
          ) : undefined
        }
      />
      {saveMessage && (
        <div className="mb-4"><AlertCard tone="neutral" title="Update" body={saveMessage} /></div>
      )}
      {!currentStrategy && (
        <div className="mb-4"><AlertCard tone="warning" title="No strategy yet" body="Generate a strategy before adding schools to the strategy list." /></div>
      )}

      <div className="flex gap-6">
        {/* Filter panel */}
        <aside className="w-[280px] shrink-0 sticky top-4 self-start">
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <FilterSection title="School Type">
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map(t => (
                  <ChipBtn key={t} label={t} active={pf.type.includes(t)} onClick={() => setPf({ type: toggle(pf.type, t) })} />
                ))}
              </div>
              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase text-[var(--muted)] mb-1.5">Size</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SIZES.map(s => (
                    <ChipBtn key={s} label={s} active={pf.size.includes(s)} onClick={() => setPf({ size: toggle(pf.size, s) })} />
                  ))}
                </div>
              </div>
            </FilterSection>

            <FilterSection title="Region">
              <div className="flex flex-wrap gap-1.5">
                {ALL_REGIONS.map(r => (
                  <ChipBtn key={r} label={r} active={pf.regions.includes(r)} onClick={() => setPf({ regions: toggle(pf.regions, r) })} />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Setting">
              <div className="flex flex-wrap gap-1.5">
                {ALL_SETTINGS.map(s => (
                  <ChipBtn key={s} label={s} active={pf.settings.includes(s)} onClick={() => setPf({ settings: toggle(pf.settings, s) })} />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Program Strength">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--line-strong)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. Computer Science"
                  value={pf.majorQuery}
                  onChange={e => setPf({ majorQuery: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pf.topRanked}
                  onChange={e => setPf({ topRanked: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[13px] text-[var(--ink-soft)]">Top-ranked programs only</span>
              </label>
            </FilterSection>

            <FilterSection title="Vibe">
              <div className="flex flex-wrap gap-1.5">
                {ALL_VIBES.map(v => (
                  <ChipBtn key={v} label={v} active={pf.vibes.includes(v)} onClick={() => setPf({ vibes: toggle(pf.vibes, v) })} />
                ))}
              </div>
            </FilterSection>

            <div className="p-4 flex gap-2">
              <button
                onClick={() => {
                  const reset = { type: [], size: [], regions: [], settings: [], vibes: [], topRanked: false, majorQuery: '' };
                  setPendingFilters(reset);
                  setAppliedFilters(reset);
                }}
                className="flex-1 py-2 rounded-lg border border-[var(--line-strong)] text-[13px] font-medium text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setAppliedFilters(pendingFilters)}
                className="flex-1 py-2 rounded-lg text-white text-[13px] font-medium transition-colors"
                style={{ background: 'var(--accent)' }}
              >
                Apply
              </button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-[var(--muted)]">
              {sorted.length} school{sorted.length !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-1 bg-white border border-[var(--line)] rounded-lg p-1 shadow-card">
              {([['fit', 'Fit Score'], ['ranking', 'Ranking'], ['accept', 'Acceptance Rate']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`px-3 py-1 rounded-lg text-[12.5px] font-medium transition-all ${
                    sortKey === key ? 'bg-[var(--accent-50)] text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {sorted.map(school => {
              const score = fitScore(school, profile.gpa, profile.sat);
              const tier = tierFor(school, profile.gpa, profile.sat);
              const isSelected = selected.has(school.id);
              return (
                <div
                  key={school.id}
                  className={`bg-white rounded-card shadow-card p-4 border transition-all ${
                    isSelected ? 'border-[var(--accent)] shadow-focus' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(school.id)) {
                          next.delete(school.id);
                        } else {
                          next.add(school.id);
                        }
                        setSelected(next);
                      }}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[15px] font-semibold text-[var(--ink)]">#{school.ranking} {school.name}</span>
                        <TierBadge tier={tier} />
                      </div>
                      <div className="text-[12.5px] text-[var(--muted)] mb-3">
                        {school.city}, {school.state} · {school.type} · {school.size}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCell label="Accept Rate" value={`${school.accept}%`} />
                        <StatCell label="Avg SAT" value={school.sat.toString()} />
                        <StatCell label="Top Majors" value={school.majors.slice(0, 2).join(', ')} />
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1.5">AI Fit</div>
                          <FitBar score={score} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setDrawerSchool(school)}
                        className="px-3 py-1.5 rounded-lg border border-[var(--line-strong)] text-[12.5px] font-medium text-[var(--ink)] bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card whitespace-nowrap"
                      >
                        View details
                      </button>
                      <button
                        onClick={() => {
                          const next = new Set(selected);
                          next.add(school.id);
                          setSelected(next);
                        }}
                        className="px-3 py-1.5 rounded-lg text-white text-[12.5px] font-medium transition-colors whitespace-nowrap"
                        style={{ background: 'var(--accent)' }}
                      >
                        + Add to list
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {drawerSchool && (
        <SchoolDrawer
          school={drawerSchool}
          profile={profile}
          onClose={() => setDrawerSchool(null)}
          onAdd={() => {
            const next = new Set([drawerSchool.id]);
            handleAddToStrategy(next);
            setDrawerSchool(null);
          }}
        />
      )}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 border-b border-[var(--line)]">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{label}</div>
      <div className="text-[13.5px] font-medium text-[var(--ink)] tabular-nums">{value}</div>
    </div>
  );
}

function DrawerSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="text-[12.5px] font-semibold uppercase tracking-widest text-[var(--ink-soft)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function SchoolDrawer({ school, profile, onClose, onAdd }: {
  school: School;
  profile: { gpa: string; sat: string; major: string };
  onClose: () => void;
  onAdd: () => void;
}) {
  const score = fitScore(school, profile.gpa, profile.sat);
  const tier = tierFor(school, profile.gpa, profile.sat);

  const deadlines = [
    school.edDeadline && { label: 'ED', value: school.edDeadline },
    school.eaDeadline && { label: 'EA', value: school.eaDeadline },
    school.rdDeadline && { label: 'RD', value: school.rdDeadline },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 animate-fade-in"
        onClick={onClose}
        style={{ backdropFilter: 'blur(2px)' }}
      />
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[560px] z-50 bg-white shadow-drawer flex flex-col animate-slide-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--line)] shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">School Detail</div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-semibold text-[var(--ink)] leading-tight">{school.name}</h2>
              <div className="text-[13px] text-[var(--muted)] mt-0.5">
                {school.city}, {school.state} · {school.type} · #{school.ranking} national · {school.setting}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 shrink-0">
              <TierBadge tier={tier} />
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg-soft)]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[var(--bg-soft)] rounded-card">
            <StatCell label="Accept Rate" value={`${school.accept}%`} />
            <StatCell label="Avg SAT" value={school.sat.toString()} />
            <StatCell label="Avg GPA" value={school.gpa.toFixed(2)} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1.5">AI Fit</div>
              <FitBar score={score} />
            </div>
          </div>

          {/* Programs */}
          <DrawerSection icon={<BookOpen size={15} />} title="Programs & Highlights">
            <div className="flex flex-wrap gap-1.5">
              {school.majors.map(m => (
                <span key={m} className="px-2.5 py-1 bg-[var(--bg-soft)] border border-[var(--line)] rounded-lg text-[12px] text-[var(--ink-soft)]">{m}</span>
              ))}
            </div>
            {school.highlights && school.highlights.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {school.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-[var(--ink-soft)] leading-relaxed">
                    <span className="text-[var(--accent)] font-bold mt-0.5 shrink-0">·</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </DrawerSection>

          {/* Culture */}
          {school.culture && (
            <DrawerSection icon={<Users size={15} />} title="Campus Culture">
              <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">{school.culture}</p>
            </DrawerSection>
          )}

          {/* Why it's a fit + angle */}
          <DrawerSection icon={<Lightbulb size={15} />} title="Fit Analysis">
            <div className="flex flex-col gap-2">
              <div className="p-3.5 rounded-card bg-[var(--accent-50)] border border-[var(--accent-100,#e0e7ff)]">
                <div className="text-[11px] font-semibold text-[var(--accent)] mb-1">Why it&apos;s a fit</div>
                <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{school.why}</p>
              </div>
              <div className="p-3.5 rounded-card bg-[var(--accent-50)] border border-[var(--accent-100,#e0e7ff)]">
                <div className="text-[11px] font-semibold text-[var(--accent)] mb-1">Positioning angle</div>
                <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{school.angle}</p>
              </div>
            </div>
          </DrawerSection>

          {/* Admission tips */}
          {school.admissionTips && school.admissionTips.length > 0 && (
            <DrawerSection icon={<TrendingUp size={15} />} title="Admission Strategy">
              <ul className="flex flex-col gap-2">
                {school.admissionTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-soft)] leading-relaxed">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}

          {/* Financial aid */}
          {school.financialAid && (
            <DrawerSection icon={<Banknote size={15} />} title="Financial Aid">
              <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{school.financialAid}</p>
            </DrawerSection>
          )}

          {/* Deadlines */}
          {deadlines.length > 0 && (
            <DrawerSection icon={<CalendarDays size={15} />} title="Application Deadlines">
              <div className="flex flex-wrap gap-2">
                {deadlines.map(d => (
                  <div key={d.label} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-soft)] border border-[var(--line)] rounded-lg">
                    <span className="text-[11px] font-bold text-[var(--accent)] uppercase">{d.label}</span>
                    <span className="text-[12.5px] text-[var(--ink-soft)]">{d.value}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {/* Career outcomes */}
          {school.careerOutcomes && (
            <DrawerSection icon={<GraduationCap size={15} />} title="Career Outcomes">
              <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{school.careerOutcomes}</p>
            </DrawerSection>
          )}

          {/* Notable alumni */}
          {school.notableAlumni && school.notableAlumni.length > 0 && (
            <DrawerSection icon={<Users size={15} />} title="Notable Alumni">
              <div className="flex flex-wrap gap-1.5">
                {school.notableAlumni.map(a => (
                  <span key={a} className="px-2.5 py-1 bg-[var(--bg-soft)] border border-[var(--line)] rounded-lg text-[12px] text-[var(--ink-soft)]">{a}</span>
                ))}
              </div>
            </DrawerSection>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--line)] flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-[var(--line-strong)] text-[13.5px] font-medium text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors"
          >
            Close
          </button>
          <button
            onClick={onAdd}
            className="flex-1 py-2 rounded-lg text-white text-[13.5px] font-medium transition-colors"
            style={{ background: 'var(--accent)' }}
          >
            + Add to List
          </button>
        </div>
      </div>
    </>
  );
}
