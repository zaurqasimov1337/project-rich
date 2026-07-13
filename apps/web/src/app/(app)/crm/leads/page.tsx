'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, UserCog, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  fmtDate,
  GENDER_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  priorityBadgeStyle,
  PRIORITY_LABELS,
  SCORE_FLAG_LABELS,
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
  campaigns: { id: string; name: string }[];
  managers: { id: string; name: string }[];
}
interface LeadForm {
  fullName: string;
  phone?: string;
  instagram?: string;
  email?: string;
  age?: string;
  gender?: string;
  city?: string;
  educationStatus?: string;
  currentField?: string;
  interestedTrainingId?: string;
  campaignId?: string;
  source?: string;
  status?: string;
  assignedTo?: string;
  firstContactAt?: string;
  nextFollowupAt?: string;
  notes?: string;
  askedDemo?: boolean;
  askedPrice?: boolean;
  callAnswered?: boolean;
  parentInvolved?: boolean;
  budgetOk?: boolean;
}

const LIMIT = 25;

function FF({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-foreground">
        {label} {req && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

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
  const [minScore, setMinScore] = useState('');
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
  if (minScore) qs.set('min_score', minScore);
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo) qs.set('date_to', dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-leads', qs.toString()],
    queryFn: () => api.get<LeadsResp>(`/leads?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>({
    defaultValues: { firstContactAt: today, source: 'instagram_dm', status: 'yeni_lead' },
  });
  const createMut = useMutation({
    mutationFn: (v: LeadForm) => {
      const payload: Record<string, unknown> = {
        fullName: v.fullName,
        phone: v.phone || undefined,
        instagram: v.instagram || undefined,
        email: v.email || undefined,
        age: v.age ? Number(v.age) : undefined,
        gender: v.gender || undefined,
        city: v.city || undefined,
        educationStatus: v.educationStatus || undefined,
        currentField: v.currentField || undefined,
        interestedTrainingId: v.interestedTrainingId || undefined,
        campaignId: v.campaignId || undefined,
        source: v.source || undefined,
        status: v.status || undefined,
        assignedTo: v.assignedTo || undefined,
        firstContactAt: v.firstContactAt ? new Date(v.firstContactAt).toISOString() : undefined,
        nextFollowupAt: v.nextFollowupAt ? new Date(v.nextFollowupAt).toISOString() : undefined,
        notes: v.notes || undefined,
        askedDemo: !!v.askedDemo,
        askedPrice: !!v.askedPrice,
        callAnswered: !!v.callAnswered,
        parentInvolved: !!v.parentInvolved,
        budgetOk: !!v.budgetOk,
      };
      return api.post('/leads', payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-leads'] });
      setDrawerOpen(false);
      reset({ firstContactAt: today, source: 'instagram_dm', status: 'yeni_lead' });
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
  const activeFilterCount = [status, priority, trainingId, source, assignedTo, minScore, dateFrom, dateTo].filter(Boolean).length;

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
    setMinScore('');
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
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
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
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="Bütün statuslar"
            options={LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} className="w-40 shrink-0" />
          <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} placeholder="Prioritet (hamısı)"
            options={[{ value: 'hot', label: 'HOT' }, { value: 'warm', label: 'WARM' }, { value: 'cold', label: 'COLD' }]} className="w-36 shrink-0" />
          <Select value={trainingId} onChange={(e) => { setTrainingId(e.target.value); setPage(1); }} placeholder="Bütün təlimlər"
            options={(meta?.trainings ?? []).map((t) => ({ value: t.id, label: t.name }))} className="w-40 shrink-0" />
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} placeholder="Bütün mənbələr"
            options={(meta?.sources ?? []).map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s }))} className="w-40 shrink-0" />
          <Select value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); setPage(1); }} placeholder="Bütün menecerlər"
            options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} className="w-44 shrink-0" />
          <input type="number" min={0} max={100} value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }} placeholder="Skor ≥"
            className="h-9 w-24 shrink-0 rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <input type="date" lang="az" title="Tarixdən" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 w-36 shrink-0 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <input type="date" lang="az" title="Tarixə" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 w-36 shrink-0 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="shrink-0 whitespace-nowrap">Sıfırla</Button>
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

      {/* new lead modal */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 my-4 w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-bold">Yeni lead</h2>
                <p className="text-sm text-muted">Bütün vacib məlumatları doldurun</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1 text-muted hover:bg-muted-bg hover:text-foreground" aria-label="Bağla">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="max-h-[68vh] space-y-4 overflow-y-auto px-6 py-5">
              <FF label="Ad Soyad" req>
                <Input placeholder="Ad Soyad" error={errors.fullName?.message} {...register('fullName', { required: 'Tələb olunur' })} />
              </FF>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FF label="Telefon"><Input placeholder="+994501234567" {...register('phone')} /></FF>
                <FF label="Instagram"><Input placeholder="@username" {...register('instagram')} /></FF>
                <FF label="Yaş"><Input type="number" min={0} max={120} {...register('age')} /></FF>
                <FF label="Cins">
                  <Select placeholder="—" options={Object.entries(GENDER_LABELS).map(([v, l]) => ({ value: v, label: l }))} {...register('gender')} className="w-full" />
                </FF>
                <FF label="Şəhər"><Input {...register('city')} /></FF>
                <FF label="Təhsil / İş statusu"><Input {...register('educationStatus')} /></FF>
                <FF label="Hazırkı sahə"><Input {...register('currentField')} /></FF>
                <FF label="Maraqlandığı təlim">
                  <Select placeholder="—" options={(meta?.trainings ?? []).map((t) => ({ value: t.id, label: t.name }))} {...register('interestedTrainingId')} className="w-full" />
                </FF>
                <FF label="Lead mənbəyi">
                  <Select options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))} {...register('source')} className="w-full" />
                </FF>
                <FF label="Reklam kampaniyası">
                  <Select placeholder="—" options={(meta?.campaigns ?? []).map((c) => ({ value: c.id, label: c.name }))} {...register('campaignId')} className="w-full" />
                </FF>
                <FF label="Təyin edilmiş sales manager">
                  <Select placeholder="—" options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} {...register('assignedTo')} className="w-full" />
                </FF>
                <FF label="Status">
                  <Select options={LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} {...register('status')} className="w-full" />
                </FF>
                <FF label="İlk müraciət tarixi" hint="Müştəri ilk dəfə nə vaxt müraciət edib?">
                  <input type="date" lang="az" {...register('firstContactAt')}
                    className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </FF>
                <FF label="Növbəti follow-up">
                  <input type="datetime-local" {...register('nextFollowupAt')}
                    className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </FF>
              </div>
              <FF label="Qeydlər">
                <textarea {...register('notes')}
                  className="h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </FF>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SCORE_FLAG_LABELS.slice(0, 5).map((f) => (
                  <label key={f.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted-bg">
                    <input type="checkbox" className="h-4 w-4 accent-primary" {...register(f.key as keyof LeadForm)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Ləğv et</Button>
              <Button loading={createMut.isPending} onClick={handleSubmit((v) => createMut.mutate(v))}>Əlavə et</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
