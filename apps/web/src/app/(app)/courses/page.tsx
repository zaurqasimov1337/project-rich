'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDebounced } from '@/lib/hooks';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface CourseRow {
  id: string;
  name: string;
  level: string | null;
  price: number;
  pricingModel: string;
  status: string;
  format: string;
  durationWeeks: number | null;
  activeGroups: number;
  category: { id: string; name: string } | null;
}

interface CourseForm {
  name: string;
  categoryId?: string;
  level?: string;
  pricingModel: string;
  price: number;
  durationWeeks?: number;
  defaultCapacity?: number;
  format?: string;
}

export default function CoursesPage() {
  const t = useTranslations('courses');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['courses', page, debouncedSearch],
    queryFn: () =>
      api.list<CourseRow>(
        `/courses?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const { data: categories } = useQuery({
    queryKey: ['course-categories'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/course-categories'),
    enabled: drawerOpen,
  });

  // Sales view (merged from CRM trainings): lead + registration counts per course.
  const { data: salesStats } = useQuery({
    queryKey: ['sales-trainings'],
    queryFn: () => api.get<{ id: string; leadCount: number; registeredCount: number }[]>('/sales/trainings'),
    enabled: can('leads.read'),
  });
  const statsMap = new Map((salesStats ?? []).map((s) => [s.id, s]));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourseForm>({ defaultValues: { pricingModel: 'monthly', format: 'offline' } });

  const createMutation = useMutation({
    mutationFn: (v: CourseForm) =>
      api.post('/courses', {
        ...v,
        price: Math.round(Number(v.price) * 100),
        durationWeeks: v.durationWeeks ? Number(v.durationWeeks) : undefined,
        defaultCapacity: v.defaultCapacity ? Number(v.defaultCapacity) : undefined,
        categoryId: v.categoryId || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['courses'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const pricingLabels: Record<string, string> = {
    monthly: t('pricingMonthly'),
    course: t('pricingCourse'),
    lesson: t('pricingLesson'),
  };

  const columns: Column<CourseRow>[] = [
    { key: 'name', header: t('course'), render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category', header: tc('category'), render: (r) => r.category?.name ?? '—' },
    { key: 'duration', header: t('duration'), render: (r) => (r.durationWeeks ? `${r.durationWeeks} həftə` : '—') },
    {
      key: 'price',
      header: tc('price'),
      render: (r) => (
        <span className="tabular-nums">
          {formatMoney(r.price)}{' '}
          <span className="text-xs text-muted">({pricingLabels[r.pricingModel]})</span>
        </span>
      ),
    },
    {
      key: 'format',
      header: t('format'),
      render: (r) => (
        <span className="inline-flex rounded-full bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted">
          {r.format === 'online' ? t('formatOnline') : r.format === 'hybrid' ? t('formatHybrid') : t('formatOffline')}
        </span>
      ),
    },
    { key: 'groups', header: t('activeGroups'), render: (r) => r.activeGroups },
    ...(can('leads.read')
      ? ([
          {
            key: 'leads',
            header: 'Lead',
            render: (r) => <span className="font-mono tabular-nums">{statsMap.get(r.id)?.leadCount ?? 0}</span>,
          },
          {
            key: 'registered',
            header: 'Qeyd.',
            render: (r) => (
              <span className="font-mono tabular-nums text-success">{statsMap.get(r.id)?.registeredCount ?? 0}</span>
            ),
          },
        ] as Column<CourseRow>[])
      : []),
    { key: 'status', header: tc('status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        actions={
          can('courses.manage') && (
            <Button onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" /> {t('new')}
            </Button>
          )
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
            <Label>{t('courseName')} *</Label>
            <Input error={errors.name?.message} {...register('name', { required: tc('required') })} />
          </div>
          <div>
            <Label>{tc('category')}</Label>
            <Select
              placeholder={t('selectCategory')}
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId')}
            />
          </div>
          <div>
            <Label>{t('level')}</Label>
            <Input placeholder={t('levelPlaceholder')} {...register('level')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tc('price')} (₼) *</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                error={errors.price?.message}
                {...register('price', { required: tc('required') })}
              />
            </div>
            <div>
              <Label>{t('pricingModel')} *</Label>
              <Select
                options={[
                  { value: 'monthly', label: t('pricingMonthly') },
                  { value: 'course', label: t('pricingCourse') },
                  { value: 'lesson', label: t('pricingLesson') },
                ]}
                {...register('pricingModel', { required: true })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('durationWeeks')}</Label>
              <Input type="number" min={1} {...register('durationWeeks')} />
            </div>
            <div>
              <Label>{t('defaultCapacity')}</Label>
              <Input type="number" min={1} {...register('defaultCapacity')} />
            </div>
          </div>
          <div>
            <Label>{t('format')}</Label>
            <Select
              options={[
                { value: 'offline', label: t('formatOffline') },
                { value: 'online', label: t('formatOnline') },
                { value: 'hybrid', label: t('formatHybrid') },
              ]}
              {...register('format')}
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
