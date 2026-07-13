'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { initials } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';

interface TeacherRow {
  id: string;
  user: { firstName: string; lastName: string; email: string; phone: string | null } | null;
  subjects: string[];
  maxWeeklyHours: number;
  activeGroups: { id: string; name: string }[];
}

export default function TeachersPage() {
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
      header: 'Müəllim',
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
      header: 'Fənlər',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.subjects.map((s) => (
            <span key={s} className="rounded bg-muted-bg px-1.5 py-0.5 text-xs">
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'groups',
      header: 'Aktiv qruplar',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.activeGroups.length ? (
            r.activeGroups.map((g) => (
              <span key={g.id} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                {g.name}
              </span>
            ))
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      ),
    },
    { key: 'hours', header: 'Həftəlik limit', render: (r) => `${r.maxWeeklyHours} saat` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Müəllimlər</h1>
      </div>
      <p className="text-sm text-muted">
        Müəllim əlavə etmək üçün əvvəlcə Parametrlər → İstifadəçilər bölməsindən «teacher» rolu ilə
        istifadəçi dəvət edin, sonra onu müəllim profili ilə əlaqələndirin.
      </p>
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
        emptyTitle="Hələ müəllim yoxdur"
      />
    </div>
  );
}
