'use client';

import { useQuery } from '@tanstack/react-query';
import { Flame, Percent, UserCheck, Users, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { CHART_SERIES, fmtDate, LEAD_STATUS_LABELS, statusBadgeStyle } from '@/lib/sales';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface CrmSummary {
  kpis: {
    total: number;
    monthCount: number;
    registered: number;
    hot: number;
    conversion: number;
  };
  byTraining: { trainingId: string; name: string; count: number }[];
  lostReasons: { reason: string; count: number }[];
  managers: { userId: string; name: string; total: number; won: number }[];
  recent: {
    id: string;
    leadNo: string | number;
    fullName: string;
    phone: string | null;
    status: string;
    priority: string;
    createdAt: string;
  }[];
  seeAll: boolean;
}

interface SalesMeta {
  managers: { id: string; name: string }[];
}

// Muted, professional chart palette (no rainbow) — extends the shared
// financial-SaaS palette by repeating it for longer category lists.
const BAR_COLORS = [...CHART_SERIES, ...CHART_SERIES];

function SummarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl border border-border bg-surface lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}

export default function CrmDashboardPage() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const qs = new URLSearchParams();
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo) qs.set('date_to', dateTo);
  if (assignedTo) qs.set('assigned_to', assignedTo);
  const query = qs.toString();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['crm-summary', dateFrom, dateTo, assignedTo],
    queryFn: () => api.get<CrmSummary>(`/crm/summary${query ? `?${query}` : ''}`),
  });

  const { data: meta } = useQuery({
    queryKey: ['sales-meta'],
    queryFn: () => api.get<SalesMeta>('/sales/meta'),
    enabled: summary?.seeAll === true,
  });

  const managerOptions = [
    { value: '', label: 'Bütün menecerlər' },
    ...((meta?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))),
  ];

  const kpis = summary
    ? [
        { label: 'Ümumi lead', value: summary.kpis.total, icon: Users, tone: 'text-info' },
        { label: 'Bu ay lead', value: summary.kpis.monthCount, icon: UserPlus, tone: 'text-primary' },
        { label: 'Qeydiyyat olanlar', value: summary.kpis.registered, icon: UserCheck, tone: 'text-success' },
        { label: 'Hot lead', value: summary.kpis.hot, icon: Flame, tone: 'text-danger' },
        { label: 'Konversiya', value: `${summary.kpis.conversion}%`, icon: Percent, tone: 'text-warning' },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Satış paneli</h1>
          <p className="mt-0.5 text-sm text-muted">Satış komandasının cari vəziyyəti.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">Tarixdən</label>
            <input
              type="date"
              lang="az"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">Tarixə</label>
            <input
              type="date"
              lang="az"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {summary?.seeAll && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">Menecer</label>
              <Select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                options={managerOptions}
                className="w-48"
              />
            </div>
          )}
          {(dateFrom || dateTo || assignedTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setAssignedTo(''); }}>
              Sıfırla
            </Button>
          )}
        </div>
      </div>

      {isLoading || !summary ? (
        <SummarySkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      {k.label}
                    </span>
                    <span className={`rounded-lg bg-muted-bg p-1.5 ${k.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums">{k.value}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold">Təlimlərə görə lead bölgüsü</h2>
              {summary.byTraining.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted">Məlumat yoxdur</div>
              ) : (
                <div style={{ height: Math.max(240, summary.byTraining.length * 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.byTraining}
                      layout="vertical"
                      margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={130}
                        tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--color-muted-bg)' }}
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {summary.byTraining.map((t, i) => (
                          <Cell key={t.trainingId} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold">Son müraciətlər</h2>
              <div className="space-y-1">
                {summary.recent.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => router.push(`/crm/leads/${l.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted-bg"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        <span className="text-muted">#{l.leadNo}</span> {l.fullName}
                      </div>
                      <div className="truncate text-xs text-muted">{l.phone ?? '—'}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={statusBadgeStyle(l.status)}
                      >
                        {LEAD_STATUS_LABELS[l.status] ?? l.status}
                      </span>
                      <span className="text-[11px] text-muted">{fmtDate(l.createdAt)}</span>
                    </div>
                  </button>
                ))}
                {summary.recent.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted">Məlumat yoxdur</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {summary.seeAll && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <h2 className="mb-3 text-sm font-semibold">Menecerlərə görə satış</h2>
                {summary.managers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted">Məlumat yoxdur</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                          <th className="pb-2 font-semibold">Menecer</th>
                          <th className="pb-2 text-right font-semibold">Satış / Ümumi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.managers.map((m) => (
                          <tr key={m.userId} className="border-b border-border/50 last:border-0">
                            <td className="py-2">{m.name}</td>
                            <td className="py-2 text-right tabular-nums">
                              <span className="font-semibold text-success">{m.won}</span>
                              <span className="text-muted"> / {m.total}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold">İtirilmə səbəbləri</h2>
              {summary.lostReasons.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">Məlumat yoxdur</div>
              ) : (
                <div className="space-y-1">
                  {summary.lostReasons.map((r) => (
                    <div
                      key={r.reason}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted-bg"
                    >
                      <span className="min-w-0 truncate text-sm">{r.reason}</span>
                      <span className="shrink-0 rounded-full bg-muted-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
