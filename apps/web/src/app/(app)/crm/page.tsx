'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Filter, Flame, Percent, UserCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { fmtDateTime, ACTIVITY_LABELS, SOURCE_LABELS } from '@/lib/sales';
import { Select } from '@/components/ui/select';
import { ExportMenu } from '@/components/export-menu';

// Theme-aware series colors: the lead accent follows the --accent token
// (bright cyan on dark navy, deeper cyan on light), rest are mid tones.
const CYAN = 'var(--accent)';
const DONUT_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'];

interface CrmSummary {
  kpis: { total: number; monthCount: number; registered: number; hot: number; conversion: number };
  byTraining: { trainingId: string | null; name: string; count: number }[];
  lostReasons: { reason: string; count: number }[];
  managers: { userId: string | null; name: string; total: number; won: number }[];
  topSold: { trainingId: string | null; name: string; count: number }[];
  recentActivities: { id: string; leadId: string; type: string; title: string | null; leadName: string; createdAt: string }[];
  recent: { id: string; fullName: string; createdAt: string }[];
  seeAll: boolean;
}

interface ReportsResp {
  summary: { total: number; registered: number; lost: number; conversionRate: number; revenue: number; potentialRevenue: number };
  funnel: { key: string; label: string; count: number }[];
  bySource: { source: string; count: number }[];
  byCampaign: { campaignId: string | null; name: string; count: number }[];
  monthly: { month: string; total: number; won: number }[];
  seeAll: boolean;
}

interface SalesMeta {
  managers: { id: string; name: string }[];
}

const RANGE_PRESETS = [
  { value: '', label: 'Bütün vaxtlar' },
  { value: 'today', label: 'Bu gün' },
  { value: '7d', label: 'Son 7 gün' },
  { value: 'month', label: 'Bu ay' },
  { value: '3m', label: 'Son 3 ay' },
];

function rangeFor(preset: string): { from?: string; to?: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'today') return { from: iso(today) };
  if (preset === '7d') return { from: iso(new Date(Date.now() - 6 * 86400000)) };
  if (preset === 'month') return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)) };
  if (preset === '3m') return { from: iso(new Date(Date.now() - 90 * 86400000)) };
  return {};
}

function relTime(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const dayDiff = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (dayDiff === 0) return `bu gün ${hh}:${mi}`;
  if (dayDiff === 1) return `dünən ${hh}:${mi}`;
  return fmtDateTime(d);
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-bold">{title}</div>
          {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function CrmDashboardPage() {
  const router = useRouter();
  const can = useAuth((s) => s.can);
  const user = useAuth((s) => s.user);
  const [preset, setPreset] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const { from, to } = useMemo(() => rangeFor(preset), [preset]);
  const qs = new URLSearchParams();
  if (from) qs.set('date_from', from);
  if (to) qs.set('date_to', to);
  const reportQuery = qs.toString();
  if (assignedTo) qs.set('assigned_to', assignedTo);
  const query = qs.toString();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['crm-summary', preset, assignedTo],
    queryFn: () => api.get<CrmSummary>(`/crm/summary${query ? `?${query}` : ''}`),
  });
  const { data: report } = useQuery({
    queryKey: ['sales-reports', preset],
    queryFn: () => api.get<ReportsResp>(`/sales/reports${reportQuery ? `?${reportQuery}` : ''}`),
  });
  const { data: meta } = useQuery({
    queryKey: ['sales-meta'],
    queryFn: () => api.get<SalesMeta>('/sales/meta'),
    enabled: summary?.seeAll === true,
  });

  const kpis = summary
    ? [
        { label: 'BU AY LEAD', value: summary.kpis.monthCount.toLocaleString('az-AZ'), sub: `Cəmi: ${summary.kpis.total.toLocaleString('az-AZ')}`, icon: Users, tone: 'text-accent' },
        { label: 'CONVERSİON', value: `${report?.summary.conversionRate ?? summary.kpis.conversion}%`, sub: report ? `Yığılıb: ${formatMoney(report.summary.revenue)}` : undefined, icon: Percent, tone: 'text-accent' },
        { label: 'HOT LEAD', value: summary.kpis.hot.toLocaleString('az-AZ'), sub: undefined, icon: Flame, tone: 'text-danger' },
        { label: 'QEYDİYYAT OLAN', value: summary.kpis.registered.toLocaleString('az-AZ'), sub: report ? `Potensial satış: ${formatMoney(report.summary.potentialRevenue)}` : undefined, icon: UserCheck, tone: 'text-success' },
      ]
    : [];

  const funnelMax = Math.max(1, ...(report?.funnel ?? []).map((f) => f.count));

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Salam, {user?.firstName ?? '—'}</h1>
          <p className="mt-1 text-sm text-muted">Bu gün satış komandasının vəziyyəti.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3">
            <CalendarDays className="h-4 w-4 text-muted" />
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="bg-transparent text-sm font-medium text-foreground outline-none"
            >
              {RANGE_PRESETS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {summary?.seeAll && (
            <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3">
              <Filter className="h-4 w-4 text-muted" />
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="max-w-[180px] bg-transparent text-sm font-medium text-foreground outline-none"
              >
                <option value="">Bütün sales komandası</option>
                {(meta?.managers ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          {can('leads.settings') && (
            <ExportMenu
              urlFor={(f) => `/api/v1/sales/reports/export.${f}${reportQuery ? `?${reportQuery}` : ''}`}
              filenameFor={(f) => `sales-report.${f}`}
            />
          )}
        </div>
      </div>

      {isLoading || !summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">{k.label}</span>
                    <Icon className={`h-4.5 w-4.5 ${k.tone}`} />
                  </div>
                  <div className="mt-3 text-4xl font-bold tabular-nums">{k.value}</div>
                  {k.sub && <div className="mt-2 text-sm text-muted">{k.sub}</div>}
                </div>
              );
            })}
          </div>

          {/* bar chart + manager performance */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Kurslara görə lead bölgüsü" subtitle={RANGE_PRESETS.find((r) => r.value === preset)?.label}>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.byTraining} margin={{ top: 4, right: 8, left: -12, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                      <Tooltip
                        cursor={{ fill: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
                        contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                      />
                      <Bar dataKey="count" name="Lead" fill={CYAN} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card title="Sales manager performansı" subtitle="Bağlanan satış">
              {summary.seeAll && summary.managers.length > 0 ? (
                <div className="space-y-2">
                  {summary.managers.map((m) => (
                    <div key={m.userId ?? 'none'} className="flex items-center justify-between rounded-lg border border-border bg-elevated/50 px-4 py-3">
                      <span className="truncate font-semibold">{m.name}</span>
                      <span className="shrink-0 text-sm tabular-nums">
                        <span className="font-bold text-success">{m.won}</span>
                        <span className="text-muted"> / {m.total}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted">Məlumat yoxdur</div>
              )}
            </Card>
          </div>

          {/* funnel + monthly trend */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Satış funeli">
              <div className="space-y-2.5">
                {(report?.funnel ?? []).map((f, i) => (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{f.label}</span>
                      <span className="font-semibold tabular-nums">{f.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted-bg">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((f.count / funnelMax) * 100)}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <div className="lg:col-span-2">
              <Card title="Aylıq trend" subtitle="Lead və bağlanan satış">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report?.monthly ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                      <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }} />
                      <Legend />
                      <Bar dataKey="total" name="Lead" fill={CYAN} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} />
                      <Bar dataKey="won" name="Satış" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>

          {/* donut + lost reasons + activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Ən çox satılan təlimlər">
              {summary.topSold.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">Hələ satış yoxdur</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.topSold} dataKey="count" nameKey="name" innerRadius="52%" outerRadius="80%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2} isAnimationActive animationDuration={800}>
                        {summary.topSold.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card title="Ən çox itirilmə səbəbləri">
              {summary.lostReasons.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">Məlumat yoxdur</div>
              ) : (
                <div className="space-y-2">
                  {summary.lostReasons.map((l, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg px-1 py-1.5">
                      <span className="truncate text-sm">{l.reason}</span>
                      <span className="rounded-md bg-danger/15 px-2 py-0.5 font-mono text-sm font-semibold text-danger">{l.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card
              title="Son aktivlik"
              action={
                <button onClick={() => router.push('/crm/leads')} className="text-sm font-medium text-accent hover:underline">
                  hamısına bax
                </button>
              }
            >
              {summary.recentActivities.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">Aktivlik yoxdur</div>
              ) : (
                <div className="space-y-3">
                  {summary.recentActivities.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => router.push(`/crm/leads/${a.leadId}`)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{a.title ?? ACTIVITY_LABELS[a.type] ?? a.type}</div>
                        <div className="truncate text-sm text-muted">{a.leadName}</div>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{relTime(a.createdAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* source + campaign (merged reports) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Mənbə üzrə">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(report?.bySource ?? []).map((s) => ({ ...s, name: SOURCE_LABELS[s.source] ?? s.source }))}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 24, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }} />
                    <Bar dataKey="count" name="Lead" fill={CYAN} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Kampaniya üzrə">
              {(report?.byCampaign ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">Kampaniya məlumatı yoxdur</div>
              ) : (
                <div className="space-y-2">
                  {(report?.byCampaign ?? []).map((c, i) => {
                    const max = Math.max(1, ...(report?.byCampaign ?? []).map((x) => x.count));
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-44 truncate text-sm" title={c.name}>{c.name}</div>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted-bg">
                          <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.round((c.count / max) * 100)}%` }} />
                        </div>
                        <div className="w-10 text-right text-sm font-semibold tabular-nums">{c.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
