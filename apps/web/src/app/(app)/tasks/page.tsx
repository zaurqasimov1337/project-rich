'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';

interface TaskRow {
  id: string;
  title: string;
  body: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
}

interface TaskForm {
  title: string;
  body?: string;
  dueAt?: string;
  priority: string;
}

const PRIORITY_CLS: Record<string, string> = {
  low: 'bg-muted-bg text-muted',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-danger/10 text-danger',
};

export default function TasksPage() {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', showDone],
    queryFn: () =>
      api.list<TaskRow>(`/tasks?limit=100${showDone ? '' : '&status=todo&status=in_progress'}`),
    placeholderData: keepPreviousData,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskForm>({
    defaultValues: { priority: 'medium' },
  });

  const createMutation = useMutation({
    mutationFn: (v: TaskForm) => api.post('/tasks', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (task: TaskRow) =>
      api.patch(`/tasks/${task.id}`, { status: task.status === 'done' ? 'todo' : 'done' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDone((s) => !s)}>
            {showDone ? t('showActive') : t('showAll')}
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> {t('newTask')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted-bg" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">{t('empty')} 🎉</div>
        ) : (
          <div className="divide-y divide-border">
            {data?.data.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleMutation.mutate(task)}
                  className="shrink-0 text-muted hover:text-primary"
                  aria-label="Toggle done"
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'font-medium',
                      task.status === 'done' && 'text-muted line-through',
                    )}
                  >
                    {task.title}
                  </div>
                  {task.body && <div className="truncate text-sm text-muted">{task.body}</div>}
                </div>
                {task.dueAt && (
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      new Date(task.dueAt) < new Date() && task.status !== 'done'
                        ? 'font-medium text-danger'
                        : 'text-muted',
                    )}
                  >
                    {new Date(task.dueAt).toLocaleDateString('az-Latn-AZ')}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    PRIORITY_CLS[task.priority],
                  )}
                >
                  {t(`priority.${task.priority}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('newTask')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
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
            <Label>{t('titleField')} *</Label>
            <Input error={errors.title?.message} {...register('title', { required: tc('required') })} />
          </div>
          <div>
            <Label>{t('body')}</Label>
            <Input {...register('body')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('dueDate')}</Label>
              <Input type="date" {...register('dueAt')} />
            </div>
            <div>
              <Label>{t('priorityLabel')}</Label>
              <Select
                options={[
                  { value: 'low', label: t('priority.low') },
                  { value: 'medium', label: t('priority.medium') },
                  { value: 'high', label: t('priority.high') },
                  { value: 'urgent', label: t('priority.urgent') },
                ]}
                {...register('priority')}
              />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
