'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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

interface CourseRow {
  id: string;
  name: string;
  level: string | null;
  price: number;
  pricingModel: string;
  status: string;
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
}

const PRICING_LABELS: Record<string, string> = {
  monthly: 'Aylıq',
  course: 'Kurs üzrə',
  lesson: 'Dərs üzrə',
};

export default function CoursesPage() {
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourseForm>({ defaultValues: { pricingModel: 'monthly' } });

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

  const columns: Column<CourseRow>[] = [
    { key: 'name', header: 'Kurs', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category', header: 'Kateqoriya', render: (r) => r.category?.name ?? '—' },
    { key: 'level', header: 'Səviyyə', render: (r) => r.level ?? '—' },
    {
      key: 'price',
      header: 'Qiymət',
      render: (r) => (
        <span className="tabular-nums">
          {formatMoney(r.price)}{' '}
          <span className="text-xs text-muted">({PRICING_LABELS[r.pricingModel]})</span>
        </span>
      ),
    },
    { key: 'groups', header: 'Aktiv qruplar', render: (r) => r.activeGroups },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kurslar</h1>
        {can('courses.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni kurs
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
        emptyTitle="Hələ kurs yoxdur"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Yeni kurs"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Ləğv et
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={handleSubmit((v) => createMutation.mutate(v))}
            >
              Yadda saxla
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
            <Label>Kursun adı *</Label>
            <Input error={errors.name?.message} {...register('name', { required: 'Tələb olunur' })} />
          </div>
          <div>
            <Label>Kateqoriya</Label>
            <Select
              placeholder="Kateqoriya seçin"
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId')}
            />
          </div>
          <div>
            <Label>Səviyyə</Label>
            <Input placeholder="Məs: B1, Başlanğıc" {...register('level')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Qiymət (₼) *</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                error={errors.price?.message}
                {...register('price', { required: 'Tələb olunur' })}
              />
            </div>
            <div>
              <Label>Qiymət modeli *</Label>
              <Select
                options={[
                  { value: 'monthly', label: 'Aylıq' },
                  { value: 'course', label: 'Kurs üzrə' },
                  { value: 'lesson', label: 'Dərs üzrə' },
                ]}
                {...register('pricingModel', { required: true })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Müddət (həftə)</Label>
              <Input type="number" min={1} {...register('durationWeeks')} />
            </div>
            <div>
              <Label>Default tutum</Label>
              <Input type="number" min={1} {...register('defaultCapacity')} />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
