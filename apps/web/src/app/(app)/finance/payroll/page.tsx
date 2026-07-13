'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Run {
  id: string;
  period: string;
  status: string;
  total: number;
  _count: { items: number };
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
  }[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Qaralama', cls: 'bg-muted-bg text-muted' },
  approved: { label: 'Təsdiqlənib', cls: 'bg-info/10 text-info' },
  paid: { label: 'Ödənilib', cls: 'bg-success/10 text-success' },
};

export default function PayrollPage() {
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
    <div className="space-y-4">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Maliyyə
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Əməkhaqqı</h1>
        {can('finance.payroll.manage') && (
          <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Calculator className="h-4 w-4" /> Bu ay üçün hesabla
          </Button>
        )}
      </div>
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
              Hesablama yoxdur
            </div>
          )}
          {runs?.map((run) => {
            const st = STATUS_LABELS[run.status]!;
            return (
              <button
                key={run.id}
                onClick={() => setSelected(run.id)}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface p-3 text-left shadow-sm hover:border-primary',
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
                  {run._count.items} nəfər · {formatMoney(run.total)}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          {!detail ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
              Detala baxmaq üçün dövr seçin
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <span className="font-semibold">{detail.period}</span>{' '}
                  <span className="text-muted">— cəmi {formatMoney(detail.total)}</span>
                </div>
                {can('finance.payroll.manage') && (
                  <div className="flex gap-2">
                    {detail.status === 'draft' && (
                      <Button size="sm" loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
                        Təsdiqlə
                      </Button>
                    )}
                    {detail.status === 'approved' && (
                      <Button size="sm" loading={payMutation.isPending} onClick={() => payMutation.mutate()}>
                        Ödə
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted-bg/50 text-left text-muted">
                    <th className="px-4 py-2 font-semibold">Müəllim</th>
                    <th className="px-4 py-2 font-semibold">Dərslər</th>
                    <th className="px-4 py-2 font-semibold">Sabit</th>
                    <th className="px-4 py-2 font-semibold">Dərs haqqı</th>
                    <th className="px-4 py-2 text-right font-semibold">Cəmi</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{item.teacherName ?? '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{item.detail.lessons ?? 0}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(item.base)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(item.lessonPay)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatMoney(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
