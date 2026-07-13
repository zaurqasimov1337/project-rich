'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Filter = 'overdue' | 'today' | 'tomorrow' | 'open' | 'done';

interface Activity {
  id: string;
  type: string;
  body: string | null;
  dueAt: string | null;
  doneAt: string | null;
  lead: { id: string; name: string; phone: string | null; stage: { name: string; color: string } | null } | null;
}
interface FollowUpData {
  activities: Activity[];
  counts: { overdue: number; today: number; tomorrow: number };
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function FollowUpsPage() {
  const t = useTranslations('crm');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [filter, setFilter] = useState<Filter>('today');

  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups', filter],
    queryFn: () => api.get<FollowUpData>(`/leads/activities?filter=${filter}`),
  });

  const markDone = useMutation({
    mutationFn: (id: string) => api.patch(`/leads/activities/${id}/done`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['follow-ups'] }),
  });

  const tabs: { key: Filter; label: string; badge?: number }[] = [
    { key: 'overdue', label: t('tabOverdue'), badge: data?.counts.overdue },
    { key: 'today', label: t('tabToday'), badge: data?.counts.today },
    { key: 'tomorrow', label: t('tabTomorrow'), badge: data?.counts.tomorrow },
    { key: 'open', label: t('tabOpen') },
    { key: 'done', label: t('tabDone') },
  ];

  const activities = data?.activities ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{t('followUpsTitle')}</h1>
        <p className="mt-0.5 text-sm text-muted">{t('followUpsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === tab.key ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-muted-bg hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  tab.key === 'overdue' ? 'bg-danger/15 text-danger' : 'bg-muted-bg text-muted',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted-bg" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-bg text-muted">
              <Bell className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold">{t('noFollowUps')}</div>
            <div className="mt-1 text-sm text-muted">{t('noFollowUpsHint')}</div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((a) => {
              const overdue = a.dueAt && !a.doneAt && new Date(a.dueAt) < new Date();
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: a.lead?.stage?.color ?? 'var(--color-muted)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.lead?.name ?? '—'}</span>
                      {a.lead?.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Phone className="h-3 w-3" />
                          {a.lead.phone}
                        </span>
                      )}
                    </div>
                    {a.body && <div className="truncate text-sm text-muted">{a.body}</div>}
                  </div>
                  <span className={cn('shrink-0 text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}>
                    {fmtDateTime(a.dueAt)}
                  </span>
                  {!a.doneAt && can('leads.update') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markDone.mutate(a.id)}
                      disabled={markDone.isPending}
                    >
                      <Check className="h-3.5 w-3.5" /> {t('markDone')}
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
