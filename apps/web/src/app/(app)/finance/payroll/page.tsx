'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

interface Run {
  id: string;
  period: string;
  status: string;
  total: number;
  _count: { items: number };
}

interface PayrollBreakdown {
  grossQepik: number;
  incomeTax: number;
  dsmfEmployee: number;
  unemploymentEmployee: number;
  healthEmployee: number;
  unionFee: number;
  totalEmployeeDeductions: number;
  netQepik: number;
  totalEmployerContributions: number;
  totalEmployerCost: number;
}

interface RunDetail {
  id: string;
  period: string;
  status: string;
  total: number;
  items: {
    id: string;
    teacherName: string | null;
    base: number;
    lessonPay: number;
    bonus: number;
    deduction: number;
    total: number;
    detail: { lessons?: number };
    breakdown?: PayrollBreakdown;
  }[];
  totals?: { gross: number; deductions: number; net: number; employerCost: number };
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Qaralama', cls: 'bg-muted-bg text-muted' },
  approved: { label: 'Təsdiqlənib', cls: 'bg-info/10 text-info' },
  paid: { label: 'Ödənilib', cls: 'bg-success/10 text-success' },
};

export default function PayrollPage() {
  const t = useTranslations('finance');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get<Run[]>('/payroll/runs'),
  });
  const { data: detail } = useQuery({
    queryKey: ['payroll-run', selected],
    queryFn: () => api.get<RunDetail>(`/payroll/runs/${selected}`),
    enabled: !!selected,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return api.post<{ id: string }>('/payroll/runs', { period });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      setSelected(data.id);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/payroll/runs/${selected}/approve`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      void qc.invalidateQueries({ queryKey: ['payroll-run', selected] });
    },
  });
  const payMutation = useMutation({
    mutationFn: () => api.post(`/payroll/runs/${selected}/pay`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      void qc.invalidateQueries({ queryKey: ['payroll-run', selected] });
      void qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
  });

  return (
    <div className="space-y-5">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('title')}
      </Link>
      <PageHeader
        title={t('payroll.title')}
        actions={
          can('finance.payroll.manage') && (
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              <Calculator className="h-4 w-4" /> {t('payroll.calculate')}
            </Button>
          )
        }
      />
      {createMutation.isError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {(createMutation.error as Error).message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {isLoading && <div className="h-20 animate-pulse rounded-xl bg-muted-bg" />}
          {runs?.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
              {t('payroll.noRuns')}
            </div>
          )}
          {runs?.map((run) => {
            const st = STATUS_LABELS[run.status]!;
            return (
              <button
                key={run.id}
                onClick={() => setSelected(run.id)}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface p-3 text-left shadow-[var(--shadow-sm)] hover:border-primary',
                  selected === run.id && 'border-primary ring-2 ring-primary/20',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold tabular-nums">{run.period}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>
                    {st.label}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {t('payroll.persons', { count: run._count.items })} · {formatMoney(run.total)}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          {!detail ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
              {t('payroll.selectPeriod')}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <span className="text-[15px] font-bold">{detail.period}</span>{' '}
                  <span className="text-muted">— {tc('total')} {formatMoney(detail.total)}</span>
                </div>
                {can('finance.payroll.manage') && (
                  <div className="flex gap-2">
                    {detail.status === 'draft' && (
                      <Button size="sm" loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
                        {t('payroll.approve')}
                      </Button>
                    )}
                    {detail.status === 'approved' && (
                      <Button size="sm" loading={payMutation.isPending} onClick={() => payMutation.mutate()}>
                        {t('payroll.pay')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-muted-bg/50 text-left text-muted">
                      <th className="px-4 py-2 font-semibold">{t('payroll.colTeacher')}</th>
                      <th className="px-4 py-2 font-semibold">{t('payroll.colLessons')}</th>
                      <th className="px-4 py-2 text-right font-semibold">Gross</th>
                      <th className="px-4 py-2 text-right font-semibold">Vergi + ayırmalar</th>
                      <th className="px-4 py-2 text-right font-semibold">Net (işçiyə çatan)</th>
                      <th className="px-4 py-2 text-right font-semibold">İşəgötürənə cəmi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium">{item.teacherName ?? '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums">{item.detail.lessons ?? 0}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(item.total)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-danger">
                          {item.breakdown ? formatMoney(item.breakdown.totalEmployeeDeductions) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-success">
                          {item.breakdown ? formatMoney(item.breakdown.netQepik) : formatMoney(item.total)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {item.breakdown ? formatMoney(item.breakdown.totalEmployerCost) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {detail.totals && (
                    <tfoot>
                      <tr className="border-t border-border bg-muted-bg/40 font-semibold">
                        <td className="px-4 py-2.5" colSpan={2}>{tc('total')}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(detail.totals.gross)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-danger">{formatMoney(detail.totals.deductions)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-success">{formatMoney(detail.totals.net)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(detail.totals.employerCost)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
