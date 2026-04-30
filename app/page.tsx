'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { BrandMark } from '@/components/layout/BrandMark';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  const inp = 'w-full px-3 py-2.5 rounded border border-[var(--line-strong)] text-[13.5px] bg-white focus:outline-none focus:border-[var(--accent)] focus:shadow-focus transition-all';

  const bullets = [
    'AI-generated positioning tailored to each student',
    'School list calibrated against real admit cohorts',
    'Common App–ready outputs in minutes',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-soft)]">
      {/* Top nav */}
      <header className="h-16 border-b border-[var(--line)] bg-white flex items-center px-10">
        <BrandMark />
        <nav className="flex-1 flex justify-center items-center gap-1">
          {['Product', 'Pricing', 'For Counselors', 'Contact'].map(link => (
            <button key={link} className="px-3 py-1.5 text-[13.5px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
              {link}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('signin')}
            className="px-3.5 py-1.5 text-[13.5px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('signup')}
            className="px-3.5 py-1.5 rounded text-white text-[13.5px] font-medium"
            style={{ background: 'var(--accent)' }}
          >
            Get started
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1240px] mx-auto px-10 py-12">
        <div className="grid grid-cols-2 gap-16 items-center">
          {/* Hero (left) */}
          <div>
            <div className="inline-flex items-center gap-2 border border-[var(--line)] rounded-pill px-3 py-1.5 mb-6 text-[12.5px] font-medium text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              Now in private beta
            </div>
            <h1 className="text-[52px] font-semibold leading-[1.1] tracking-tighter text-[var(--ink)] mb-5">
              Expert admissions{' '}
              <span
                style={{
                  background: 'linear-gradient(120deg, var(--accent) 0%, #8b5cf6 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                  paddingBottom: '0.1em',
                  marginBottom: '-0.1em',
                }}
              >
                strategy
              </span>
              , at scale
            </h1>
            <p className="text-[17px] text-[var(--ink-soft)] leading-[1.55] mb-8">
              AI-powered positioning, school lists, and Common App outputs for top college applicants. Built for the most demanding admissions consultants.
            </p>
            <div className="flex flex-col gap-2.5 mb-8">
              {bullets.map(b => (
                <div key={b} className="flex items-center gap-3">
                  <div className="w-[18px] h-[18px] rounded-full bg-[var(--accent-50)] flex items-center justify-center shrink-0">
                    <Check size={10} strokeWidth={3} style={{ color: 'var(--accent)' }} />
                  </div>
                  <span className="text-[14px] text-[var(--ink-soft)]">{b}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode('signup')}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[14px] font-medium"
                style={{ background: 'var(--accent)' }}
              >
                Get started <ArrowRight size={14} />
              </button>
              <button className="px-5 py-2.5 rounded border border-[var(--line-strong)] text-[14px] font-medium text-[var(--ink)] bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card">
                View demo
              </button>
            </div>
          </div>

          {/* Auth card (right) */}
          <div
            className="bg-white rounded-card p-7"
            style={{ boxShadow: '0 0 0 1px rgba(60,66,87,0.04), 0 8px 24px rgba(60,66,87,0.08)' }}
          >
            <h2 className="text-[20px] font-semibold text-[var(--ink)] mb-1">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="text-[13.5px] text-[var(--muted)] mb-6">
              {mode === 'signin' ? 'Enter your credentials to continue.' : 'Start building your counselor workspace.'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-[var(--ink-soft)]">Email address</label>
                <input
                  className={inp}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@firm.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-medium text-[var(--ink-soft)]">Password</label>
                  {mode === 'signin' && (
                    <button type="button" className="text-[12.5px] font-medium" style={{ color: 'var(--accent)' }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    className={inp + ' pr-10'}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink-soft)] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-[12.5px] text-red-700 bg-[var(--red-50)] px-3 py-2.5 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded text-center text-white text-[14px] font-medium disabled:opacity-60 transition-opacity"
                style={{ background: 'var(--accent)' }}
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-[var(--line)]" />
                <span className="text-[12px] text-[var(--muted)]">or</span>
                <div className="flex-1 h-px bg-[var(--line)]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 rounded border border-[var(--line-strong)] text-[14px] font-medium text-[var(--ink)] bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-[12.5px] text-[var(--muted)]">
                {mode === 'signin' ? 'New to CollegePilot? ' : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); }}
                  className="font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  {mode === 'signin' ? 'Create account' : 'Sign in'}
                </button>
              </p>
            </form>
          </div>
        </div>

        {/* Trust band */}
        <div className="mt-16 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
            Trusted by leading admissions firms
          </div>
          <p className="text-[22px] font-medium text-[var(--ink)] mb-5">
            "The first tool that actually thinks like a strategist."
          </p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {['Crimson Education', 'Ivy Coach', 'Top Tier', 'Applerouth', 'College Advisor'].map(firm => (
              <span key={firm} className="text-[17px] text-[var(--muted)]" style={{ fontFamily: 'Georgia, serif', opacity: 0.55 }}>
                {firm}
              </span>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] py-6 px-10 flex items-center justify-between">
        <span className="text-[12.5px] text-[var(--muted)]">© 2026 CollegePilot</span>
        <div className="flex items-center gap-4">
          {['Privacy', 'Terms', 'Security', 'Contact'].map(link => (
            <button key={link} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink-soft)]">{link}</button>
          ))}
        </div>
      </footer>
    </div>
  );
}
