'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Student, Strategy, Tweaks, School } from '@/types';
import { SAMPLE_STUDENTS, INITIAL_STRATEGIES, TWEAK_DEFAULTS, ACCENT_PALETTES } from '@/lib/data';
import { SCHOOLS } from '@/lib/schools';
import { createClient } from '@/lib/supabase';

interface AppContextValue {
  students: Student[];
  schools: School[];
  strategies: Record<string, Strategy>;
  tweaks: Tweaks;
  saveState: 'idle' | 'saving' | 'saved';
  loading: boolean;
  user: User | null;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  saveStudent: (data: Student) => void;
  deleteStudent: (studentId: string) => void;
  saveStrategy: (studentId: string, strategy: Strategy) => void;
  markDocumentReady: (studentId: string) => void;
  triggerSave: () => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>(SCHOOLS);
  const [strategies, setStrategies] = useState<Record<string, Strategy>>(INITIAL_STRATEGIES);
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load tweaks from localStorage on mount (UI preferences stay local)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('ase:tweaks');
      if (saved) setTweaks(prev => ({ ...prev, ...JSON.parse(saved) }));
    } catch { /* ignore */ }
  }, []);

  // Auth: check session immediately on mount, then watch for sign-out
  useEffect(() => {
    let active = true;

    // Primary check — getUser() is reliable even when onAuthStateChange is slow
    supabase.auth.getUser().then(async ({ data: { user: currentUser } }) => {
      if (!active) return;
      setUser(currentUser ?? null);
      if (currentUser) {
        await loadUserData(currentUser.id);
      } else {
        setLoading(false);
      }
    }).catch(() => { if (active) setLoading(false); });

    // Secondary — only used to detect sign-out after initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        setUser(null);
        setStudents([]);
        setSchools(SCHOOLS);
        setStrategies(INITIAL_STRATEGIES);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData(userId: string) {
    setLoading(true);
    try {
      const [{ data: studentRows }, { data: strategyRows }, { data: schoolRows, count: schoolCount }] = await Promise.all([
        supabase.from('students').select('data').eq('user_id', userId),
        supabase.from('strategies').select('student_id, data').eq('user_id', userId),
        supabase.from('schools').select('data', { count: 'exact' }),
      ]);

      // Seed schools on first use (global data, same for everyone)
      if (!schoolCount || schoolCount === 0) {
        const rows = SCHOOLS.map(s => ({ id: s.id, data: s }));
        await supabase.from('schools').insert(rows);
        setSchools(SCHOOLS);
      } else {
        const loaded = schoolRows?.map(r => r.data as School) ?? SCHOOLS;
        setSchools(loaded);
      }

      const loadedStudents: Student[] = studentRows?.map(r => r.data as Student) ?? [];

      if (loadedStudents.length === 0) {
        // First login — seed sample students so the workspace isn't empty
        const rows = SAMPLE_STUDENTS.map(s => ({ id: s.id, user_id: userId, data: s }));
        const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id,user_id' });
        if (!error) setStudents(SAMPLE_STUDENTS);
      } else {
        setStudents(loadedStudents);
      }

      const loadedStrategies: Record<string, Strategy> = { ...INITIAL_STRATEGIES };
      strategyRows?.forEach(r => { loadedStrategies[r.student_id] = r.data as Strategy; });
      setStrategies(loadedStrategies);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
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

  const triggerSave = () => {
    setSaveState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    }, 600);
  };

  const saveStudent = (data: Student) => {
    if (!user) return;
    const id = data.id || `s${Date.now()}`;
    const palette = ['#6366f1', '#ec4899', '#0891b2', '#7c3aed', '#059669', '#d97706'];
    const updated: Student = {
      ...data,
      id,
      color: data.color || palette[students.length % palette.length],
      updated: 'Just now',
      status: data.status || 'Draft',
    };
    setStudents(prev => {
      const exists = prev.find(s => s.id === id);
      return exists ? prev.map(s => s.id === id ? { ...s, ...updated } : s) : [updated, ...prev];
    });
    triggerSave();
    supabase.from('students')
      .upsert({ id, user_id: user.id, data: updated, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' })
      .then(({ error }) => { if (error) console.error('saveStudent error:', error); });
  };

  const deleteStudent = (studentId: string) => {
    if (!user) return;
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setStrategies(prev => { const next = { ...prev }; delete next[studentId]; return next; });
    supabase.from('students').delete().eq('id', studentId).eq('user_id', user.id)
      .then(({ error }) => { if (error) console.error('deleteStudent error:', error); });
    supabase.from('strategies').delete().eq('student_id', studentId).eq('user_id', user.id)
      .then(({ error }) => { if (error) console.error('deleteStrategy error:', error); });
  };

  const saveStrategy = (studentId: string, strategy: Strategy) => {
    if (!user) return;
    const currentStudent = students.find(s => s.id === studentId);
    setStrategies(prev => ({ ...prev, [studentId]: strategy }));
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, status: 'Strategy Generated', updated: 'Just now' } : s
    ));
    supabase.from('strategies')
      .upsert({ student_id: studentId, user_id: user.id, data: strategy }, { onConflict: 'student_id,user_id' })
      .then(({ error }) => { if (error) console.error('saveStrategy error:', error); });
    if (currentStudent) {
      const updatedStudent = { ...currentStudent, status: 'Strategy Generated' as const, updated: 'Just now' };
      supabase.from('students')
        .upsert({ id: studentId, user_id: user.id, data: updatedStudent, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' })
        .then(({ error }) => { if (error) console.error('student status sync error:', error); });
    }
  };

  const markDocumentReady = (studentId: string) => {
    if (!user) return;
    const currentStudent = students.find(s => s.id === studentId);
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, status: 'Document Ready', updated: 'Just now' } : s
    ));
    triggerSave();
    if (currentStudent) {
      const updatedStudent = { ...currentStudent, status: 'Document Ready' as const, updated: 'Just now' };
      supabase.from('students')
        .upsert({ id: studentId, user_id: user.id, data: updatedStudent, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' })
        .then(({ error }) => { if (error) console.error('markDocumentReady error:', error); });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStudents([]);
    setStrategies(INITIAL_STRATEGIES);
  };

  return (
    <AppContext.Provider value={{
      students, schools, strategies, tweaks, saveState, loading, user,
      setTweak, saveStudent, deleteStudent, saveStrategy, markDocumentReady, triggerSave, signOut,
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
