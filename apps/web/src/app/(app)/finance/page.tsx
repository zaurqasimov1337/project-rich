'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';

interface Summary {
  income: number;
  expense: number;
  profit: number;
  outstandingDebt: number;
  series: { month: string; income: number; expense: number }[];
}

export default function FinancePage() {
  const t = useTranslations('finance');
  const { data, isLoading } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => api.get<Summary>('/finance/summary?range=this_month'),
  });

  const LINKS = [
    { href: '/finance/invoices', label: t('invoices.title') },
    { href: '/finance/payments', label: t('payments.title') },
    { href: '/finance/debts', label: t('debts.title') },
    { href: '/finance/expenses', label: t('expenses.title') },
    { href: '/finance/payroll', label: t('payroll.title') },
  ];

  const kpis = [
    { label: t('kpi.income'), value: data?.income, icon: ArrowUpRight, cls: 'text-success' },
    { label: t('kpi.expense'), value: data?.expense, icon: ArrowDownRight, cls: 'text-danger' },
    { label: t('kpi.profit'), value: data?.profit, icon: Wallet, cls: 'text-primary' },
    { label: t('kpi.debt'), value: data?.outstandingDebt, icon: AlertCircle, cls: 'text-warning' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        actions={LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-muted-bg"
          >
            {l.label}
          </Link>
        ))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            icon={kpi.icon}
            tone={kpi.cls}
            value={
              isLoading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted-bg" />
              ) : (
                formatMoney(kpi.value ?? 0)
              )
            }
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex items-center gap-2 text-[15px] font-bold">
          <Banknote className="h-4 w-4 text-muted" /> {t('chart.title')}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.series ?? []} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(m) => m.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 100)}`} />
              <Tooltip
                formatter={(value) => formatMoney(Number(value ?? 0))}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="income" name={t('chart.income')} fill="#16A34A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" name={t('chart.expense')} fill="#DC2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
