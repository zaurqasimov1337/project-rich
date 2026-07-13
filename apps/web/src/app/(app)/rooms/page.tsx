'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
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
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/rooms'),
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/branches'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoomForm>();

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Otaqlar</h1>
        {can('rooms.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni otaq
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      ) : rooms?.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
          Hələ otaq yoxdur
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms?.map((room) => (
            <div key={room.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <DoorOpen className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold">{room.name}</div>
                    <div className="text-xs text-muted">
                      {room.branch.name}
                      {room.floor != null && ` · ${room.floor}-ci mərtəbə`}
                    </div>
                  </div>
                </div>
                <StatusBadge status={room.status} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Users className="h-4 w-4" /> Tutum: {room.capacity} nəfər
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
        title="Yeni otaq"
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
          <div>
            <Label>Filial *</Label>
            <Select
              placeholder="Filial seçin"
              error={errors.branchId?.message}
              options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              {...register('branchId', { required: 'Tələb olunur' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ad *</Label>
              <Input error={errors.name?.message} {...register('name', { required: 'Tələb olunur' })} />
            </div>
            <div>
              <Label>Nömrə</Label>
              <Input {...register('number')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tutum *</Label>
              <Input
                type="number"
                min={1}
                error={errors.capacity?.message}
                {...register('capacity', { required: 'Tələb olunur' })}
              />
            </div>
            <div>
              <Label>Mərtəbə</Label>
              <Input type="number" {...register('floor')} />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
