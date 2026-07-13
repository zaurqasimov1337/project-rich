'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { platformApi } from '@/lib/platform';
import { DataTable, type Column } from '@/components/data-table';

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export default function PlatformAuditPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit', page],
    queryFn: () => platformApi.list<AuditRow>(`/platform/audit?page=${page}&limit=50`),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AuditRow>[] = [
    {
      key: 'time',
      header: 'Vaxt',
      render: (r) => (
        <span className="tabular-nums text-muted">
          {new Date(r.createdAt).toLocaleString('az-Latn-AZ')}
        </span>
      ),
    },
    { key: 'action', header: 'Əməliyyat', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: 'target', header: 'Hədəf', render: (r) => `${r.targetType ?? '—'} ${r.targetId?.slice(0, 8) ?? ''}` },
    { key: 'actor', header: 'İcraçı', render: (r) => <span className="font-mono text-xs">{r.actorId?.slice(0, 8) ?? '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Platform audit jurnalı</h1>
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={50}
        onPageChange={setPage}
        emptyTitle="Audit qeydi yoxdur"
      />
    </div>
  );
}
