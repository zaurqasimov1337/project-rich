'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/export-menu';
import { PageHeader } from '@/components/ui/page-header';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface StudentRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  groups: { id: string; name: string }[];
  monthlyFee: number;
  totalDue: number;
  totalPaid: number;
  createdAt: string;
}

interface StudentForm {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  parentName?: string;
  parentPhone?: string;
  branchId?: string;
}

export default function StudentsPage() {
  const t = useTranslations('students');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, debouncedSearch],
    queryFn: () =>
      api.list<StudentRow>(
        `/students?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/branches'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StudentForm>();

  const createMutation = useMutation({
    mutationFn: (values: StudentForm) => api.post('/students', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const columns: Column<StudentRow>[] = [
    { key: 'code', header: t('code'), render: (r) => <span className="font-mono text-muted">{r.code}</span> },
    {
      key: 'name',
      header: tc('fullName'),
      render: (r) => (
        <span className="font-medium">
          {r.firstName} {r.lastName}
        </span>
      ),
    },
    { key: 'phone', header: tc('phone'), render: (r) => r.phone ?? '—' },
    {
      key: 'groups',
      header: t('groups'),
      render: (r) =>
        r.groups.length ? (
          <div className="flex flex-wrap gap-1">
            {r.groups.map((g) => (
              <span key={g.id} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                {g.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'payments',
      header: 'Ödəniş',
      className: 'min-w-[160px]',
      render: (r) => {
        if (r.totalDue <= 0 && r.totalPaid <= 0) return <span className="text-muted">—</span>;
        const pct = r.totalDue > 0 ? Math.min(100, Math.round((r.totalPaid / r.totalDue) * 100)) : 100;
        const full = r.totalDue > 0 && r.totalPaid >= r.totalDue;
        return (
          <div className="tabular-nums">
            <div className="flex items-baseline justify-between gap-2">
              <span className={full ? 'font-semibold text-success' : 'font-semibold'}>
                {formatMoney(r.totalPaid)}
                <span className="font-normal text-muted"> / {formatMoney(r.totalDue)}</span>
              </span>
              <span className="text-xs text-muted">{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted-bg">
              <div
                className={full ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-primary'}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'monthly',
      header: 'Aylıq',
      render: (r) => (r.monthlyFee > 0 ? <span className="tabular-nums">{formatMoney(r.monthlyFee)}</span> : '—'),
    },
    { key: 'status', header: tc('status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        actions={
          <>
            {can('students.read') && (
              <ExportMenu
                urlFor={(f) => `/api/v1/students/export.${f}`}
                filenameFor={(f) => `students.${f}`}
              />
            )}
            {can('students.create') && (
              <Button onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" /> {t('newStudent')}
              </Button>
            )}
          </>
        }
      />

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
        onRowClick={(r) => router.push(`/students/${r.id}`)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('newStudent')}
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
          {createMutation.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(createMutation.error as Error).message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tc('firstName')} *</Label>
              <Input error={errors.firstName?.message} {...register('firstName', { required: tc('required') })} />
            </div>
            <div>
              <Label>{tc('lastName')} *</Label>
              <Input error={errors.lastName?.message} {...register('lastName', { required: tc('required') })} />
            </div>
          </div>
          <div>
            <Label>{tc('phone')}</Label>
            <Input placeholder="+994 50 123 45 67" {...register('phone')} />
          </div>
          <div>
            <Label>{tc('email')}</Label>
            <Input type="email" {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('parentName')}</Label>
              <Input {...register('parentName')} />
            </div>
            <div>
              <Label>{t('parentPhone')}</Label>
              <Input {...register('parentPhone')} />
            </div>
          </div>
          <div>
            <Label>{t('branch')}</Label>
            <Select
              placeholder={t('selectBranch')}
              options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              {...register('branchId')}
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
