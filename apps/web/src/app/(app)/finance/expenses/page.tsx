'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, type Column } from '@/components/data-table';

interface ExpenseRow {
  id: string;
  amount: number;
  date: string;
  recurring: boolean;
  vendor: string | null;
  note: string | null;
  category: { name: string };
  cashAccount: { name: string };
}

interface ExpenseForm {
  categoryId: string;
  amount: number;
  date: string;
  recurring?: string;
  vendor?: string;
  note?: string;
}

export default function ExpensesPage() {
  const t = useTranslations('finance');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page],
    queryFn: () => api.list<ExpenseRow>(`/expenses?page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });
  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/expense-categories'),
    enabled: drawerOpen,
  });
  const { data: summary } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: () =>
      api.get<{
        recurring: number;
        oneTime: number;
        metaAds: { total: number; instagram: number; currency: string } | null;
      }>('/expenses/summary'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), recurring: 'true' },
  });

  const createMutation = useMutation({
    mutationFn: (v: ExpenseForm) =>
      api.post('/expenses', {
        ...v,
        amount: Math.round(Number(v.amount) * 100),
        recurring: v.recurring === 'true',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['expenses-summary'] });
      void qc.invalidateQueries({ queryKey: ['finance-summary'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const columns: Column<ExpenseRow>[] = [
    { key: 'date', header: tc('date'), render: (r) => new Date(r.date).toLocaleDateString('az-Latn-AZ') },
    { key: 'category', header: tc('category'), render: (r) => r.category.name },
    {
      key: 'amount',
      header: tc('amount'),
      render: (r) => <span className="font-semibold text-danger tabular-nums">−{formatMoney(r.amount)}</span>,
    },
    {
      key: 'recurring',
      header: t('expenses.frequency'),
      render: (r) => (
        <span className="inline-flex rounded-full bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted">
          {r.recurring ? t('expenses.recurring') : t('expenses.oneTime')}
        </span>
      ),
    },
    { key: 'vendor', header: t('vendor'), render: (r) => r.vendor ?? '—' },
    { key: 'note', header: tc('notes'), render: (r) => <span className="text-muted">{r.note ?? '—'}</span> },
    { key: 'account', header: t('cashAccount'), render: (r) => r.cashAccount.name },
  ];

  return (
    <div className="space-y-4">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('title')}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('expenses.title')}</h1>
        {can('finance.expenses.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> {t('expenses.newExpense')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('expenses.recurringExpenses')}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-danger">
            {formatMoney(summary?.recurring ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('expenses.oneTimeExpenses')}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(summary?.oneTime ?? 0)}</div>
        </div>
        {summary?.metaAds && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t('expenses.adSpendMonth')}
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t('expenses.live')}
              </span>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-danger">
              {formatMoney(summary.metaAds.total, summary.metaAds.currency)}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              Instagram: {formatMoney(summary.metaAds.instagram, summary.metaAds.currency)}
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyTitle={t('expenses.emptyTitle')}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('expenses.newExpense')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={handleSubmit((v) => createMutation.mutate(v))}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>{tc('category')} *</Label>
            <Select
              placeholder={t('expenses.selectCategory')}
              error={errors.categoryId?.message}
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId', { required: tc('required') })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('amountManat')} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                error={errors.amount?.message}
                {...register('amount', { required: tc('required') })}
              />
            </div>
            <div>
              <Label>{tc('date')} *</Label>
              <Input type="date" {...register('date', { required: true })} />
            </div>
          </div>
          <div>
            <Label>{t('expenses.frequency')}</Label>
            <Select
              options={[
                { value: 'true', label: t('expenses.recurring') },
                { value: 'false', label: t('expenses.oneTime') },
              ]}
              {...register('recurring')}
            />
          </div>
          <div>
            <Label>{t('vendor')}</Label>
            <Input {...register('vendor')} />
          </div>
          <div>
            <Label>{tc('notes')}</Label>
            <Input {...register('note')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
