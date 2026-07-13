'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import {
  fmtDate,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  priorityBadgeStyle,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  statusBadgeStyle,
} from '@/lib/sales';

interface LeadRow {
  id: string;
  leadNo: number | null;
  fullName: string;
  phone: string | null;
  status: string;
  priority: string;
  score: number;
  source: string | null;
  trainingName: string | null;
  assigneeName: string | null;
  createdAt: string;
}
interface LeadsResp {
  data: LeadRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
interface Meta {
  statuses: string[];
  sources: string[];
  trainings: { id: string; name: string }[];
  managers: { id: string; name: string }[];
}
interface LeadForm {
  fullName: string;
  phone?: string;
  instagram?: string;
  source?: string;
  interestedTrainingId?: string;
  status?: string;
  assignedTo?: string;
  notes?: string;
}

const LIMIT = 25;

export default function LeadsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [source, setSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkManager, setBulkManager] = useState('');
  const debounced = useDebounced(search, 350);

  const { data: meta } = useQuery({ queryKey: ['sales-meta'], queryFn: () => api.get<Meta>('/sales/meta') });

  const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT), sort, order });
  if (debounced) qs.set('q', debounced);
  if (status) qs.set('status', status);
  if (priority) qs.set('priority', priority);
  if (trainingId) qs.set('training_id', trainingId);
  if (source) qs.set('source', source);
  if (assignedTo) qs.set('assigned_to', assignedTo);
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo) qs.set('date_to', dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-leads', qs.toString()],
    queryFn: () => api.get<LeadsResp>(`/leads?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>();
  const createMut = useMutation({
    mutationFn: (v: LeadForm) =>
      api.post('/leads', {
        ...v,
        source: v.source || undefined,
        interestedTrainingId: v.interestedTrainingId || undefined,
        status: v.status || undefined,
        assignedTo: v.assignedTo || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-leads'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => api.post('/leads/bulk-assign', { ids: [...selected], assignedTo: bulkManager }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-leads'] });
      setSelected(new Set());
      setBulkManager('');
    },
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  function toggleSort(col: string) {
    if (sort === col) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(col);
      setOrder('asc');
    }
    setPage(1);
  }
  function toggleAll() {
    if (rows.every((r) => selected.has(r.id))) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  const resetFilters = () => {
    setStatus('');
    setPriority('');
    setTrainingId('');
    setSource('');
    setAssignedTo('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const SortHead = ({ col, label, right }: { col: string; label: string; right?: boolean }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 font-semibold text-muted hover:text-foreground ${right ? 'ml-auto' : ''}`}
    >
      {label}
      {sort === col && <ChevronDown className={`h-3 w-3 ${order === 'asc' ? 'rotate-180' : ''}`} />}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Müraciətlər</h1>
          <p className="mt-0.5 text-sm text-muted">Cəmi {total} müraciət</p>
        </div>
        {can('leads.create') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni müraciət
          </Button>
        )}
      </div>

      {/* search + filters */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Ad, telefon, Instagram və ya qeyd üzrə axtar..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="Bütün statuslar"
            options={LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} className="w-40" />
          <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} placeholder="Prioritet"
            options={[{ value: 'hot', label: 'HOT' }, { value: 'warm', label: 'WARM' }, { value: 'cold', label: 'COLD' }]} className="w-32" />
          <Select value={trainingId} onChange={(e) => { setTrainingId(e.target.value); setPage(1); }} placeholder="Bütün təlimlər"
            options={(meta?.trainings ?? []).map((t) => ({ value: t.id, label: t.name }))} className="w-40" />
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} placeholder="Bütün mənbələr"
            options={(meta?.sources ?? []).map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s }))} className="w-40" />
          <Select value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); setPage(1); }} placeholder="Bütün menecerlər"
            options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} className="w-44" />
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground" />
          {(status || priority || trainingId || source || assignedTo || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>Filtrləri sıfırla</Button>
          )}
        </div>
      </div>

      {/* bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <UserCog className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selected.size} müraciət seçildi</span>
          <div className="ml-auto flex items-center gap-2">
            <Select value={bulkManager} onChange={(e) => setBulkManager(e.target.value)} placeholder="Menecerə təyin et"
              options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} className="w-48" />
            <Button size="sm" disabled={!bulkManager || bulkMut.isPending} onClick={() => bulkMut.mutate()}>Təyin et</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Ləğv</Button>
          </div>
        </div>
      )}

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted-bg/50">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" className="h-4 w-4 accent-primary"
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2.5 text-left"><SortHead col="lead_no" label="#" /></th>
              <th className="px-3 py-2.5 text-left"><SortHead col="name" label="Ad / Əlaqə" /></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Prioritet</th>
              <th className="px-3 py-2.5 text-left"><SortHead col="date" label="İlk müraciət" /></th>
              <th className="px-3 py-2.5 text-left"><SortHead col="score" label="Skor" /></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Təyin olunub</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted">Mənbə</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-4 w-full animate-pulse rounded bg-muted-bg" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-muted">Heç bir müraciət tapılmadı</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted-bg/50"
                  onClick={() => router.push(`/crm/leads/${r.id}`)}>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted">#{r.leadNo ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.fullName}</div>
                    <div className="text-xs text-muted">{r.phone ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={statusBadgeStyle(r.status)}>
                      {LEAD_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={priorityBadgeStyle(r.priority)}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: priorityBadgeStyle(r.priority).color }} />
                      {PRIORITY_LABELS[r.priority] ?? r.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums">{r.score}</td>
                  <td className="px-3 py-2.5 text-muted">{r.assigneeName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{r.source ? (SOURCE_LABELS[r.source] ?? r.source) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Səh. {data?.page ?? 1} / {pages} · cəmi {total}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* new lead */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Yeni müraciət"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Ləğv et</Button>
            <Button loading={createMut.isPending} onClick={handleSubmit((v) => createMut.mutate(v))}>Yadda saxla</Button>
          </>
        }>
        <form className="space-y-4">
          <div>
            <Label>Ad Soyad *</Label>
            <Input error={errors.fullName?.message} {...register('fullName', { required: 'Tələb olunur' })} />
          </div>
          <div><Label>Telefon</Label><Input placeholder="055 690 40 25" {...register('phone')} /></div>
          <div><Label>Instagram</Label><Input placeholder="@istifadeci" {...register('instagram')} /></div>
          <div>
            <Label>Mənbə</Label>
            <Select placeholder="Mənbə seçin" options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))} {...register('source')} />
          </div>
          <div>
            <Label>Maraqlandığı təlim</Label>
            <Select placeholder="Təlim seçin" options={(meta?.trainings ?? []).map((t) => ({ value: t.id, label: t.name }))} {...register('interestedTrainingId')} />
          </div>
          <div>
            <Label>Status</Label>
            <Select placeholder="Yeni Lead" options={LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} {...register('status')} />
          </div>
          <div>
            <Label>Təyin olunan menecer</Label>
            <Select placeholder="Menecer seçin" options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} {...register('assignedTo')} />
          </div>
          <div><Label>Qeyd</Label><Input {...register('notes')} /></div>
        </form>
      </Drawer>
    </div>
  );
}
