'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data-table';

interface LessonEvent {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  group: { id: string; name: string; course: { name: string } };
}

interface RosterRow {
  student: { id: string; code: string; firstName: string; lastName: string };
  attendance: { status: string; note: string | null } | null;
}

const ATT_OPTIONS = [
  { value: 'present', label: 'Gəldi', cls: 'bg-success text-white' },
  { value: 'late', label: 'Gecikdi', cls: 'bg-warning text-white' },
  { value: 'absent', label: 'Gəlmədi', cls: 'bg-danger text-white' },
  { value: 'excused', label: 'Üzrlü', cls: 'bg-info text-white' },
];

export default function AttendancePage() {
  const qc = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['today-lessons'],
    queryFn: () =>
      api.get<LessonEvent[]>(
        `/schedule?from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}`,
      ),
  });

  const { data: roster } = useQuery({
    queryKey: ['attendance', selectedLesson],
    queryFn: () =>
      api.get<{ lesson: LessonEvent; roster: RosterRow[] }>(
        `/lessons/${selectedLesson}/attendance`,
      ),
    enabled: !!selectedLesson,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/lessons/${selectedLesson}/attendance`, {
        items: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance', selectedLesson] });
      setMarks({});
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Davamiyyət — bugünkü dərslər</h1>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {isLoading && <div className="text-sm text-muted">Yüklənir...</div>}
          {lessons?.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
              Bu gün dərs yoxdur
            </div>
          )}
          {lessons?.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedLesson(l.id);
                setMarks({});
              }}
              className={cn(
                'w-full rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-primary',
                selectedLesson === l.id && 'border-primary ring-2 ring-primary/20',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{l.group.name}</span>
                <StatusBadge status={l.status} />
              </div>
              <div className="mt-1 text-sm text-muted">
                {l.group.course.name} ·{' '}
                <span className="tabular-nums">
                  {new Date(l.startAt).toTimeString().slice(0, 5)}–
                  {new Date(l.endAt).toTimeString().slice(0, 5)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div>
          {!selectedLesson ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
              Yoxlama aparmaq üçün soldan dərs seçin
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="font-semibold">{roster?.lesson.group.name} — davamiyyət</h2>
                <Button
                  size="sm"
                  loading={saveMutation.isPending}
                  disabled={Object.keys(marks).length === 0}
                  onClick={() => saveMutation.mutate()}
                >
                  Yadda saxla ({Object.keys(marks).length})
                </Button>
              </div>
              <div className="divide-y divide-border">
                {roster?.roster.map((row) => {
                  const current = marks[row.student.id] ?? row.attendance?.status;
                  return (
                    <div key={row.student.id} className="flex items-center justify-between gap-2 p-3">
                      <div>
                        <span className="font-medium">
                          {row.student.firstName} {row.student.lastName}
                        </span>{' '}
                        <span className="font-mono text-xs text-muted">{row.student.code}</span>
                      </div>
                      <div className="flex gap-1">
                        {ATT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setMarks((m) => ({ ...m, [row.student.id]: opt.value }))
                            }
                            className={cn(
                              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                              current === opt.value
                                ? opt.cls
                                : 'bg-muted-bg text-muted hover:bg-border',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
