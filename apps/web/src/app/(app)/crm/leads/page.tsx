'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, getAccessToken } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, type Column } from '@/components/data-table';

interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  value: number | null;
  stage: { id: string; name: string; color: string; isWon: boolean; isLost: boolean } | null;
  source: { id: string; name: string } | null;
  createdAt: string;
}
interface LeadForm {
  name: string;
  phone?: string;
  email?: string;
  sourceId?: string;
  notes?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

function money(v: number | null) {
  if (v == null) return '—';
  return (v / 100).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₼';
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function LeadsPage() {
  const t = useTranslations('crm');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stageId, setStageId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  const filterQs = `${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}${stageId ? `&stageId=${stageId}` : ''}${sourceId ? `&sourceId=${sourceId}` : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['crm-leads', page, debouncedSearch, stageId, sourceId],
    queryFn: () => api.list<LeadRow>(`/leads?page=${page}&limit=20${filterQs}`),
    placeholderData: keepPreviousData,
  });
  const { data: stages } = useQuery({
    queryKey: ['lead-stages'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/lead-stages'),
  });
  const { data: sources } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/lead-sources'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>();
  const createMutation = useMutation({
    mutationFn: (v: LeadForm) => api.post('/leads', { ...v, sourceId: v.sourceId || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['crm-leads'] });
      setDrawerOpen(false);
      reset();
    },
  });

  async function exportCsv() {
    const res = await fetch(`${BASE}/leads?page=1&limit=1000${filterQs}`, {
      credentials: 'include',
      headers: { ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}) },
    });
    const body = await res.json();
    const rows: LeadRow[] = body?.data ?? [];
    const header = [tc('name'), t('formPhone'), t('formEmail'), t('stage'), t('source'), t('value'), t('created')];
    const lines = rows.map((r) =>
      [r.name, r.phone ?? '', r.email ?? '', r.stage?.name ?? '', r.source?.name ?? '', r.value != null ? (r.value / 100).toFixed(2) : '', fmtDate(r.createdAt)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = '﻿' + [header.map((h) => `"${h}"`).join(','), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Column<LeadRow>[] = [
    {
      key: 'name',
      header: t('contact'),
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted">{r.phone ?? r.email ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: t('stage'),
      render: (r) =>
        r.stage ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted-bg px-2 py-0.5 text-xs font-medium">
            <span className="h-2 w-2 rounded-full" style={{ background: r.stage.color }} />
            {r.stage.name}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'source', header: t('source'), render: (r) => r.source?.name ?? '—' },
    { key: 'value', header: t('value'), render: (r) => <span className="tabular-nums">{money(r.value)}</span>, className: 'text-right' },
    { key: 'created', header: t('created'), render: (r) => <span className="text-muted">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t('leadsTitle')}</h1>
          <p className="mt-0.5 text-sm text-muted">{t('leadsCount', { count: data?.meta.total ?? 0 })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          {can('leads.create') && (
            <Button onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" /> {t('newLead')}
            </Button>
          )}
        </div>
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
        emptyTitle={tc('noResults')}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={stageId}
              onChange={(e) => {
                setStageId(e.target.value);
                setPage(1);
              }}
              placeholder={t('allStages')}
              options={(stages ?? []).map((s) => ({ value: s.id, label: s.name }))}
              className="w-44"
            />
            <Select
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setPage(1);
              }}
              placeholder={t('allSources')}
              options={(sources ?? []).map((s) => ({ value: s.id, label: s.name }))}
              className="w-44"
            />
          </div>
        }
      />

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
    </div>
  );
}
