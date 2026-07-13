'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
  student: { firstName: string; lastName: string; code: string } | null;
  invoice: { number: string } | null;
  cashAccount: { name: string };
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nağd',
  card: 'Kart',
  transfer: 'Köçürmə',
  online: 'Onlayn',
};

export default function PaymentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => api.list<PaymentRow>(`/payments?page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });

  const columns: Column<PaymentRow>[] = [
    {
      key: 'paidAt',
      header: 'Tarix',
      render: (r) => (
        <span className="tabular-nums">
          {new Date(r.paidAt).toLocaleDateString('az-Latn-AZ')}{' '}
          {new Date(r.paidAt).toTimeString().slice(0, 5)}
        </span>
      ),
    },
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
    {
      key: 'amount',
      header: 'Məbləğ',
      render: (r) => <span className="font-semibold text-success tabular-nums">{formatMoney(r.amount)}</span>,
    },
    { key: 'method', header: 'Üsul', render: (r) => METHOD_LABELS[r.method] ?? r.method },
    { key: 'invoice', header: 'Faktura', render: (r) => <span className="font-mono text-xs">{r.invoice?.number ?? '—'}</span> },
    { key: 'account', header: 'Kassa', render: (r) => r.cashAccount.name },
  ];

  return (
    <div className="space-y-4">
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Maliyyə
      </Link>
      <h1 className="text-xl font-bold">Ödənişlər</h1>
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyTitle="Ödəniş yoxdur"
      />
    </div>
  );
}
