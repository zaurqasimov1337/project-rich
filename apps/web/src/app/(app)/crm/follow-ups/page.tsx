'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtDateTime } from '@/lib/sales';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

const TABS: { key: Bucket; label: string }[] = [
  { key: 'today', label: 'Bugün' },
  { key: 'overdue', label: 'Gecikmiş' },
  { key: 'tomorrow', label: 'Sabah' },
  { key: 'all', label: 'Hamısı' },
  { key: 'done', label: 'Bitmiş' },
];

export default function FollowUpsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [bucket, setBucket] = useState<Bucket>('today');

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
      <div>
        <h1 className="text-xl font-bold">Follow-up-lar</h1>
        <p className="mt-0.5 text-sm text-muted">Heç bir müraciəti unutmayın.</p>
      </div>

      {/* buckets */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((tab) => {
          const badge = badgeFor(tab.key);
          const active = bucket === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setBucket(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-muted-bg hover:text-foreground',
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-bg text-muted">
              <Bell className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold">Bu kateqoriyada follow-up yoxdur</div>
            <div className="mt-1 text-sm text-muted">Müraciət detalından follow-up əlavə edin.</div>
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
    </div>
  );
}
