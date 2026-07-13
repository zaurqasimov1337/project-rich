'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, type Column } from '@/components/data-table';

interface Employee {
  id: string;
  position: string | null;
  contractType: string | null;
  salaryQepik: number;
  hiredAt: string | null;
  user: { firstName: string; lastName: string; email: string; phone: string | null } | null;
}

interface EmployeeForm {
  userId: string;
  position?: string;
  contractType?: string;
  salaryQepik?: number;
  hiredAt?: string;
}

const CONTRACT_LABELS: Record<string, string> = {
  full_time: 'Tam ştat',
  part_time: 'Yarım ştat',
  contract: 'Müqavilə',
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  });
  const { data: users } = useQuery({
    queryKey: ['users-for-hr'],
    queryFn: () => api.list<{ id: string; firstName: string; lastName: string }>('/users?limit=100'),
    enabled: drawerOpen,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeForm>();

  const createMutation = useMutation({
    mutationFn: (v: EmployeeForm) =>
      api.post('/employees', {
        ...v,
        salaryQepik: v.salaryQepik ? Math.round(Number(v.salaryQepik) * 100) : 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'İşçi',
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
    { key: 'position', header: 'Vəzifə', render: (r) => r.position ?? '—' },
    {
      key: 'contract',
      header: 'Müqavilə',
      render: (r) => (r.contractType ? CONTRACT_LABELS[r.contractType] : '—'),
    },
    { key: 'salary', header: 'Maaş', render: (r) => <span className="tabular-nums">{formatMoney(r.salaryQepik)}</span> },
    {
      key: 'hired',
      header: 'İşə qəbul',
      render: (r) => (r.hiredAt ? new Date(r.hiredAt).toLocaleDateString('az-Latn-AZ') : '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">İşçilər</h1>
          <Link href="/hr/leave" className="text-sm text-primary hover:underline">
            Məzuniyyət sorğuları →
          </Link>
        </div>
        {can('hr.employees.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> İşçi əlavə et
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        total={data?.length ?? 0}
        page={1}
        limit={100}
        onPageChange={() => {}}
        emptyTitle="Hələ işçi yoxdur"
        emptyDescription="İşçini əlavə etmək üçün əvvəlcə istifadəçi dəvət edin, sonra onu HR profili ilə əlaqələndirin."
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="İşçi əlavə et"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Ləğv et
            </Button>
            <Button loading={createMutation.isPending} onClick={handleSubmit((v) => createMutation.mutate(v))}>
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
            <Label>İstifadəçi *</Label>
            <Select
              placeholder="İstifadəçi seçin"
              error={errors.userId?.message}
              options={(users?.data ?? []).map((u) => ({
                value: u.id,
                label: `${u.firstName} ${u.lastName}`,
              }))}
              {...register('userId', { required: 'Tələb olunur' })}
            />
          </div>
          <div>
            <Label>Vəzifə</Label>
            <Input placeholder="Məs: Administrator" {...register('position')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Müqavilə tipi</Label>
              <Select
                placeholder="Seçin"
                options={Object.entries(CONTRACT_LABELS).map(([value, label]) => ({ value, label }))}
                {...register('contractType')}
              />
            </div>
            <div>
              <Label>Maaş (₼)</Label>
              <Input type="number" step="0.01" min={0} {...register('salaryQepik')} />
            </div>
          </div>
          <div>
            <Label>İşə qəbul tarixi</Label>
            <Input type="date" {...register('hiredAt')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
