import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  counter?: ReactNode;
  children: ReactNode;
}

export function Field({ label, hint, error, optional, counter, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-[var(--ink-soft)]">
          {label}
          {optional && <span className="text-[var(--muted-2)] font-normal"> · optional</span>}
        </span>
        {counter}
      </label>
      {children}
      {hint && !error && <div className="text-[12px] text-[var(--muted)]">{hint}</div>}
      {error && (
        <div className="flex items-center gap-1 text-[12px] text-red-600">
          <X size={11} strokeWidth={2.4} />
          {error}
        </div>
      )}
    </div>
  );
}
