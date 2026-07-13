'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn, initials } from '@/lib/utils';
import { StatusBadge } from '@/components/data-table';

interface StudentDetail {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  enrollments: {
    id: string;
    status: string;
    joinedAt: string;
    group: { id: string; name: string; status: string; course: { name: string } };
  }[];
}

interface AttendanceData {
  summary: Record<string, number>;
  recent: {
    id: string;
    status: string;
    lesson: { date: string; startAt: string; topic: string | null; group: { name: string } };
  }[];
}

interface GradeRow {
  id: string;
  score: number;
  comment: string | null;
  exam: { name: string; type: string; date: string; maxScore: number; group: { name: string } };
}

const TABS = [
  { key: 'profile', label: 'Profil' },
  { key: 'groups', label: 'Qruplar' },
  { key: 'attendance', label: 'Davamiyyət' },
  { key: 'grades', label: 'Qiymətlər' },
] as const;

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('profile');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => api.get<StudentDetail>(`/students/${id}`),
  });
  const { data: attendance } = useQuery({
    queryKey: ['student-attendance', id],
    queryFn: () => api.get<AttendanceData>(`/students/${id}/attendance`),
    enabled: tab === 'attendance',
  });
  const { data: grades } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: () => api.get<GradeRow[]>(`/students/${id}/grades`),
    enabled: tab === 'grades',
  });

  if (isLoading || !student) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted-bg" />;
  }

  const info: [string, string | null][] = [
    ['Telefon', student.phone],
    ['E-poçt', student.email],
    ['Doğum tarixi', student.birthDate ? new Date(student.birthDate).toLocaleDateString('az-Latn-AZ') : null],
    ['Valideyn', student.parentName],
    ['Valideyn telefonu', student.parentPhone],
    ['Ünvan', student.address],
    ['Qeydiyyat', new Date(student.createdAt).toLocaleDateString('az-Latn-AZ')],
  ];

  return (
    <div className="space-y-5">
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tələbələr
      </Link>

      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
          {initials(student.firstName, student.lastName)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">
              {student.firstName} {student.lastName}
            </h1>
            <StatusBadge status={student.status} />
          </div>
          <div className="mt-0.5 text-sm text-muted">
            <span className="font-mono">{student.code}</span>
            {student.phone && <> · {student.phone}</>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {info.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 sm:block">
                <dt className="text-[13px] font-medium text-muted">{label}</dt>
                <dd className="text-sm">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {student.notes && (
            <div className="mt-4 rounded-lg bg-muted-bg p-3 text-sm">{student.notes}</div>
          )}
        </div>
      )}

      {tab === 'groups' && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          {student.enrollments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">Qrup üzvlüyü yoxdur</div>
          ) : (
            <div className="divide-y divide-border">
              {student.enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/groups/${e.group.id}`} className="font-medium hover:text-primary">
                      {e.group.name}
                    </Link>
                    <span className="ml-2 text-sm text-muted">{e.group.course.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted">
                      {new Date(e.joinedAt).toLocaleDateString('az-Latn-AZ')}
                    </span>
                    <StatusBadge status={e.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['present', 'Gəlib'],
              ['late', 'Gecikib'],
              ['absent', 'Gəlməyib'],
              ['excused', 'Üzrlü'],
            ].map(([key, label]) => (
              <div key={key} className="rounded-xl border border-border bg-surface p-4 text-center shadow-sm">
                <div className="text-2xl font-bold tabular-nums">
                  {attendance?.summary[key!] ?? 0}
                </div>
                <div className="text-sm text-muted">{label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            {!attendance || attendance.recent.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">Davamiyyət qeydi yoxdur</div>
            ) : (
              <div className="divide-y divide-border">
                {attendance.recent.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span>
                      {new Date(a.lesson.startAt).toLocaleDateString('az-Latn-AZ')} ·{' '}
                      {a.lesson.group.name}
                      {a.lesson.topic && <span className="text-muted"> — {a.lesson.topic}</span>}
                    </span>
                    <StatusBadge
                      status={a.status === 'present' ? 'active' : a.status === 'absent' ? 'cancelled' : a.status}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'grades' && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          {!grades || grades.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">Qiymət yoxdur</div>
          ) : (
            <div className="divide-y divide-border">
              {grades.map((g) => (
                <div key={g.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium">{g.exam.name}</span>
                    <span className="ml-2 text-muted">
                      {g.exam.group.name} · {new Date(g.exam.date).toLocaleDateString('az-Latn-AZ')}
                    </span>
                  </div>
                  <span className="font-bold tabular-nums">
                    {g.score}/{g.exam.maxScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
