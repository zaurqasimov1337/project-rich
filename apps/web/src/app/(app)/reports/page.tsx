'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Filter,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';

interface ReportCard {
  key: string;
  name: string;
  icon: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  alert: AlertCircle,
  clipboard: ClipboardCheck,
  users: Users,
  user: User,
  book: BookOpen,
  filter: Filter,
};

export default function ReportsPage() {
  const t = useTranslations('reports');
  const can = useAuth((s) => s.can);
  const { data: catalog } = useQuery({
    queryKey: ['reports-catalog'],
    queryFn: () => api.get<ReportCard[]>('/reports/catalog'),
  });

  // A quick revenue snapshot on the landing page
  const { data: revenue } = useQuery({
    queryKey: ['report-revenue-snapshot'],
    queryFn: () =>
      api.get<{ totals: { income: number; expense: number; profit: number } }>(
        '/reports/revenue?range=this_month',
      ),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>

      {revenue?.totals && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            [t('monthIncome'), revenue.totals.income, 'text-success'],
            [t('monthExpense'), revenue.totals.expense, 'text-danger'],
            [t('monthProfit'), revenue.totals.profit, 'text-primary'],
          ].map(([label, val, cls]) => (
            <div key={label as string} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="text-[13px] font-medium text-muted">{label as string}</div>
              <div className={`mt-1.5 text-2xl font-bold tabular-nums ${cls as string}`}>
                {formatMoney(val as number)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog?.map((r) => {
          const Icon = ICONS[r.icon] ?? BarChart3;
          return (
            <Link
              key={r.key}
              href={`/reports/${r.key}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-primary"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{r.name}</div>
                {can('reports.export') && (
                  <div className="text-xs text-muted">{t('cardActions')}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
