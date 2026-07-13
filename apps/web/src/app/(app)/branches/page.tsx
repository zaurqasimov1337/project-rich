'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  roomCount: number;
}

interface BranchForm {
  name: string;
  address?: string;
  phone?: string;
}

export default function BranchesPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/branches'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchForm>();

  const createMutation = useMutation({
    mutationFn: (v: BranchForm) => api.post('/branches', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branches'] });
      setDrawerOpen(false);
      reset();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Filiallar</h1>
        {can('branches.manage') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni filial
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches?.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold">
                      {b.name}{' '}
                      {b.isMain && (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                          Əsas
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">{b.address ?? '—'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-muted">
                <span>{b.roomCount} otaq</span>
                {b.phone && <span>{b.phone}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Yeni filial"
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
            <Label>Ad *</Label>
            <Input error={errors.name?.message} {...register('name', { required: 'Tələb olunur' })} />
          </div>
          <div>
            <Label>Ünvan</Label>
            <Input {...register('address')} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input {...register('phone')} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
