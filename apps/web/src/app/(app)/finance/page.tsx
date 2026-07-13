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
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';

interface Summary {
  income: number;
  expense: number;
  profit: number;
  outstandingDebt: number;
  series: { month: string; income: number; expense: number }[];
}

const LINKS = [
  { href: '/finance/invoices', label: 'Fakturalar' },
  { href: '/finance/payments', label: 'Ödənişlər' },
  { href: '/finance/debts', label: 'Borclar' },
  { href: '/finance/expenses', label: 'Xərclər' },
  { href: '/finance/payroll', label: 'Əməkhaqqı' },
];

export default function FinancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => api.get<Summary>('/finance/summary?range=this_month'),
  });

  const kpis = [
    { label: 'Gəlir (bu ay)', value: data?.income, icon: ArrowUpRight, cls: 'text-success' },
    { label: 'Xərc (bu ay)', value: data?.expense, icon: ArrowDownRight, cls: 'text-danger' },
    { label: 'Mənfəət (bu ay)', value: data?.profit, icon: Wallet, cls: 'text-primary' },
    { label: 'Ümumi borc', value: data?.outstandingDebt, icon: AlertCircle, cls: 'text-warning' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Maliyyə</h1>
        <div className="flex gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-muted-bg"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted">{kpi.label}</span>
                <Icon className={`h-4 w-4 ${kpi.cls}`} />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {isLoading ? (
                  <div className="h-8 w-24 animate-pulse rounded bg-muted-bg" />
                ) : (
                  formatMoney(kpi.value ?? 0)
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-semibold">
          <Banknote className="h-4 w-4 text-muted" /> Son 12 ay — gəlir və xərc
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
              <Bar dataKey="income" name="Gəlir" fill="#16A34A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" name="Xərc" fill="#DC2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
