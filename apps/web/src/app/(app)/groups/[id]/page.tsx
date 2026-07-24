'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, UserMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/data-table';

interface GroupDetail {
  id: string;
  name: string;
  status: string;
  capacity: number;
  startDate: string | null;
  course: { id: string; name: string };
  scheduleRules: {
    id: string;
    weekdays: number[];
    startTime: string;
    endTime: string;
    type: string;
  }[];
  students: {
    id: string;
    status: string;
    joinedAt: string;
    student: { id: string; code: string; firstName: string; lastName: string; phone: string | null };
  }[];
}

const DAY_SHORT = ['B.e', 'Ç.a', 'Çər', 'C.a', 'Cümə', 'Şən', 'Baz'];

export default function GroupDetailPage() {
  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.get<GroupDetail>(`/groups/${id}`),
  });

  const { data: allStudents } = useQuery({
    queryKey: ['students-options'],
    queryFn: () =>
      api.list<{ id: string; code: string; firstName: string; lastName: string }>(
        '/students?limit=100&status=active',
      ),
    enabled: enrollOpen,
  });

  const enrollMutation = useMutation({
    mutationFn: () => api.post(`/groups/${id}/students`, { studentId: selectedStudent }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['group', id] });
      setEnrollOpen(false);
      setSelectedStudent('');
    },
  });

  const dropMutation = useMutation({
    mutationFn: (enrollmentId: string) =>
      api.patch(`/groups/${id}/students/${enrollmentId}`, { status: 'dropped' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['group', id] }),
  });

  if (isLoading || !group) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted-bg" />;
  }

  const activeCount = group.students.filter((s) => s.status === 'active').length;
  const enrolledIds = new Set(group.students.filter((s) => s.status === 'active').map((s) => s.student.id));

  return (
    <div className="space-y-5">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('title')}
      </Link>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{group.name}</h1>
              <StatusBadge status={group.status} />
            </div>
            <div className="mt-0.5 text-sm text-muted">
              {group.course.name} · {activeCount}/{group.capacity} {t('studentUnit')}
            </div>
          </div>
          {can('groups.enroll') && (
            <Button onClick={() => setEnrollOpen(true)}>
              <Plus className="h-4 w-4" /> {t('addStudent')}
            </Button>
          )}
        </div>
        {group.scheduleRules.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {group.scheduleRules.map((r) => (
              <span key={r.id} className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {r.weekdays.map((d) => DAY_SHORT[d]).join(', ')} · {r.startTime}–{r.endTime}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="border-b border-border px-5 py-3 text-[15px] font-bold">{t('students')}</div>
        {group.students.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{t('noStudents')}</div>
        ) : (
          <div className="divide-y divide-border">
            {group.students.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link href={`/students/${e.student.id}`} className="font-medium hover:text-primary">
                    {e.student.firstName} {e.student.lastName}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted">{e.student.code}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={e.status} />
                  {e.status === 'active' && can('groups.enroll') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('removeStudent')}
                      onClick={() => dropMutation.mutate(e.id)}
                    >
                      <UserMinus className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title={t('addStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              disabled={!selectedStudent}
              loading={enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
            >
              {tc('add')}
            </Button>
          </>
        }
      >
        {enrollMutation.isError && (
          <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {(enrollMutation.error as Error).message}
          </div>
        )}
        <Select
          placeholder={t('selectStudent')}
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          options={(allStudents?.data ?? [])
            .filter((s) => !enrolledIds.has(s.id))
            .map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.code})` }))}
        />
      </Drawer>
    </div>
  );
}
