'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/data-table';

interface Room {
  id: string;
  name: string;
  number: string | null;
  capacity: number;
  floor: number | null;
  equipment: string[];
  status: string;
  branch: { id: string; name: string };
}

interface RoomForm {
  branchId: string;
  name: string;
  number?: string;
  capacity: number;
  floor?: number;
}

export default function RoomsPage() {
  const t = useTranslations('rooms');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/rooms'),
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/branches'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoomForm>();

  const roomCountByBranch = (rooms ?? []).reduce<Record<string, number>>((acc, room) => {
    acc[room.branch.id] = (acc[room.branch.id] ?? 0) + 1;
    return acc;
  }, {});
  const filteredRooms =
    branchFilter == null ? rooms : rooms?.filter((room) => room.branch.id === branchFilter);
  const showBranchTabs = (branches?.length ?? 0) > 0;

  const createMutation = useMutation({
    mutationFn: (v: RoomForm) =>
      api.post('/rooms', {
        ...v,
        capacity: Number(v.capacity),
        floor: v.floor ? Number(v.floor) : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      setDrawerOpen(false);
      reset();
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        actions={
          can('rooms.manage') && (
            <Button onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" /> {t('newRoom')}
            </Button>
          )
        }
      />

      {showBranchTabs && (
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setBranchFilter(null)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              branchFilter == null
                ? 'bg-muted-bg font-semibold text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Hamısı
            <span className="ml-1.5 rounded bg-muted-bg px-1.5 py-0.5 text-xs">
              {rooms?.length ?? 0}
            </span>
          </button>
          {branches?.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchFilter(b.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                branchFilter === b.id
                  ? 'bg-muted-bg font-semibold text-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {b.name}
              <span className="ml-1.5 rounded bg-muted-bg px-1.5 py-0.5 text-xs">
                {roomCountByBranch[b.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      ) : filteredRooms?.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
          <EmptyState icon={DoorOpen} title={t('noRooms')} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms?.map((room) => (
            <div key={room.id} className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <DoorOpen className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold">{room.name}</div>
                    <div className="text-xs text-muted">
                      {room.branch.name}
                      {room.floor != null && ` · ${t('floorLabel', { floor: room.floor })}`}
                    </div>
                  </div>
                </div>
                <StatusBadge status={room.status} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Users className="h-4 w-4" /> {t('capacityValue', { count: room.capacity })}
              </div>
              {room.equipment.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {room.equipment.map((e) => (
                    <span key={e} className="rounded bg-muted-bg px-1.5 py-0.5 text-xs">
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('newRoom')}
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
          <div>
            <Label>{t('branch')} *</Label>
            <Select
              placeholder={t('selectBranch')}
              error={errors.branchId?.message}
              options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              {...register('branchId', { required: tc('required') })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tc('name')} *</Label>
              <Input error={errors.name?.message} {...register('name', { required: tc('required') })} />
            </div>
            <div>
              <Label>{t('number')}</Label>
              <Input {...register('number')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('capacity')} *</Label>
              <Input
                type="number"
                min={1}
                error={errors.capacity?.message}
                {...register('capacity', { required: tc('required') })}
              />
            </div>
            <div>
              <Label>{t('floor')}</Label>
              <Input type="number" {...register('floor')} />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
