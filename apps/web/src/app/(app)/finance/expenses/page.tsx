'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
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
  vendor: string | null;
  note: string | null;
  category: { name: string };
  cashAccount: { name: string };
}

interface ExpenseForm {
  categoryId: string;
  amount: number;
  date: string;
  vendor?: string;
  note?: string;
}

export default function ExpensesPage() {
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (v: ExpenseForm) =>
      api.post('/expenses', { ...v, amount: Math.round(Number(v.amount) * 100) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['finance-summary'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const columns: Column<ExpenseRow>[] = [
    { key: 'date', header: 'Tarix', render: (r) => new Date(r.date).toLocaleDateString('az-Latn-AZ') },
    { key: 'category', header: 'Kateqoriya', render: (r) => r.category.name },
    {
      key: 'amount',
      header: 'Məbləğ',
      render: (r) => <span className="font-semibold text-danger tabular-nums">−{formatMoney(r.amount)}</span>,
    },
    { key: 'vendor', header: 'Təchizatçı', render: (r) => r.vendor ?? '—' },
    { key: 'note', header: 'Qeyd', render: (r) => <span className="text-muted">{r.note ?? '—'}</span> },
    { key: 'account', header: 'Kassa', render: (r) => r.cashAccount.name },
  ];

  return (
    <div className="space-y-4">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Maliyyə
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Xərclər</h1>
        {can('finance.expenses.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni xərc
          </Button>
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
        emptyTitle="Xərc yoxdur"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Yeni xərc"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Ləğv et
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={handleSubmit((v) => createMutation.mutate(v))}
            >
              Yadda saxla
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>Kateqoriya *</Label>
            <Select
              placeholder="Kateqoriya seçin"
              error={errors.categoryId?.message}
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId', { required: 'Tələb olunur' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Məbləğ (₼) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                error={errors.amount?.message}
                {...register('amount', { required: 'Tələb olunur' })}
              />
            </div>
            <div>
              <Label>Tarix *</Label>
              <Input type="date" {...register('date', { required: true })} />
            </div>
          </div>
          <div>
            <Label>Təchizatçı</Label>
            <Input {...register('vendor')} />
          </div>
          <div>
            <Label>Qeyd</Label>
            <Input {...register('note')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
