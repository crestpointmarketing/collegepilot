'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { createClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  };

  const inputClass = 'w-full px-3 py-2.5 pr-10 rounded border border-[var(--line-strong)] text-[13.5px] bg-white focus:outline-none focus:border-[var(--accent)] focus:shadow-focus transition-all';

  return (
    <main className="min-h-screen bg-[var(--bg-soft)] flex flex-col">
      <header className="h-16 border-b border-[var(--line)] bg-white flex items-center px-8">
        <BrandMark />
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl border border-[var(--line)] shadow-card p-8">
          <h1 className="text-2xl font-semibold text-[var(--ink)]">Set a new password</h1>
          <p className="mt-2 mb-6 text-[13.5px] text-[var(--muted)]">Choose a new password for your CollegePilot account.</p>

          <label className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">New password</label>
          <div className="relative mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <label className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="new-password"
            required
            className={inputClass}
          />

          {error && <div className="mt-4 text-[12.5px] text-red-700 bg-red-50 px-3 py-2.5 rounded-lg">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full px-4 py-2.5 rounded text-white text-[13.5px] font-medium disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </div>
    </main>
  );
}
