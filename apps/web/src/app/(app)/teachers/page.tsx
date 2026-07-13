'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { initials, formatMoney } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';

interface TeacherRow {
  id: string;
  user: { firstName: string; lastName: string; email: string; phone: string | null } | null;
  subjects: string[];
  maxWeeklyHours: number;
  activeGroups: { id: string; name: string }[];
  revenuePct: number;
  monthlyEarnings: number;
}

export default function TeachersPage() {
  const t = useTranslations('teachers');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['teachers', page, debouncedSearch],
    queryFn: () =>
      api.list<TeacherRow>(
        `/teachers?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const columns: Column<TeacherRow>[] = [
    {
      key: 'name',
      header: t('teacher'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials(r.user?.firstName, r.user?.lastName)}
          </span>
          <div>
            <div className="font-medium">
              {r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}
            </div>
            <div className="text-xs text-muted">{r.user?.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'subjects',
      header: t('specialty'),
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.subjects.length ? (
            r.subjects.map((s) => (
              <span key={s} className="rounded bg-muted-bg px-1.5 py-0.5 text-xs">
                {s}
              </span>
            ))
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'salaryModel',
      header: t('salaryModel'),
      render: (r) => <span className="tabular-nums">{r.revenuePct}%</span>,
    },
    {
      key: 'groups',
      header: t('activeGroups'),
      render: (r) => <span className="tabular-nums">{r.activeGroups.length}</span>,
    },
    {
      key: 'earnings',
      header: t('monthlyEarnings'),
      render: (r) => (
        <span className="font-semibold tabular-nums text-success">{formatMoney(r.monthlyEarnings)}</span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
      </div>
      <p className="text-sm text-muted">{t('inviteHint')}</p>
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
        emptyTitle={t('emptyTitle')}
      />
    </div>
  );
}
