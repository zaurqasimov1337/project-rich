'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { fmtDate } from '@/lib/sales';

interface TaskRow {
  id: string;
  title: string;
  body: string | null;
  leadId: string | null;
  leadName: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
}
interface Meta {
  managers: { id: string; name: string }[];
}
interface TaskForm {
  title: string;
  body?: string;
  assigneeId?: string;
  dueAt?: string;
  priority?: string;
}

const LIMIT = 25;

const STATUS_LABELS: Record<string, string> = {
  todo: 'Gözləyir',
  in_progress: 'İcrada',
  done: 'Tamamlandı',
  cancelled: 'Ləğv',
};
const STATUS_ORDER = ['todo', 'in_progress', 'done', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  todo: '#64748b',
  in_progress: '#3b82f6',
  done: '#16a34a',
  cancelled: '#dc2626',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Təcili',
  high: 'Yüksək',
  medium: 'Orta',
  low: 'Aşağı',
};
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#64748b',
};

function badgeStyle(color: string): { background: string; color: string } {
  return { background: `${color}1a`, color };
}

function isOverdue(t: TaskRow): boolean {
  if (!t.dueAt) return false;
  if (t.status === 'done' || t.status === 'cancelled') return false;
  const d = new Date(t.dueAt);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export default function TasksPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canManage = can('tasks.manage');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: meta } = useQuery({ queryKey: ['sales-meta'], queryFn: () => api.get<Meta>('/sales/meta') });

  const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status) qs.set('status', status);
  if (mine) qs.set('mine', 'true');
  if (assigneeId) qs.set('assigneeId', assigneeId);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', qs.toString()],
    queryFn: () => api.list<TaskRow>(`/tasks?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskForm>();
  const createMut = useMutation({
    mutationFn: (v: TaskForm) =>
      api.post('/tasks', {
        title: v.title,
        body: v.body || undefined,
        assigneeId: v.assigneeId || undefined,
        dueAt: v.dueAt ? new Date(v.dueAt).toISOString() : undefined,
        priority: v.priority || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}`, { status: 'done' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tapşırıqlar</h1>
          <p className="mt-0.5 text-sm text-muted">Cəmi {total} tapşırıq</p>
        </div>
        {canManage && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni tapşırıq
          </Button>
        )}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          placeholder="Bütün statuslar"
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          className="w-44"
        />
        <Select
          value={assigneeId}
          onChange={(e) => { setAssigneeId(e.target.value); setPage(1); }}
          placeholder="Bütün icraçılar"
          options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))}
          className="w-48"
        />
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={mine}
            onChange={(e) => { setMine(e.target.checked); setPage(1); }}
          />
          Mənim tapşırıqlarım
        </label>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted-bg/50">
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Başlıq</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Bağlı lead</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">İcraçı</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Son tarix</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Prioritet</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold text-muted">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-4 w-full animate-pulse rounded bg-muted-bg" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">Tapşırıq tapılmadı</td></tr>
            ) : (
              rows.map((t) => {
                const overdue = isOverdue(t);
                const manager = meta?.managers.find((m) => m.id === t.assigneeId);
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border last:border-0 hover:bg-muted-bg/50 ${overdue ? 'border-l-2 border-l-danger' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{t.title}</div>
                      {t.body && <div className="mt-0.5 line-clamp-1 text-xs text-muted">{t.body}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {t.leadId && t.leadName ? (
                        <Link href={`/crm/leads/${t.leadId}`} className="text-primary hover:underline">
                          {t.leadName}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{manager?.name ?? '—'}</td>
                    <td className={`px-3 py-2.5 ${overdue ? 'font-semibold text-danger' : 'text-muted'}`}>
                      {fmtDate(t.dueAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={badgeStyle(PRIORITY_COLORS[t.priority] ?? '#64748b')}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLORS[t.priority] ?? '#64748b' }} />
                        {PRIORITY_LABELS[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={badgeStyle(STATUS_COLORS[t.status] ?? '#64748b')}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && t.status !== 'done' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={completeMut.isPending}
                            onClick={() => completeMut.mutate(t.id)}
                          >
                            <Check className="h-3.5 w-3.5" /> Tamamla
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Sil"
                            disabled={deleteMut.isPending}
                            onClick={() => deleteMut.mutate(t.id)}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Səh. {data?.meta.page ?? 1} / {pages} · cəmi {total}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* new task */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Yeni tapşırıq"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Ləğv et</Button>
            <Button loading={createMut.isPending} onClick={handleSubmit((v) => createMut.mutate(v))}>Yadda saxla</Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>Başlıq *</Label>
            <Input error={errors.title?.message} {...register('title', { required: 'Tələb olunur' })} />
          </div>
          <div><Label>Təsvir</Label><Input {...register('body')} /></div>
          <div>
            <Label>İcraçı</Label>
            <Select placeholder="İcraçı seçin" options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} {...register('assigneeId')} />
          </div>
          <div>
            <Label>Son tarix</Label>
            <Input type="date" {...register('dueAt')} />
          </div>
          <div>
            <Label>Prioritet</Label>
            <Select placeholder="Orta" options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} {...register('priority')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
