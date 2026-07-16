'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Student, Strategy, Tweaks, School } from '@/types';
import { SAMPLE_STUDENTS, INITIAL_STRATEGIES, TWEAK_DEFAULTS, ACCENT_PALETTES } from '@/lib/data';
import { SCHOOLS } from '@/lib/schools';
import { createClient } from '@/lib/supabase';
import { strategySchema } from '@/lib/schemas';

interface AppContextValue {
  students: Student[];
  schools: School[];
  strategies: Record<string, Strategy>;
  tweaks: Tweaks;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  loading: boolean;
  loadError: string | null;
  user: User | null;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  saveStudent: (data: Student) => Promise<boolean>;
  saveStudentDraft: (data: Student) => Promise<boolean>;
  seedSampleStudents: () => Promise<void>;
  deleteStudent: (studentId: string) => Promise<boolean>;
  saveStrategy: (studentId: string, strategy: Strategy) => Promise<boolean>;
  markDocumentReady: (studentId: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
// Accounts that always receive the full sample-student roster (owner + shared demo/QA login).
const FULL_SEED_ACCOUNTS = ['vivianxie30@gmail.com', 'demo@gmail.com'];

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function isUnmodifiedSampleStudent(student: Student) {
  const sample = SAMPLE_STUDENTS.find(s => s.id === student.id);
  if (!sample) return false;
  return stableStringify(student) === stableStringify(sample);
}

// Sample rows may already exist in Supabase when new transcript fields ship.
// Fill only absent fields so a user's explicit edits (including cleared arrays) win.
function mergeMissingSampleTranscriptFields(student: Student): Student {
  const sample = SAMPLE_STUDENTS.find(s => s.id === student.id);
  if (!sample) return student;
  const merged = { ...student };
  if (merged.classRank === undefined && sample.classRank !== undefined) merged.classRank = sample.classRank;
  if (merged.graduationProgram === undefined && sample.graduationProgram !== undefined) merged.graduationProgram = sample.graduationProgram;
  if (merged.endorsements === undefined && sample.endorsements !== undefined) merged.endorsements = sample.endorsements;
  if (merged.stateAssessments === undefined && sample.stateAssessments !== undefined) merged.stateAssessments = sample.stateAssessments;
  if (merged.performanceAcknowledgements === undefined && sample.performanceAcknowledgements !== undefined) {
    merged.performanceAcknowledgements = sample.performanceAcknowledgements;
  }
  return merged;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools] = useState<School[]>(SCHOOLS);
  const [strategies, setStrategies] = useState<Record<string, Strategy>>({});
  const [tweaks, setTweaks] = useState<Tweaks>(() => {
    if (typeof window === 'undefined') return TWEAK_DEFAULTS;
    try {
      const saved = localStorage.getItem('ase:tweaks');
      return saved ? { ...TWEAK_DEFAULTS, ...JSON.parse(saved) } : TWEAK_DEFAULTS;
    } catch {
      return TWEAK_DEFAULTS;
    }
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks which user's data has been loaded, so getUser() and onAuthStateChange
  // (which both fire on mount) don't each trigger a load, and token refreshes don't re-load.
  const loadedUserIdRef = useRef<string | null>(null);

  // Auth: check session immediately on mount, then watch for sign-in and sign-out
  useEffect(() => {
    let active = true;

    // Primary check — getUser() is reliable even when onAuthStateChange is slow
    supabase.auth.getUser().then(async ({ data: { user: currentUser } }) => {
      if (!active) return;
      setUser(currentUser ?? null);
      if (currentUser) {
        if (loadedUserIdRef.current !== currentUser.id) {
          loadedUserIdRef.current = currentUser.id;
          // eslint-disable-next-line react-hooks/immutability
          await loadUserData(currentUser.id, currentUser.email ?? '');
        }
      } else {
        setLoading(false);
      }
    }).catch(() => { if (active) setLoading(false); });

    // Secondary — handles sign-in after mount (the provider lives in the root layout,
    // so it mounts on the landing page before any session exists) and sign-out.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        loadedUserIdRef.current = null;
        setUser(null);
        setStudents([]);
        setStrategies({});
        setLoading(false);
      } else if (loadedUserIdRef.current !== session.user.id) {
        loadedUserIdRef.current = session.user.id;
        const signedInUser = session.user;
        // Defer Supabase calls out of the auth callback (supabase-js can deadlock
        // if queries run synchronously inside onAuthStateChange).
        setTimeout(() => {
          if (!active) return;
          setUser(signedInUser);
          void loadUserData(signedInUser.id, signedInUser.email ?? '');
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData(userId: string, email?: string) {
    setLoading(true);
    setLoadError(null);
    try {
      const [studentResult, strategyResult] = await Promise.all([
        supabase.from('students').select('data').eq('user_id', userId),
        supabase.from('strategies').select('student_id, data').eq('user_id', userId),
      ]);
      const { data: studentRows, error: studentError } = studentResult;
      const { data: strategyRows, error: strategyError } = strategyResult;

      if (studentError) throw studentError;
      if (strategyError) throw strategyError;

      let loadedStudents: Student[] = studentRows?.map(r => r.data as Student) ?? [];
      // Demo/QA and owner accounts always get the complete sample roster.
      // Only students that are missing get seeded, so edits made in the demo
      // account are preserved across logins.
      const isFullSeedAccount = FULL_SEED_ACCOUNTS.includes(email?.toLowerCase() ?? '');
      if (isFullSeedAccount) {
        const existingIds = new Set(loadedStudents.map(s => s.id));
        const missing = SAMPLE_STUDENTS.filter(s => !existingIds.has(s.id));
        if (missing.length) {
          const rows = missing.map(s => ({ id: s.id, user_id: userId, data: s, updated_at: new Date().toISOString() }));
          const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id,user_id' });
          if (error) throw error;
          loadedStudents = [...missing, ...loadedStudents];
        }

        const upgradedStudents = loadedStudents.map(mergeMissingSampleTranscriptFields);
        const changedStudents = upgradedStudents.filter((student, index) => stableStringify(student) !== stableStringify(loadedStudents[index]));
        if (changedStudents.length) {
          const rows = changedStudents.map(student => ({ id: student.id, user_id: userId, data: student, updated_at: new Date().toISOString() }));
          const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id,user_id' });
          if (error) throw error;
          loadedStudents = upgradedStudents;
        }
      }

      setStudents(loadedStudents);

      const loadedStrategies: Record<string, Strategy> = {};
      const effectiveStudents = loadedStudents;
      effectiveStudents.forEach(student => {
        if (isUnmodifiedSampleStudent(student) && INITIAL_STRATEGIES[student.id]) {
          loadedStrategies[student.id] = INITIAL_STRATEGIES[student.id];
        }
      });
      strategyRows?.forEach(r => {
        const student = effectiveStudents.find(s => s.id === r.student_id);
        const isStaleInitialStrategy =
          student &&
          !isUnmodifiedSampleStudent(student) &&
          INITIAL_STRATEGIES[r.student_id] &&
          JSON.stringify(r.data) === JSON.stringify(INITIAL_STRATEGIES[r.student_id]);
        if (student?.status === 'Strategy Generated' || student?.status === 'Document Ready') {
          const parsed = strategySchema.safeParse(r.data);
          if (!isStaleInitialStrategy && parsed.success) {
            loadedStrategies[r.student_id] = parsed.data;
          } else if (!parsed.success) {
            console.warn(`Ignoring invalid stored strategy for ${r.student_id}:`, parsed.error.issues);
          }
        }
      });
      setStrategies(loadedStrategies);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  }

  // Persist tweaks to localStorage + apply accent CSS vars
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('ase:tweaks', JSON.stringify(tweaks));
    const p = ACCENT_PALETTES[tweaks.accent] || ACCENT_PALETTES.indigo;
    const root = document.documentElement;
    root.style.setProperty('--accent', p.accent);
    root.style.setProperty('--accent-600', p['accent-600']);
    root.style.setProperty('--accent-50', p['accent-50']);
    root.style.setProperty('--accent-100', p['accent-100']);
  }, [tweaks]);

  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    setTweaks(prev => ({ ...prev, [key]: value }));
  };

  // Reflects the real outcome of the last write — 'error' persists until the next attempt.
  const finishSave = (ok: boolean) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState(ok ? 'saved' : 'error');
    if (ok) saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1800);
  };

  const persistStudent = async (data: Student, invalidateStrategy: boolean): Promise<boolean> => {
    if (!user) {
      setSaveState('error');
      return false;
    }
    const id = data.id || `s${Date.now()}`;
    const palette = ['#6366f1', '#ec4899', '#0891b2', '#7c3aed', '#059669', '#d97706'];
    const updated: Student = {
      ...data,
      id,
      color: data.color || palette[students.length % palette.length],
      updated: 'Just now',
      status: data.status || 'Draft',
    };
    setSaveState('saving');
    setStudents(prev => {
      const exists = prev.find(s => s.id === id);
      return exists ? prev.map(s => s.id === id ? { ...s, ...updated } : s) : [updated, ...prev];
    });
    if (invalidateStrategy) {
      setStrategies(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    const { error } = await supabase.from('students')
      .upsert({ id, user_id: user.id, data: updated, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' });
    if (error) console.error('saveStudent error:', error);
    let ok = !error;
    if (ok && invalidateStrategy) {
      const { error: strategyError } = await supabase.from('strategies')
        .delete().eq('student_id', id).eq('user_id', user.id);
      if (strategyError) {
        console.error('invalidateStrategy error:', strategyError);
        ok = false;
      }
    }
    finishSave(ok);
    return ok;
  };

  // Full save: profile changed in a way that makes any generated strategy stale.
  const saveStudent = (data: Student) => persistStudent(data, true);

  // Draft autosave: persist edits without discarding an existing strategy.
  const saveStudentDraft = (data: Student) => persistStudent(data, false);

  const seedSampleStudents = async () => {
    if (!user) {
      setLoadError('Your session has expired. Refresh the page and sign in again.');
      return;
    }
    setLoadError(null);
    setSaveState('saving');
    const rows = SAMPLE_STUDENTS.map(s => ({ id: s.id, user_id: user.id, data: s }));
    const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id,user_id' });
    if (error) {
      console.error('seedSampleStudents error:', error);
      setLoadError(error.message);
      setSaveState('idle');
      return;
    }
    setStudents(prev => {
      const existingIds = new Set(prev.map(student => student.id));
      return [...SAMPLE_STUDENTS.filter(student => !existingIds.has(student.id)), ...prev];
    });
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  const deleteStudent = async (studentId: string): Promise<boolean> => {
    if (!user) {
      setSaveState('error');
      return false;
    }
    setSaveState('saving');
    const { error } = await supabase.from('students').delete().eq('id', studentId).eq('user_id', user.id);
    if (error) {
      console.error('deleteStudent error:', error);
      finishSave(false);
      return false;
    }
    // Deployed schemas use ON DELETE CASCADE. Keep this cleanup for older installations.
    const { error: strategyError } = await supabase.from('strategies')
      .delete().eq('student_id', studentId).eq('user_id', user.id);
    if (strategyError) console.warn('deleteStrategy cleanup error:', strategyError);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setStrategies(prev => { const next = { ...prev }; delete next[studentId]; return next; });
    finishSave(true);
    return true;
  };

  const saveStrategy = async (studentId: string, strategy: Strategy): Promise<boolean> => {
    if (!user) {
      setSaveState('error');
      return false;
    }
    const parsedStrategy = strategySchema.safeParse(strategy);
    if (!parsedStrategy.success) {
      console.error('Refusing to save invalid strategy:', parsedStrategy.error.issues);
      setSaveState('error');
      return false;
    }
    strategy = parsedStrategy.data;
    const currentStudent = students.find(s => s.id === studentId);
    setSaveState('saving');
    setStrategies(prev => ({ ...prev, [studentId]: strategy }));
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, status: 'Strategy Generated', updated: 'Just now' } : s
    ));
    const writes: Promise<{ error: unknown }>[] = [
      Promise.resolve(supabase.from('strategies')
        .upsert({ student_id: studentId, user_id: user.id, data: strategy }, { onConflict: 'student_id,user_id' })),
    ];
    if (currentStudent) {
      const updatedStudent = { ...currentStudent, status: 'Strategy Generated' as const, updated: 'Just now' };
      writes.push(Promise.resolve(supabase.from('students')
        .upsert({ id: studentId, user_id: user.id, data: updatedStudent, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' })));
    }
    const results = await Promise.all(writes);
    const ok = results.every(r => !r.error);
    results.forEach(r => { if (r.error) console.error('saveStrategy error:', r.error); });
    finishSave(ok);
    return ok;
  };

  const markDocumentReady = async (studentId: string): Promise<boolean> => {
    if (!user) {
      setSaveState('error');
      return false;
    }
    const currentStudent = students.find(s => s.id === studentId);
    if (!currentStudent) {
      setSaveState('error');
      return false;
    }
    setSaveState('saving');
    const updatedStudent = { ...currentStudent, status: 'Document Ready' as const, updated: 'Just now' };
    const { error } = await supabase.from('students')
      .upsert({ id: studentId, user_id: user.id, data: updatedStudent, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' });
    if (error) {
      console.error('markDocumentReady error:', error);
      finishSave(false);
      return false;
    }
    setStudents(prev => prev.map(s => s.id === studentId ? updatedStudent : s));
    finishSave(true);
    return true;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStudents([]);
    setStrategies({});
  };

  return (
    <AppContext.Provider value={{
      students, schools, strategies, tweaks, saveState, loading, loadError, user,
      setTweak, saveStudent, saveStudentDraft, seedSampleStudents, deleteStudent, saveStrategy, markDocumentReady, signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
