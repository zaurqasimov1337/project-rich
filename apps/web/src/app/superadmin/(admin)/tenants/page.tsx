'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { platformApi } from '@/lib/platform';
import { useDebounced } from '@/lib/hooks';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  trialEndsAt: string | null;
  plan: { code: string; name: string } | null;
  studentCount: number;
  userCount: number;
}

export default function TenantsPage() {
  const t = useTranslations('platform');
  const tc = useTranslations('common');
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-tenants', page, debouncedSearch],
    queryFn: () =>
      platformApi.list<TenantRow>(
        `/platform/tenants?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const columns: Column<TenantRow>[] = [
    {
      key: 'name',
      header: t('center'),
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="font-mono text-xs text-muted">{r.slug}</div>
        </div>
      ),
    },
    { key: 'plan', header: t('plan'), render: (r) => r.plan?.name ?? '—' },
    { key: 'students', header: t('studentsCol'), render: (r) => <span className="tabular-nums">{r.studentCount}</span> },
    { key: 'users', header: t('usersCol'), render: (r) => <span className="tabular-nums">{r.userCount}</span> },
    {
      key: 'created',
      header: t('registered'),
      render: (r) => <span className="tabular-nums">{new Date(r.createdAt).toLocaleDateString('az-Latn-AZ')}</span>,
    },
    { key: 'status', header: tc('status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('centersTitle')}</h1>
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
        onRowClick={(r) => router.push(`/superadmin/tenants/${r.id}`)}
        emptyTitle={t('noCenters')}
      />
    </div>
  );
}
