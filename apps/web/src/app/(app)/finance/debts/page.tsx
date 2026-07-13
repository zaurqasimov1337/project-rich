'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface DebtRow {
  id: string;
  number: string;
  student: { id: string; firstName: string; lastName: string; code: string; phone: string | null } | null;
  total: number;
  paid: number;
  remaining: number;
  dueAt: string;
  status: string;
  overdueDays: number;
}

export default function DebtsPage() {
  const t = useTranslations('finance');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [payTarget, setPayTarget] = useState<DebtRow | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');

  const { data, isLoading } = useQuery({
    queryKey: ['debts', page],
    queryFn: () => api.list<DebtRow>(`/finance/debts?page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });

  const payMutation = useMutation({
    mutationFn: () =>
      api.raw('/payments', {
        method: 'POST',
        headers: { 'idempotency-key': `${payTarget!.id}-${Date.now()}` },
        body: JSON.stringify({
          studentId: payTarget!.student!.id,
          invoiceId: payTarget!.id,
          method,
          amount: Math.round(Number(amount) * 100),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['debts'] });
      void qc.invalidateQueries({ queryKey: ['finance-summary'] });
      setPayTarget(null);
      setAmount('');
    },
  });

  const columns: Column<DebtRow>[] = [
    { key: 'number', header: t('invoice'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    {
      key: 'student',
      header: t('student'),
      render: (r) =>
        r.student ? (
          <div>
            <div className="font-medium">
              {r.student.firstName} {r.student.lastName}
            </div>
            <div className="text-xs text-muted">{r.student.phone}</div>
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'remaining', header: t('debts.remaining'), render: (r) => (
      <span className="font-semibold text-danger tabular-nums">{formatMoney(r.remaining)}</span>
    ) },
    { key: 'paid', header: t('paid'), render: (r) => <span className="tabular-nums">{formatMoney(r.paid)}</span> },
    {
      key: 'due',
      header: t('dueDate'),
      render: (r) => (
        <div>
          <div className="tabular-nums">{new Date(r.dueAt).toLocaleDateString('az-Latn-AZ')}</div>
          {r.overdueDays > 0 && (
            <div className="text-xs text-danger">{t('debts.overdueDays', { days: r.overdueDays })}</div>
          )}
        </div>
      ),
    },
    { key: 'status', header: tc('status'), render: (r) => <StatusBadge status={r.status === 'overdue' ? 'cancelled' : r.status} /> },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        can('finance.payments.create') && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setPayTarget(r);
              setAmount(String(r.remaining / 100));
            }}
          >
            <Banknote className="h-3.5 w-3.5" /> {t('debts.receivePayment')}
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('title')}
      </Link>
      <h1 className="text-xl font-bold">{t('debts.title')}</h1>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyTitle={t('debts.emptyTitle')}
        emptyDescription={t('debts.emptyDescription')}
      />

      <Drawer
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={t('debts.payDrawerTitle', {
          name: `${payTarget?.student?.firstName ?? ''} ${payTarget?.student?.lastName ?? ''}`.trim(),
        })}
        footer={
          <>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={payMutation.isPending}
              disabled={!amount || Number(amount) <= 0}
              onClick={() => payMutation.mutate()}
            >
              {t('debts.acceptPayment')}
            </Button>
          </>
        }
      >
        {payMutation.isError && (
          <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {(payMutation.error as Error).message}
          </div>
        )}
        <div className="space-y-4">
          <div className="rounded-lg bg-muted-bg p-3 text-sm">
            {t('invoice')}: <span className="font-mono">{payTarget?.number}</span>
            <br />
            {t('debts.remaining')}:{' '}
            <span className="font-semibold text-danger">{formatMoney(payTarget?.remaining ?? 0)}</span>
          </div>
          <div>
            <Label>{t('amountManat')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('debts.methodLabel')}</Label>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={[
                { value: 'cash', label: t('methods.cash') },
                { value: 'card', label: t('methods.card') },
                { value: 'transfer', label: t('methods.transfer') },
                { value: 'online', label: t('methods.online') },
              ]}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
