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
  metaAdsError: string | null;
  metaAds: {
    total: number;
    instagram: number;
    facebook: number;
    impressions: number;
    clicks: number;
    reach: number;
    frequency: number;
    cpm: number;
    cpc: number;
    ctr: number;
    instagram_impressions: number;
    instagram_clicks: number;
    instagram_cpm: number;
    instagram_cpc: number;
    instagram_ctr: number;
    currency: string;
    commissionPct: number;
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
  const [range, setRange] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [commission, setCommission] = useState('');

  const RANGE_OPTIONS = [
    'last_7_days', 'last_30_days', 'this_month', 'last_month', 'last_90_days',
    'this_quarter', 'last_6_months', 'last_12_months', 'this_year', 'last_year',
    'last_2_years', 'all_time', 'custom',
  ];
  // Custom needs both ends before it means anything; until then fall back to the
  // last committed preset so the page never queries an empty window.
  const rangeQuery =
    range === 'custom'
      ? customFrom && customTo
        ? `from=${customFrom}&to=${customTo}`
        : 'range=this_month'
      : `range=${range}`;

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page],
    queryFn: () => api.list<CampaignRow>(`/campaigns?page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });
  const { data: metrics, isFetching: metricsFetching } = useQuery({
    queryKey: ['marketing-metrics', rangeQuery],
    queryFn: () => api.get<Metrics>(`/marketing/metrics?${rangeQuery}`),
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

  const saveCommission = useMutation({
    mutationFn: () =>
      api.post('/integrations/meta-ads/commission', { commissionPct: Number(commission) || 0 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['marketing-metrics'] });
      void qc.invalidateQueries({ queryKey: ['finance-summary'] });
      setCommission('');
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

  // Ad spend is driven by the Meta account's currency (e.g. USD); tuition income
  // is in the local currency. Spend-derived KPIs follow the ad currency so a $
  // figure never wears a ₼ sign.
  const adCur = metrics?.metaAds?.currency;
  const kpis = [
    { label: t('adSpendMonth'), value: metrics ? formatMoney(metrics.totalSpend, adCur) : '—' },
    { label: t('leads'), value: metrics?.totalLeads ?? '—' },
    { label: 'CPL', value: metrics ? formatMoney(metrics.cpl, adCur) : '—' },
    { label: 'CAC', value: metrics ? formatMoney(metrics.cac, adCur) : '—' },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              options={RANGE_OPTIONS.map((v) => ({ value: v, label: t(`range.${v}`) }))}
            />
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className="w-40"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-muted">–</span>
              <Input
                type="date"
                className="w-40"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
          {can('marketing.manage') && (
            <>
              <Button variant="outline" onClick={() => setSpendOpen(true)}>
                {t('addSpend')}
              </Button>
              <Button onClick={() => setCampaignOpen(true)}>
                <Plus className="h-4 w-4" /> {t('newCampaign')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-5 ${metricsFetching ? 'opacity-50' : ''}`}
      >
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
                  ? ([[t('igAdSpend'), metrics.metaAds.instagram, true, metrics.metaAds.currency]] as [string, number, boolean, string][])
                  : []),
                [t('igEngaged7d'), metrics.instagram.accountsEngaged],
                [t('igInteractions7d'), metrics.instagram.interactions],
                [t('igLeads'), metrics.instagram.leadsFromInstagram],
              ] as [string, number | undefined, boolean?, string?][]
            ).map(([label, value, isMoney, cur]) => (
              <div key={label}>
                <div className="text-[13px] font-medium text-muted">{label}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {value == null
                    ? '—'
                    : isMoney
                      ? formatMoney(value, cur)
                      : value.toLocaleString('az-Latn-AZ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics?.metaAdsError && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          {t('metaAdsError')} <span className="text-muted">({metrics.metaAdsError})</span>
        </div>
      )}

      {metrics?.metaAds && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            {t('metaAdsTitle')}
            <span className="ml-2 font-normal text-muted">{metrics.metaAds.currency}</span>
          </h2>

          {can('marketing.manage') && (
            <div className="mb-4 rounded-lg border border-border bg-muted-bg/40 p-3">
              <div className="text-[13px] font-medium">{t('commissionTitle')}</div>
              <p className="mt-0.5 text-xs text-muted">{t('commissionHint')}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="w-28">
                  <Label>{t('commissionLabel')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder={String(metrics.metaAds.commissionPct ?? 0)}
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  loading={saveCommission.isPending}
                  disabled={commission === ''}
                  onClick={() => saveCommission.mutate()}
                >
                  {tc('save')}
                </Button>
                <span className="text-xs text-muted">
                  {t('commissionCurrent', { pct: metrics.metaAds.commissionPct ?? 0 })}
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                [t('adsTotal'), formatMoney(metrics.metaAds.total, metrics.metaAds.currency)],
                [t('adsInstagram'), formatMoney(metrics.metaAds.instagram, metrics.metaAds.currency)],
                [t('adsFacebook'), formatMoney(metrics.metaAds.facebook, metrics.metaAds.currency)],
                [t('adsImpressions'), metrics.metaAds.impressions.toLocaleString('az-Latn-AZ')],
                [t('adsReach'), metrics.metaAds.reach.toLocaleString('az-Latn-AZ')],
                [t('adsClicks'), metrics.metaAds.clicks.toLocaleString('az-Latn-AZ')],
                ['CPM', formatMoney(metrics.metaAds.cpm, metrics.metaAds.currency)],
                ['CPC', formatMoney(metrics.metaAds.cpc, metrics.metaAds.currency)],
                ['CTR', `${metrics.metaAds.ctr}%`],
                [t('adsFrequency'), metrics.metaAds.frequency.toLocaleString('az-Latn-AZ')],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <div className="text-[13px] font-medium text-muted">{label}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-[13px] font-medium text-muted">{t('adsInstagramOnly')}</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  [t('adsInstagram'), formatMoney(metrics.metaAds.instagram, metrics.metaAds.currency)],
                  [t('adsImpressions'), metrics.metaAds.instagram_impressions.toLocaleString('az-Latn-AZ')],
                  [t('adsClicks'), metrics.metaAds.instagram_clicks.toLocaleString('az-Latn-AZ')],
                  ['CPM', formatMoney(metrics.metaAds.instagram_cpm, metrics.metaAds.currency)],
                  ['CTR', `${metrics.metaAds.instagram_ctr}%`],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="text-[13px] font-medium text-muted">{label}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>
          {metrics.metaAds.byCampaign.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-[13px] font-medium text-muted">{t('adsByCampaign')}</div>
              <ul className="space-y-1.5">
                {metrics.metaAds.byCampaign.slice(0, 5).map((c) => (
                  <li key={c.name} className="flex justify-between gap-4 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(c.spend, metrics.metaAds!.currency)}</span>
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
