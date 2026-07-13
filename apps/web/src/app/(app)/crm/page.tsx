'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, TrendingUp, Users, UserCheck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface Funnel {
  stages: { id: string; name: string; color: string; count: number }[];
  totalLeads: number;
  won: number;
  conversionRate: number;
  adSpend: number;
  cpl: number;
  cac: number;
}
interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  stage: { name: string; color: string } | null;
  source: { name: string } | null;
  createdAt: string;
}

function money(v: number) {
  return (v / 100).toLocaleString('az-AZ', { maximumFractionDigits: 0 }) + ' ₼';
}

export default function CrmDashboardPage() {
  const t = useTranslations('crm');
  const tr = useTranslations('dateRange');
  const can = useAuth((s) => s.can);
  const [range, setRange] = useState('this_month');

  const { data: funnel } = useQuery({
    queryKey: ['crm-funnel', range],
    queryFn: () => api.get<Funnel>(`/leads/funnel?range=${range}`),
  });
  const { data: recent } = useQuery({
    queryKey: ['crm-recent-leads'],
    queryFn: () => api.list<LeadRow>('/leads?page=1&limit=8'),
  });

  const rangeOptions = [
    { value: 'today', label: tr('today') },
    { value: 'this_week', label: tr('thisWeek') },
    { value: 'this_month', label: tr('thisMonth') },
    { value: 'last_month', label: tr('lastMonth') },
    { value: 'this_year', label: tr('thisYear') },
  ];

  const kpis = [
    { label: t('totalLeads'), value: funnel?.totalLeads ?? 0, icon: Users, tone: 'text-info' },
    { label: t('conversion'), value: `${funnel?.conversionRate ?? 0}%`, icon: TrendingUp, tone: 'text-success' },
    { label: t('won'), value: funnel?.won ?? 0, icon: UserCheck, tone: 'text-primary' },
    { label: 'CPL', value: funnel ? money(funnel.cpl) : '—', icon: Wallet, tone: 'text-warning' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t('dashboard')}</h1>
          <p className="mt-0.5 text-sm text-muted">{t('dashboardSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            options={rangeOptions}
            className="w-40"
          />
          {can('leads.create') && (
            <Link href="/crm/leads">
              <Button>
                <Plus className="h-4 w-4" /> {t('newLead')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k.label}</span>
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
          <h2 className="mb-4 text-sm font-semibold">{t('leadsByStage')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel?.stages ?? []} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--color-muted-bg)' }}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(funnel?.stages ?? []).map((s) => (
                    <Cell key={s.id} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">{t('recentLeads')}</h2>
          <div className="space-y-1">
            {(recent?.data ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted-bg">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="truncate text-xs text-muted">{l.source?.name ?? '—'}</div>
                </div>
                {l.stage && (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: l.stage.color }} />
                    {l.stage.name}
                  </span>
                )}
              </div>
            ))}
            {(recent?.data ?? []).length === 0 && (
              <div className="py-8 text-center text-sm text-muted">{t('noFollowUps')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
