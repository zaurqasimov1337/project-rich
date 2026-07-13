'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('platform');
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit', page],
    queryFn: () => platformApi.list<AuditRow>(`/platform/audit?page=${page}&limit=50`),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AuditRow>[] = [
    {
      key: 'time',
      header: tc('time'),
      render: (r) => (
        <span className="tabular-nums text-muted">
          {new Date(r.createdAt).toLocaleString('az-Latn-AZ')}
        </span>
      ),
    },
    { key: 'action', header: t('action'), render: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: 'target', header: t('target'), render: (r) => `${r.targetType ?? '—'} ${r.targetId?.slice(0, 8) ?? ''}` },
    { key: 'actor', header: t('actor'), render: (r) => <span className="font-mono text-xs">{r.actorId?.slice(0, 8) ?? '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('auditTitle')}</h1>
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={50}
        onPageChange={setPage}
        emptyTitle={t('noAuditRecords')}
      />
    </div>
  );
}
