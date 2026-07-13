'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';

interface LeaveRequest {
  id: string;
  employeeName: string;
  fromDate: string;
  toDate: string;
  type: string;
  reason: string | null;
  status: string;
}

interface LeaveForm {
  employeeId: string;
  fromDate: string;
  toDate: string;
  type: string;
  reason?: string;
}

const TYPE_LABELS: Record<string, string> = {
  vacation: 'Məzuniyyət',
  sick: 'Xəstəlik',
  unpaid: 'Ödənişsiz',
  other: 'Digər',
};
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Gözləyir',
  approved: 'Təsdiqlənib',
  rejected: 'Rədd edilib',
};

export default function LeavePage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => api.get<LeaveRequest[]>('/leave-requests'),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<{ id: string; user: { firstName: string; lastName: string } | null }[]>('/employees'),
    enabled: drawerOpen,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeaveForm>({
    defaultValues: { type: 'vacation' },
  });

  const createMutation = useMutation({
    mutationFn: (v: LeaveForm) => api.post('/leave-requests', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-requests'] });
      setDrawerOpen(false);
      reset();
    },
  });
  const decideMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.post(`/leave-requests/${id}/${action}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave-requests'] }),
  });

  return (
    <div className="space-y-4">
      <Link href="/hr/employees" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> İşçilər
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Məzuniyyət sorğuları</h1>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="h-4 w-4" /> Yeni sorğu
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted-bg" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">Sorğu yoxdur</div>
        ) : (
          <div className="divide-y divide-border">
            {data?.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className="font-medium">{r.employeeName}</span>
                  <span className="ml-2 text-sm text-muted">
                    {TYPE_LABELS[r.type]} · {new Date(r.fromDate).toLocaleDateString('az-Latn-AZ')} —{' '}
                    {new Date(r.toDate).toLocaleDateString('az-Latn-AZ')}
                  </span>
                  {r.reason && <div className="text-xs text-muted">{r.reason}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLS[r.status])}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {r.status === 'pending' && can('hr.leave.approve') && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Təsdiqlə"
                        onClick={() => decideMutation.mutate({ id: r.id, action: 'approve' })}
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Rədd et"
                        onClick={() => decideMutation.mutate({ id: r.id, action: 'reject' })}
                      >
                        <X className="h-4 w-4 text-danger" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Yeni məzuniyyət sorğusu"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Ləğv et
            </Button>
            <Button loading={createMutation.isPending} onClick={handleSubmit((v) => createMutation.mutate(v))}>
              Göndər
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>İşçi *</Label>
            <Select
              placeholder="İşçi seçin"
              error={errors.employeeId?.message}
              options={(employees ?? []).map((e) => ({
                value: e.id,
                label: e.user ? `${e.user.firstName} ${e.user.lastName}` : e.id,
              }))}
              {...register('employeeId', { required: 'Tələb olunur' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Başlanğıc *</Label>
              <Input type="date" {...register('fromDate', { required: true })} />
            </div>
            <div>
              <Label>Bitmə *</Label>
              <Input type="date" {...register('toDate', { required: true })} />
            </div>
          </div>
          <div>
            <Label>Tip</Label>
            <Select
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              {...register('type')}
            />
          </div>
          <div>
            <Label>Səbəb</Label>
            <Input {...register('reason')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
