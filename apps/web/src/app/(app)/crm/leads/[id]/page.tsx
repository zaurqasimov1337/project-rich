'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  ACTIVITY_LABELS,
  fmtDate,
  fmtDateTime,
  GENDER_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  priorityBadgeStyle,
  PRIORITY_LABELS,
  SCORE_FLAG_LABELS,
  SOURCE_LABELS,
  statusBadgeStyle,
} from '@/lib/sales';

interface Followup { id: string; dueAt: string; doneAt: string | null; isDone: boolean; note: string | null; }
interface Activity { id: string; type: string; title: string | null; body: string | null; createdAt: string; }
interface LeadDetail {
  id: string; leadNo: number | null; fullName: string; name: string; phone: string | null; email: string | null;
  instagram: string | null; age: number | null; gender: string | null; city: string | null;
  educationStatus: string | null; currentField: string | null; courseInterestId: string | null;
  sourceKey: string | null; status: string; priority: string; score: number; assignedTo: string | null;
  notes: string | null; lostReason: string | null; objectionReason: string | null;
  askedDemo: boolean; askedPrice: boolean; callAnswered: boolean; parentInvolved: boolean;
  budgetOk: boolean; notResponding: boolean; passive7d: boolean;
  followupCount: number; createdAt: string;
  activities: Activity[]; followups: Followup[];
  training: { id: string; name: string } | null;
  assignee: { firstName: string; lastName: string } | null;
}
interface Meta { sources: string[]; trainings: { id: string; name: string }[]; managers: { id: string; name: string }[]; }

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const editable = can('leads.update');

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => api.get<LeadDetail>(`/leads/${id}`) });
  const { data: meta } = useQuery({ queryKey: ['sales-meta'], queryFn: () => api.get<Meta>('/sales/meta') });

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [fuDate, setFuDate] = useState('');
  const [fuNote, setFuNote] = useState('');
  useEffect(() => {
    if (lead) {
      setForm({
        fullName: lead.fullName, phone: lead.phone ?? '', email: lead.email ?? '', instagram: lead.instagram ?? '',
        age: lead.age ?? '', gender: lead.gender ?? '', city: lead.city ?? '', educationStatus: lead.educationStatus ?? '',
        currentField: lead.currentField ?? '', interestedTrainingId: lead.courseInterestId ?? '', source: lead.sourceKey ?? '',
        assignedTo: lead.assignedTo ?? '', notes: lead.notes ?? '',
      });
    }
  }, [lead]);

  const patch = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/leads/${id}`, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lead', id] }),
  });
  const createFu = useMutation({
    mutationFn: () => api.post('/followups', { leadId: id, dueAt: new Date(fuDate).toISOString(), note: fuNote || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lead', id] });
      setFuDate('');
      setFuNote('');
    },
  });
  const completeFu = useMutation({
    mutationFn: (fid: string) => api.patch(`/followups/${fid}`, { isDone: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lead', id] }),
  });

  if (isLoading || !lead) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted-bg" />;
  }

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const saveProfile = () => {
    const payload: Record<string, unknown> = { ...form };
    payload.age = form.age === '' ? undefined : Number(form.age);
    for (const k of Object.keys(payload)) if (payload[k] === '') payload[k] = undefined;
    patch.mutate(payload);
  };
  const toggleFlag = (k: string, v: boolean) => {
    if (!editable) return;
    patch.mutate({ [k]: v });
  };

  return (
    <div className="space-y-4">
      <Link href="/crm/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Müraciətlərə qayıt
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="font-mono text-sm text-muted">#{lead.leadNo ?? '—'}</div>
        <div className="text-xl font-bold">{lead.fullName}</div>
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={statusBadgeStyle(lead.status)}>
          {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={priorityBadgeStyle(lead.priority)}>
          {PRIORITY_LABELS[lead.priority]}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted">Skor</div>
            <div className="text-2xl font-bold tabular-nums">{lead.score}</div>
          </div>
          {editable && (
            <div className="w-44">
              <Select value={lead.status} onChange={(e) => patch.mutate({ status: e.target.value })}
                options={LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* profile */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Profil məlumatları</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Ad Soyad</Label><Input disabled={!editable} value={form.fullName as string ?? ''} onChange={(e) => set('fullName', e.target.value)} /></div>
              <div><Label>Telefon</Label><Input disabled={!editable} value={form.phone as string ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>
              <div><Label>Instagram</Label><Input disabled={!editable} value={form.instagram as string ?? ''} onChange={(e) => set('instagram', e.target.value)} /></div>
              <div><Label>E-poçt</Label><Input disabled={!editable} value={form.email as string ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
              <div><Label>Yaş</Label><Input type="number" disabled={!editable} value={form.age as string ?? ''} onChange={(e) => set('age', e.target.value)} /></div>
              <div><Label>Cins</Label><Select disabled={!editable} value={form.gender as string ?? ''} onChange={(e) => set('gender', e.target.value)} placeholder="Seçin"
                options={Object.entries(GENDER_LABELS).map(([v, l]) => ({ value: v, label: l }))} /></div>
              <div><Label>Şəhər</Label><Input disabled={!editable} value={form.city as string ?? ''} onChange={(e) => set('city', e.target.value)} /></div>
              <div><Label>Təhsil vəziyyəti</Label><Input disabled={!editable} value={form.educationStatus as string ?? ''} onChange={(e) => set('educationStatus', e.target.value)} /></div>
              <div><Label>Hazırkı sahə</Label><Input disabled={!editable} value={form.currentField as string ?? ''} onChange={(e) => set('currentField', e.target.value)} /></div>
              <div><Label>Mənbə</Label><Select disabled={!editable} value={form.source as string ?? ''} onChange={(e) => set('source', e.target.value)} placeholder="Seçin"
                options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))} /></div>
              <div><Label>Maraqlandığı təlim</Label><Select disabled={!editable} value={form.interestedTrainingId as string ?? ''} onChange={(e) => set('interestedTrainingId', e.target.value)} placeholder="Seçin"
                options={(meta?.trainings ?? []).map((t) => ({ value: t.id, label: t.name }))} /></div>
              <div><Label>Təyin olunan menecer</Label><Select disabled={!editable} value={form.assignedTo as string ?? ''} onChange={(e) => set('assignedTo', e.target.value)} placeholder="Seçin"
                options={(meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} /></div>
            </div>
            <div className="mt-3"><Label>Qeydlər</Label>
              <textarea disabled={!editable} value={form.notes as string ?? ''} onChange={(e) => set('notes', e.target.value)}
                className="h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-60" />
            </div>
            {editable && (
              <div className="mt-3 flex justify-end">
                <Button loading={patch.isPending} onClick={saveProfile}>Yadda saxla</Button>
              </div>
            )}
          </div>

          {/* scoring */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Skorinq (cari: {lead.score} — {PRIORITY_LABELS[lead.priority]})</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SCORE_FLAG_LABELS.map((f) => (
                <label key={f.key} className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm ${editable ? 'cursor-pointer hover:bg-muted-bg' : 'opacity-70'}`}>
                  <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!editable}
                    checked={Boolean((lead as unknown as Record<string, boolean>)[f.key])}
                    onChange={(e) => toggleFlag(f.key, e.target.checked)} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* right: followups + timeline */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Follow-up planla</h2>
            {editable && (
              <div className="space-y-2">
                <input type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground" />
                <Input placeholder="Qeyd (opsional)" value={fuNote} onChange={(e) => setFuNote(e.target.value)} />
                <Button size="sm" className="w-full" disabled={!fuDate || createFu.isPending} onClick={() => createFu.mutate()}>
                  <Plus className="h-4 w-4" /> Follow-up əlavə et
                </Button>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {lead.followups.length === 0 && <div className="text-sm text-muted">Follow-up yoxdur</div>}
              {lead.followups.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <Clock className={`h-3.5 w-3.5 ${f.isDone ? 'text-success' : 'text-warning'}`} />
                  <div className="min-w-0 flex-1">
                    <div className={f.isDone ? 'text-muted line-through' : ''}>{fmtDateTime(f.dueAt)}</div>
                    {f.note && <div className="truncate text-xs text-muted">{f.note}</div>}
                  </div>
                  {!f.isDone && editable && (
                    <button onClick={() => completeFu.mutate(f.id)} className="text-xs font-medium text-primary hover:underline">Tamamla</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Tarixçə</h2>
            <div className="space-y-3">
              {lead.activities.length === 0 && <div className="text-sm text-muted">Fəaliyyət yoxdur</div>}
              {lead.activities.map((a) => (
                <div key={a.id} className="relative border-l-2 border-border pl-3">
                  <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{a.title ?? ACTIVITY_LABELS[a.type] ?? a.type}</div>
                  {a.body && <div className="text-xs text-muted">{a.body}</div>}
                  <div className="text-[11px] text-muted">{fmtDateTime(a.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
