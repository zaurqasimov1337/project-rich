'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Phone, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

export default function PipelinePage() {
  const t = useTranslations('crm');
  const tc = useTranslations('common');
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
      api.post(`/leads/${convertLead!.id}/convert`, { groupId: convertGroupId || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-board'] });
      void qc.invalidateQueries({ queryKey: ['students'] });
      setConvertLead(null);
      setConvertGroupId('');
    },
  });

  const stages = board?.stages ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t('pipelineTitle')}</h1>
          <p className="mt-0.5 text-sm text-muted">{t('pipelineSubtitle')}</p>
        </div>
        {can('leads.create') && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" /> {t('newLead')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {stages.map((stage) => {
            const stageLeads = board?.leads.filter((l) => l.stageId === stage.id) ?? [];
            const isClosed = stage.isWon || stage.isLost;
            const count = isClosed ? (board?.closedCounts[stage.id] ?? 0) : stageLeads.length;
            return (
              <div
                key={stage.id}
                className="flex w-[280px] shrink-0 flex-col rounded-xl border border-dashed border-border bg-muted-bg/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging) moveMutation.mutate({ leadId: dragging, stageId: stage.id });
                  setDragging(null);
                }}
              >
                <div className="flex items-center gap-2 px-3 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                  <span className="text-sm font-semibold">{stage.name}</span>
                  <span className="ml-auto rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                    {count}
                  </span>
                </div>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragging(lead.id)}
                      className={cn(
                        'group cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing',
                        dragging === lead.id && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{lead.name}</div>
                          <div className="mt-0.5 truncate text-xs text-muted">
                            {lead.source?.name ?? t('assignedNone')}
                          </div>
                        </div>
                        <GripVertical className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Phone className="h-3 w-3" />
                          {lead.phone ?? '—'}
                        </span>
                        {can('leads.convert') && !isClosed && (
                          <button
                            onClick={() => setConvertLead(lead)}
                            className="rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                          >
                            {t('convert')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('newLead')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={handleSubmit((v) => createMutation.mutate(v))}>
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>{t('formName')} *</Label>
            <Input error={errors.name?.message} {...register('name', { required: tc('required') })} />
          </div>
          <div>
            <Label>{t('formPhone')}</Label>
            <Input placeholder="+994 50 123 45 67" {...register('phone')} />
          </div>
          <div>
            <Label>{t('formEmail')}</Label>
            <Input type="email" {...register('email')} />
          </div>
          <div>
            <Label>{t('formSource')}</Label>
            <Select
              placeholder={t('selectSource')}
              options={(sources ?? []).map((s) => ({ value: s.id, label: s.name }))}
              {...register('sourceId')}
            />
          </div>
          <div>
            <Label>{t('formNote')}</Label>
            <Input {...register('notes')} />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={!!convertLead}
        onClose={() => setConvertLead(null)}
        title={`${t('convertTitle')}: ${convertLead?.name ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConvertLead(null)}>
              {tc('cancel')}
            </Button>
            <Button loading={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
              {t('convert')}
            </Button>
          </>
        }
      >
        {convertMutation.isError && (
          <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {(convertMutation.error as Error).message}
          </div>
        )}
        <Label>{t('convertGroup')}</Label>
        <Select
          placeholder={t('selectGroup')}
          value={convertGroupId}
          onChange={(e) => setConvertGroupId(e.target.value)}
          options={(groups?.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
      </Drawer>
    </div>
  );
}
