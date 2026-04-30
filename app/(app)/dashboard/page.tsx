'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Search, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/shared/Avatar';
import type { Student } from '@/types';

export default function DashboardPage() {
  const { students } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filtered = students.filter(s => {
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    if (query && !`${s.name} ${s.school} ${s.major}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: students.length,
    active: students.filter(s => s.status !== 'Document Ready').length,
    ready: students.filter(s => s.status === 'Document Ready').length,
    avgGpa: students.length
      ? (students.reduce((a, s) => a + parseFloat(s.gpa || '0'), 0) / students.length).toFixed(2)
      : '—',
  };

  const statusOptions = ['All', 'Draft', 'Strategy Generated', 'Document Ready', 'Needs Review'];

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">Students</h1>
          <p className="text-[var(--muted)] mt-1">Manage applicant strategies and Common App–ready outputs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded border border-[var(--line-strong)] text-[var(--ink)] text-[13.5px] font-medium bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card">
            <FileText size={14} />
            Templates
          </button>
          <Link
            href="/students/new/profile"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded text-white text-[13.5px] font-medium transition-all"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} />
            Create New Student
          </Link>
        </div>
      </div>

      {/* Stats row */}
      {students.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total students',    value: stats.total, delta: '+2 this week' },
            { label: 'Active strategies', value: stats.active, delta: `Across ${stats.active} students` },
            { label: 'Document-ready',    value: stats.ready, delta: '+1 vs last week' },
            { label: 'Avg. GPA (weighted)', value: stats.avgGpa, delta: 'Cohort weighted average' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-card shadow-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{stat.label}</div>
              <div className="text-[28px] font-semibold tabular-nums text-[var(--ink)]">{stat.value}</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">{stat.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table card */}
      {students.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-4">
            <Search size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">No students yet</h3>
          <p className="text-[var(--muted)] mb-6">Create your first student profile to begin building a strategy.</p>
          <Link
            href="/students/new/profile"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} /> Create Your First Student
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
              <input
                className="pl-9 pr-3 py-1.5 rounded border border-[var(--line-strong)] text-[13.5px] bg-white w-64 focus:outline-none focus:border-[var(--accent)] focus:shadow-focus transition-all"
                placeholder="Search by name, school, major…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {statusOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded text-[12.5px] font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-[var(--accent-50)] text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <span className="text-[12px] text-[var(--muted)]">{filtered.length} of {students.length}</span>
          </div>

          {/* Table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                {['Name', 'Grade', 'Intended Major', 'GPA', 'SAT', 'Last Updated', 'Status', ''].map((h, i) => (
                  <th
                    key={h + i}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]"
                    style={{ width: h === '' ? 80 : h === 'Name' ? '26%' : 'auto', textAlign: h === '' ? 'right' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: Student) => (
                <StudentRow key={s.id} student={s} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--muted)] text-[13.5px]">
                    No students match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentRow({ student }: { student: Student }) {
  const router = useRouter();
  const { deleteStudent } = useApp();
  const [confirming, setConfirming] = useState(false);
  const href = `/students/${student.id}/strategy`;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      deleteStudent(student.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <tr
      className="border-b border-[var(--line)] hover:bg-[var(--bg-soft)] group transition-colors cursor-pointer"
      onClick={() => router.push(href)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={student.name} color={student.color} size={32} />
          <div>
            <div className="text-[13.5px] font-medium text-[var(--ink)]">{student.name}</div>
            <div className="text-[12px] text-[var(--muted)]">{student.school}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[13.5px] text-[var(--ink-soft)]">{student.grade}th</td>
      <td className="px-4 py-3 text-[13.5px] text-[var(--ink-soft)]">{student.major || '—'}</td>
      <td className="px-4 py-3 text-[13.5px] tabular-nums text-[var(--ink-soft)]">
        {student.gpa || '—'}{' '}
        {student.gpa && <span className="text-[11px] text-[var(--muted)]">{student.gpaType === 'Weighted' ? 'W' : 'U'}</span>}
      </td>
      <td className="px-4 py-3 text-[13.5px] tabular-nums text-[var(--ink-soft)]">{student.sat || '—'}</td>
      <td className="px-4 py-3 text-[13.5px] text-[var(--muted)]">{student.updated}</td>
      <td className="px-4 py-3"><StatusBadge status={student.status} /></td>
      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium transition-all ${
              confirming
                ? 'bg-red-500 text-white'
                : 'border border-[var(--line-strong)] text-[var(--muted)] bg-white hover:border-red-300 hover:text-red-500'
            }`}
          >
            <Trash2 size={12} />
            {confirming ? 'Confirm?' : ''}
          </button>
          <Link
            href={href}
            className="px-3 py-1 rounded border border-[var(--line-strong)] text-[12.5px] font-medium text-[var(--ink)] bg-white hover:bg-[var(--bg-soft)] transition-all shadow-card"
          >
            Open
          </Link>
        </div>
      </td>
    </tr>
  );
}
