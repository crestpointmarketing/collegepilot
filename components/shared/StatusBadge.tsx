import type { StudentStatus } from '@/types';

const STATUS_STYLES: Record<StudentStatus, string> = {
  'Draft':              'bg-[var(--slate-50)] text-[var(--slate-600)]',
  'Strategy Generated': 'bg-[var(--accent-50)] text-[var(--accent)]',
  'Document Ready':     'bg-[var(--green-50)] text-[var(--green-600)]',
  'Needs Review':       'bg-[var(--amber-50)] text-[var(--amber-600)]',
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-[10px] py-[3px] rounded-pill text-[11.5px] font-semibold tracking-wide ${STATUS_STYLES[status] ?? STATUS_STYLES['Draft']}`}
    >
      {status}
    </span>
  );
}
