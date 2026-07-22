'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, StatusBadge, type Column } from '@/components/data-table';

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  budget: number;
  spent: number;
  startAt: string;
  status: string;
}

interface Metrics {
  totalSpend: number;
  totalLeads: number;
  wonLeads: number;
  cpl: number;
  cac: number;
  roas: number | null;
  bySource: { source: string; leads: number }[];
  metaAds: {
    total: number;
    instagram: number;
    facebook: number;
    impressions: number;
    clicks: number;
    currency: string;
    byCampaign: { name: string; spend: number }[];
  } | null;
  instagram: {
    username?: string;
    followers?: number;
    reach?: number;
    profileViews?: number;
    accountsEngaged?: number;
    interactions?: number;
    leadsFromInstagram: number;
  } | null;
}

interface CampaignForm {
  name: string;
  channel: string;
  budget?: number;
  startAt: string;
}

interface SpendForm {
  campaignId?: string;
  channel: string;
  amount: number;
  date: string;
}

export default function CampaignsPage() {
  const t = useTranslations('marketing');
  const tc = useTranslations('common');
  const CHANNEL_LABELS: Record<string, string> = {
    meta: 'Meta',
    google: 'Google',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    offline: t('channel.offline'),
    other: t('channel.other'),
  };
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page],
    queryFn: () => api.list<CampaignRow>(`/campaigns?page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });
  const { data: metrics } = useQuery({
    queryKey: ['marketing-metrics'],
    queryFn: () => api.get<Metrics>('/marketing/metrics?range=this_month'),
  });

  const campaignForm = useForm<CampaignForm>({
    defaultValues: { channel: 'meta', startAt: new Date().toISOString().slice(0, 10) },
  });
  const spendForm = useForm<SpendForm>({
    defaultValues: { channel: 'meta', date: new Date().toISOString().slice(0, 10) },
  });

  const createCampaign = useMutation({
    mutationFn: (v: CampaignForm) =>
      api.post('/campaigns', {
        ...v,
        budget: v.budget ? Math.round(Number(v.budget) * 100) : 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      setCampaignOpen(false);
      campaignForm.reset();
    },
  });

  const addSpend = useMutation({
    mutationFn: (v: SpendForm) =>
      api.post('/ad-spends', {
        ...v,
        campaignId: v.campaignId || undefined,
        amount: Math.round(Number(v.amount) * 100),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      void qc.invalidateQueries({ queryKey: ['marketing-metrics'] });
      setSpendOpen(false);
      spendForm.reset();
    },
  });

  const kpis = [
    { label: t('adSpendMonth'), value: metrics ? formatMoney(metrics.totalSpend) : '—' },
    { label: t('leads'), value: metrics?.totalLeads ?? '—' },
    { label: 'CPL', value: metrics ? formatMoney(metrics.cpl) : '—' },
    { label: 'CAC', value: metrics ? formatMoney(metrics.cac) : '—' },
    { label: 'ROAS', value: metrics?.roas != null ? `${metrics.roas}x` : '—' },
  ];

  const columns: Column<CampaignRow>[] = [
    { key: 'name', header: t('campaign'), render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'channel', header: t('channelHeader'), render: (r) => CHANNEL_LABELS[r.channel] ?? r.channel },
    { key: 'budget', header: t('budget'), render: (r) => <span className="tabular-nums">{formatMoney(r.budget)}</span> },
    {
      key: 'spent',
      header: t('spent'),
      render: (r) => (
        <span className={`tabular-nums ${r.budget > 0 && r.spent > r.budget ? 'text-danger' : ''}`}>
          {formatMoney(r.spent)}
        </span>
      ),
    },
    { key: 'start', header: t('startHeader'), render: (r) => new Date(r.startAt).toLocaleDateString('az-Latn-AZ') },
    { key: 'status', header: tc('status'), render: (r) => <StatusBadge status={r.status === 'paused' ? 'frozen' : r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        {can('marketing.manage') && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSpendOpen(true)}>
              {t('addSpend')}
            </Button>
            <Button onClick={() => setCampaignOpen(true)}>
              <Plus className="h-4 w-4" /> {t('newCampaign')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="text-[13px] font-medium text-muted">{kpi.label}</div>
            <div className="mt-1.5 text-xl font-bold tabular-nums">{kpi.value}</div>
          </div>
        ))}
      </div>

      {metrics?.instagram && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {t('instagramPerformance')}
              {metrics.instagram.username && (
                <span className="ml-2 font-normal text-muted">@{metrics.instagram.username}</span>
              )}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                [t('igFollowers'), metrics.instagram.followers],
                [t('igReach7d'), metrics.instagram.reach],
                [t('igProfileViews7d'), metrics.instagram.profileViews],
                ...(metrics.metaAds
                  ? ([[t('igAdSpend'), metrics.metaAds.instagram, true]] as [string, number, boolean][])
                  : []),
                [t('igEngaged7d'), metrics.instagram.accountsEngaged],
                [t('igInteractions7d'), metrics.instagram.interactions],
                [t('igLeads'), metrics.instagram.leadsFromInstagram],
              ] as [string, number | undefined, boolean?][]
            ).map(([label, value, isMoney]) => (
              <div key={label}>
                <div className="text-[13px] font-medium text-muted">{label}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {value == null
                    ? '—'
                    : isMoney
                      ? formatMoney(value)
                      : value.toLocaleString('az-Latn-AZ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics?.metaAds && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            {t('metaAdsTitle')}
            <span className="ml-2 font-normal text-muted">{metrics.metaAds.currency}</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(
              [
                [t('adsTotal'), formatMoney(metrics.metaAds.total)],
                [t('adsInstagram'), formatMoney(metrics.metaAds.instagram)],
                [t('adsFacebook'), formatMoney(metrics.metaAds.facebook)],
                [t('adsImpressions'), metrics.metaAds.impressions.toLocaleString('az-Latn-AZ')],
                [t('adsClicks'), metrics.metaAds.clicks.toLocaleString('az-Latn-AZ')],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <div className="text-[13px] font-medium text-muted">{label}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          {metrics.metaAds.byCampaign.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-[13px] font-medium text-muted">{t('adsByCampaign')}</div>
              <ul className="space-y-1.5">
                {metrics.metaAds.byCampaign.slice(0, 5).map((c) => (
                  <li key={c.name} className="flex justify-between gap-4 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(c.spend)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyTitle={t('emptyCampaigns')}
      />

      <Drawer
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        title={t('newCampaign')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCampaignOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={createCampaign.isPending}
              onClick={campaignForm.handleSubmit((v) => createCampaign.mutate(v))}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>{tc('name')} *</Label>
            <Input
              error={campaignForm.formState.errors.name?.message}
              {...campaignForm.register('name', { required: tc('required') })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('channelHeader')} *</Label>
              <Select
                options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
                {...campaignForm.register('channel')}
              />
            </div>
            <div>
              <Label>{t('budgetAzn')}</Label>
              <Input type="number" step="0.01" min={0} {...campaignForm.register('budget')} />
            </div>
          </div>
          <div>
            <Label>{t('startDate')} *</Label>
            <Input type="date" {...campaignForm.register('startAt', { required: true })} />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={spendOpen}
        onClose={() => setSpendOpen(false)}
        title={t('adSpend')}
        footer={
          <>
            <Button variant="outline" onClick={() => setSpendOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={addSpend.isPending}
              onClick={spendForm.handleSubmit((v) => addSpend.mutate(v))}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>{t('campaign')}</Label>
            <Select
              placeholder={t('selectCampaignOptional')}
              options={(data?.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...spendForm.register('campaignId')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('channelHeader')} *</Label>
              <Select
                options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
                {...spendForm.register('channel')}
              />
            </div>
            <div>
              <Label>{t('amountAzn')} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                error={spendForm.formState.errors.amount?.message}
                {...spendForm.register('amount', { required: tc('required') })}
              />
            </div>
          </div>
          <div>
            <Label>{tc('date')} *</Label>
            <Input type="date" {...spendForm.register('date', { required: true })} />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
