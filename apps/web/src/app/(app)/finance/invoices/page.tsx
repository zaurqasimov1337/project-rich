'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface InvoiceRow {
  id: string;
  number: string;
  total: number;
  paid: number;
  status: string;
  dueAt: string;
  createdAt: string;
  note: string | null;
  student: { firstName: string; lastName: string; code: string } | null;
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search],
    queryFn: () =>
      api.list<InvoiceRow>(
        `/invoices?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return api.post<{ created: number; skipped: number }>('/invoices/generate', { period });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const columns: Column<InvoiceRow>[] = [
    { key: 'number', header: 'Nömrə', render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    {
      key: 'student',
      header: 'Tələbə',
      render: (r) =>
        r.student ? (
          <span className="font-medium">
            {r.student.firstName} {r.student.lastName}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'total', header: 'Məbləğ', render: (r) => <span className="tabular-nums">{formatMoney(r.total)}</span> },
    {
      key: 'paid',
      header: 'Ödənilib',
      render: (r) => (
        <span className={`tabular-nums ${r.paid >= r.total ? 'text-success' : ''}`}>
          {formatMoney(r.paid)}
        </span>
      ),
    },
    { key: 'due', header: 'Son tarix', render: (r) => new Date(r.dueAt).toLocaleDateString('az-Latn-AZ') },
    { key: 'note', header: 'Qeyd', render: (r) => <span className="text-muted">{r.note ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge
          status={
            r.status === 'paid' ? 'active' : r.status === 'overdue' ? 'cancelled' : r.status
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Maliyyə
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fakturalar</h1>
        {can('finance.invoices.manage') && (
          <Button loading={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
            <FileText className="h-4 w-4" /> Bu ayın fakturalarını yarat
          </Button>
        )}
      </div>
      {generateMutation.isSuccess && (
        <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {generateMutation.data.created} faktura yaradıldı, {generateMutation.data.skipped} artıq mövcud idi.
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        emptyTitle="Faktura yoxdur"
        emptyDescription="«Bu ayın fakturalarını yarat» düyməsi aktiv qeydiyyatlar üzrə aylıq fakturaları yaradır."
      />
    </div>
  );
}
