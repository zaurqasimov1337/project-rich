'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';

interface ExamRow {
  id: string;
  name: string;
  type: string;
  date: string;
  maxScore: number;
  group: { id: string; name: string };
  _count: { results: number };
}

interface ExamDetail {
  id: string;
  name: string;
  maxScore: number;
  group: { id: string; name: string };
  rows: {
    student: { id: string; code: string; firstName: string; lastName: string };
    result: { score: number; comment: string | null } | null;
  }[];
}

interface ExamForm {
  groupId: string;
  name: string;
  type: string;
  date: string;
  maxScore?: number;
}

export default function ExamsPage() {
  const t = useTranslations('exams');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => api.get<ExamRow[]>('/exams'),
  });
  const { data: groups } = useQuery({
    queryKey: ['groups-options'],
    queryFn: () => api.list<{ id: string; name: string }>('/groups?limit=100&status=active'),
    enabled: createOpen,
  });
  const { data: examDetail } = useQuery({
    queryKey: ['exam', selectedExam],
    queryFn: () => api.get<ExamDetail>(`/exams/${selectedExam}`),
    enabled: !!selectedExam,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExamForm>({
    defaultValues: { type: 'exam' },
  });

  const createMutation = useMutation({
    mutationFn: (v: ExamForm) =>
      api.post('/exams', { ...v, maxScore: v.maxScore ? Number(v.maxScore) : undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exams'] });
      setCreateOpen(false);
      reset();
    },
  });

  const saveResultsMutation = useMutation({
    mutationFn: () =>
      api.put(`/exams/${selectedExam}/results`, {
        items: Object.entries(scores)
          .filter(([, v]) => v !== '')
          .map(([studentId, score]) => ({ studentId, score: Number(score) })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exam', selectedExam] });
      void qc.invalidateQueries({ queryKey: ['exams'] });
      setScores({});
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        {can('exams.manage') && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('new')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {isLoading && <div className="h-24 animate-pulse rounded-xl bg-muted-bg" />}
          {exams?.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
              {t('empty')}
            </div>
          )}
          {exams?.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setSelectedExam(e.id);
                setScores({});
              }}
              className={cn(
                'w-full rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-primary',
                selectedExam === e.id && 'border-primary ring-2 ring-primary/20',
              )}
            >
              <div className="font-semibold">{e.name}</div>
              <div className="mt-0.5 text-sm text-muted">
                {e.group.name} · {new Date(e.date).toLocaleDateString('az-Latn-AZ')} ·{' '}
                {e._count.results} {t('result')}
              </div>
            </button>
          ))}
        </div>

        <div>
          {!selectedExam ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
              {t('selectExamPrompt')}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="font-semibold">
                  {examDetail?.name}{' '}
                  <span className="text-muted">({t('max')} {examDetail?.maxScore})</span>
                </h2>
                {can('exams.manage') && (
                  <Button
                    size="sm"
                    loading={saveResultsMutation.isPending}
                    disabled={Object.values(scores).every((v) => v === '')}
                    onClick={() => saveResultsMutation.mutate()}
                  >
                    {tc('save')}
                  </Button>
                )}
              </div>
              <div className="divide-y divide-border">
                {examDetail?.rows.map((row) => (
                  <div key={row.student.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <span className="font-medium">
                        {row.student.firstName} {row.student.lastName}
                      </span>{' '}
                      <span className="font-mono text-xs text-muted">{row.student.code}</span>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        max={examDetail.maxScore}
                        placeholder={row.result ? String(row.result.score) : '—'}
                        value={scores[row.student.id] ?? ''}
                        onChange={(e) =>
                          setScores((s) => ({ ...s, [row.student.id]: e.target.value }))
                        }
                        className="text-right tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('new')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={handleSubmit((v) => createMutation.mutate(v))}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>{t('group')} *</Label>
            <Select
              placeholder={t('selectGroup')}
              error={errors.groupId?.message}
              options={(groups?.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
              {...register('groupId', { required: tc('required') })}
            />
          </div>
          <div>
            <Label>{tc('name')} *</Label>
            <Input
              placeholder={t('namePlaceholder')}
              error={errors.name?.message}
              {...register('name', { required: tc('required') })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tc('type')}</Label>
              <Select
                options={[
                  { value: 'exam', label: t('typeExam') },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'midterm', label: t('typeMidterm') },
                  { value: 'final', label: 'Final' },
                ]}
                {...register('type')}
              />
            </div>
            <div>
              <Label>{tc('date')} *</Label>
              <Input
                type="date"
                error={errors.date?.message}
                {...register('date', { required: tc('required') })}
              />
            </div>
          </div>
          <div>
            <Label>{t('maxScore')}</Label>
            <Input type="number" min={1} placeholder="100" {...register('maxScore')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
