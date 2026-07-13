'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';

interface Stage {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  stageId: string;
  value: number | null;
  source: { name: string } | null;
  createdAt: string;
}

interface BoardData {
  stages: Stage[];
  leads: Lead[];
  closedCounts: Record<string, number>;
}

interface LeadForm {
  name: string;
  phone?: string;
  email?: string;
  sourceId?: string;
  notes?: string;
}

export default function LeadsPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertGroupId, setConvertGroupId] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);

  const { data: board, isLoading } = useQuery({
    queryKey: ['leads-board'],
    queryFn: () => api.get<BoardData>('/leads/board'),
  });
  const { data: sources } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/lead-sources'),
    enabled: drawerOpen,
  });
  const { data: groups } = useQuery({
    queryKey: ['groups-options'],
    queryFn: () => api.list<{ id: string; name: string }>('/groups?limit=100&status=active'),
    enabled: !!convertLead,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>();

  const createMutation = useMutation({
    mutationFn: (v: LeadForm) => api.post('/leads', { ...v, sourceId: v.sourceId || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-board'] });
      setDrawerOpen(false);
      reset();
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      api.patch(`/leads/${leadId}/stage`, { stageId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leads-board'] }),
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      api.post(`/leads/${convertLead!.id}/convert`, {
        groupId: convertGroupId || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-board'] });
      void qc.invalidateQueries({ queryKey: ['students'] });
      setConvertLead(null);
      setConvertGroupId('');
    },
  });

  const openStages = board?.stages.filter((s) => !s.isWon && !s.isLost) ?? [];
  const closedStages = board?.stages.filter((s) => s.isWon || s.isLost) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">CRM — Müraciətlər</h1>
        {can('leads.create') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni müraciət
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${openStages.length}, minmax(240px, 1fr))` }}>
            {openStages.map((stage) => {
              const stageLeads = board?.leads.filter((l) => l.stageId === stage.id) ?? [];
              return (
                <div
                  key={stage.id}
                  className="rounded-xl border border-border bg-muted-bg/40"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragging) moveMutation.mutate({ leadId: dragging, stageId: stage.id });
                    setDragging(null);
                  }}
                >
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                    <span className="text-sm font-semibold">{stage.name}</span>
                    <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="min-h-[120px] space-y-2 p-2">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDragging(lead.id)}
                        className={cn(
                          'cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm active:cursor-grabbing',
                          dragging === lead.id && 'opacity-50',
                        )}
                      >
                        <div className="font-medium">{lead.name}</div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted">
                          <span className="flex items-center gap-1">
                            {lead.phone && (
                              <>
                                <Phone className="h-3 w-3" /> {lead.phone}
                              </>
                            )}
                          </span>
                          <span>{lead.source?.name}</span>
                        </div>
                        {can('leads.convert') && (
                          <button
                            onClick={() => setConvertLead(lead)}
                            className="mt-2 w-full rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                          >
                            Tələbəyə çevir
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 text-sm text-muted">
            {closedStages.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}: {board?.closedCounts[s.id] ?? 0}
              </span>
            ))}
          </div>
        </>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Yeni müraciət"
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
            <Label>Ad Soyad *</Label>
            <Input error={errors.name?.message} {...register('name', { required: 'Tələb olunur' })} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input placeholder="+994 50 123 45 67" {...register('phone')} />
          </div>
          <div>
            <Label>E-poçt</Label>
            <Input type="email" {...register('email')} />
          </div>
          <div>
            <Label>Mənbə</Label>
            <Select
              placeholder="Mənbə seçin"
              options={(sources ?? []).map((s) => ({ value: s.id, label: s.name }))}
              {...register('sourceId')}
            />
          </div>
          <div>
            <Label>Qeyd</Label>
            <Input {...register('notes')} />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={!!convertLead}
        onClose={() => setConvertLead(null)}
        title={`Tələbəyə çevir: ${convertLead?.name ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConvertLead(null)}>
              Ləğv et
            </Button>
            <Button loading={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
              Çevir
            </Button>
          </>
        }
      >
        {convertMutation.isError && (
          <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {(convertMutation.error as Error).message}
          </div>
        )}
        <Label>Qrupa yaz (opsional)</Label>
        <Select
          placeholder="Qrup seçin"
          value={convertGroupId}
          onChange={(e) => setConvertGroupId(e.target.value)}
          options={(groups?.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
      </Drawer>
    </div>
  );
}
