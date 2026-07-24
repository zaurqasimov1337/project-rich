'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Phone, Plus, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtDateTime } from '@/lib/sales';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

type Bucket = 'today' | 'overdue' | 'tomorrow' | 'all' | 'done';

interface FollowUpItem {
  id: string;
  leadId: string;
  dueAt: string;
  doneAt: string | null;
  isDone: boolean;
  note: string | null;
  leadName: string;
  leadPhone: string | null;
  trainingName: string | null;
  assigneeName: string | null;
}
interface FollowUpsResp {
  counts: { overdue: number; today: number; tomorrow: number };
  items: FollowUpItem[];
}
interface LeadOption {
  id: string;
  leadNo: number | null;
  fullName: string;
  phone: string | null;
}

const TABS: { key: Bucket; label: string }[] = [
  { key: 'overdue', label: 'Gecikmiş' },
  { key: 'today', label: 'Bu gün' },
  { key: 'tomorrow', label: 'Sabah' },
  { key: 'all', label: 'Bütün açıqlar' },
  { key: 'done', label: 'Tamamlanmış' },
];

function NewFollowupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [leadQuery, setLeadQuery] = useState('');
  const [leadPicked, setLeadPicked] = useState<LeadOption | null>(null);
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');

  const { data: leadResults } = useQuery({
    queryKey: ['followup-lead-search', leadQuery],
    queryFn: () => api.get<{ data: LeadOption[] }>(`/leads?q=${encodeURIComponent(leadQuery)}&limit=8`),
    enabled: leadQuery.trim().length >= 2,
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.post('/followups', {
        leadId: leadPicked!.id,
        dueAt: new Date(dueAt).toISOString(),
        note: note || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['followups'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yeni follow-up</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-muted-bg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Lead</Label>
            {leadPicked ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  #{leadPicked.leadNo} {leadPicked.fullName} {leadPicked.phone ? `· ${leadPicked.phone}` : ''}
                </span>
                <button className="text-muted hover:text-foreground" onClick={() => setLeadPicked(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input placeholder="Ad və ya telefonla axtar…" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} />
                {(leadResults?.data ?? []).length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                    {(leadResults?.data ?? []).map((l) => (
                      <button
                        key={l.id}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted-bg"
                        onClick={() => {
                          setLeadPicked(l);
                          setLeadQuery('');
                        }}
                      >
                        #{l.leadNo} {l.fullName} {l.phone ? `· ${l.phone}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <Label>Tarix və saat</Label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div>
            <Label>Qeyd (opsional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Ləğv et</Button>
          <Button disabled={!leadPicked || !dueAt || createMut.isPending} onClick={() => createMut.mutate()}>
            Yadda saxla
          </Button>
        </div>
      </div>
    </div>
  );
}

function FollowUpsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const initial = (params.get('bucket') as Bucket | null) ?? 'today';
  const [bucket, setBucket] = useState<Bucket>(TABS.some((t) => t.key === initial) ? initial : 'today');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['followups', bucket],
    queryFn: () => api.get<FollowUpsResp>(`/followups?bucket=${bucket}`),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/followups/${id}`, { isDone: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['followups'] }),
  });

  const counts = data?.counts;
  const items = data?.items ?? [];

  const badgeFor = (key: Bucket): number | undefined => {
    if (key === 'overdue') return counts?.overdue;
    if (key === 'today') return counts?.today;
    if (key === 'tomorrow') return counts?.tomorrow;
    return undefined;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Follow-up-lar</h1>
          <p className="mt-1 text-sm text-muted">Heç bir lead-i unutmayın.</p>
        </div>
        {can('leads.update') && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni follow-up
          </Button>
        )}
      </div>

      {/* buckets */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((tab) => {
          const badge = badgeFor(tab.key);
          const active = bucket === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setBucket(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                active ? 'bg-muted-bg font-semibold text-foreground' : 'text-muted hover:text-foreground',
              )}
            >
              {tab.label}
              {badge != null && badge > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                    tab.key === 'overdue' ? 'bg-danger/15 text-danger' : 'bg-muted-bg text-muted',
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* list */}
      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted-bg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted-bg text-muted">
              <Bell className="h-7 w-7" />
            </div>
            <div className="mt-4 text-lg font-bold">Bu kateqoriyada follow-up yoxdur</div>
            <div className="mt-1 text-sm text-muted">Yeni follow-up əlavə edin və ya tarix aralığını dəyişin.</div>
            {can('leads.update') && (
              <Button className="mt-5" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Yeni follow-up
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => {
              const overdue = !it.isDone && new Date(it.dueAt) < new Date();
              return (
                <div
                  key={it.id}
                  onClick={() => router.push(`/crm/leads/${it.leadId}`)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted-bg/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-bold">{it.leadName}</span>
                      {it.leadPhone && (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Phone className="h-3 w-3" />
                          {it.leadPhone}
                        </span>
                      )}
                    </div>
                    {it.trainingName && <div className="mt-0.5 truncate text-sm text-muted">{it.trainingName}</div>}
                    {it.note && <div className="mt-0.5 truncate text-sm text-foreground/80">{it.note}</div>}
                    {it.assigneeName && <div className="mt-0.5 text-xs text-muted">{it.assigneeName}</div>}
                  </div>
                  <span className={cn('shrink-0 text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}>
                    {fmtDateTime(it.dueAt)}
                  </span>
                  {!it.isDone && can('leads.update') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeMut.mutate(it.id);
                      }}
                      disabled={completeMut.isPending}
                    >
                      <Check className="h-3.5 w-3.5" /> Tamamla
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && <NewFollowupModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

export default function FollowUpsPage() {
  return (
    <Suspense>
      <FollowUpsInner />
    </Suspense>
  );
}
