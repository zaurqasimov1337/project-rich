'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDebounced } from '@/lib/hooks';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface GroupRow {
  id: string;
  name: string;
  status: string;
  capacity: number;
  activeStudents: number;
  fillRate: number;
  startDate: string | null;
  course: { id: string; name: string; price: number };
  priceOverride: number | null;
  teacherName: string | null;
  monthlyRevenue: number;
}

interface GroupForm {
  name: string;
  courseId: string;
  branchId: string;
  teacherId?: string;
  roomId?: string;
  capacity?: number;
  startDate?: string;
}

export default function GroupsPage() {
  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['groups', page, debouncedSearch],
    queryFn: () =>
      api.list<GroupRow>(
        `/groups?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const { data: courses } = useQuery({
    queryKey: ['courses-options'],
    queryFn: () => api.list<{ id: string; name: string }>('/courses?limit=100'),
    enabled: drawerOpen,
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/branches'),
    enabled: drawerOpen,
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers-options'],
    queryFn: () =>
      api.list<{ id: string; user: { firstName: string; lastName: string } | null }>(
        '/teachers?limit=100',
      ),
    enabled: drawerOpen,
  });
  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<{ id: string; name: string; branch: { name: string } }[]>('/rooms'),
    enabled: drawerOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GroupForm>();

  const createMutation = useMutation({
    mutationFn: (values: GroupForm) =>
      api.post('/groups', {
        ...values,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        teacherId: values.teacherId || undefined,
        roomId: values.roomId || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const columns: Column<GroupRow>[] = [
    { key: 'name', header: t('group'), render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'course', header: t('course'), render: (r) => r.course.name },
    { key: 'teacher', header: t('teacher'), render: (r) => r.teacherName ?? '—' },
    {
      key: 'fill',
      header: t('students'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted-bg">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(r.fillRate, 100)}%` }}
            />
          </div>
          <span className="tabular-nums text-muted">
            {r.activeStudents}/{r.capacity}
          </span>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: t('monthlyRevenue'),
      render: (r) => (
        <span className="font-semibold tabular-nums text-success">{formatMoney(r.monthlyRevenue)}</span>
      ),
      className: 'text-right',
    },
    { key: 'status', header: tc('status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        {can('groups.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> {t('new')}
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
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onRowClick={(r) => router.push(`/groups/${r.id}`)}
        emptyTitle={t('empty')}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('new')}
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
          <div>
            <Label>{t('groupName')} *</Label>
            <Input
              placeholder={t('groupNamePlaceholder')}
              error={errors.name?.message}
              {...register('name', { required: tc('required') })}
            />
          </div>
          <div>
            <Label>{t('course')} *</Label>
            <Select
              placeholder={t('selectCourse')}
              error={errors.courseId?.message}
              options={(courses?.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...register('courseId', { required: tc('required') })}
            />
          </div>
          <div>
            <Label>{t('branch')} *</Label>
            <Select
              placeholder={t('selectBranch')}
              error={errors.branchId?.message}
              options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              {...register('branchId', { required: tc('required') })}
            />
          </div>
          <div>
            <Label>{t('teacher')}</Label>
            <Select
              placeholder={t('selectTeacher')}
              options={(teachers?.data ?? []).map((teacher) => ({
                value: teacher.id,
                label: teacher.user
                  ? `${teacher.user.firstName} ${teacher.user.lastName}`
                  : teacher.id,
              }))}
              {...register('teacherId')}
            />
          </div>
          <div>
            <Label>{t('room')}</Label>
            <Select
              placeholder={t('selectRoom')}
              options={(rooms ?? []).map((r) => ({
                value: r.id,
                label: `${r.name} (${r.branch.name})`,
              }))}
              {...register('roomId')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('capacity')}</Label>
              <Input type="number" min={1} {...register('capacity')} />
            </div>
            <div>
              <Label>{t('startDate')}</Label>
              <Input type="date" {...register('startDate')} />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
