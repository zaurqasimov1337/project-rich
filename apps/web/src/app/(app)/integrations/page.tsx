'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Heart, MessageCircle, Phone, Plug, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface Provider {
  key: string;
  category: string;
  name: string;
  comingSoon: boolean;
  status: string;
  connected: boolean;
  hasSecret: boolean;
  hasDmToken: boolean;
  config?: { igUserId?: string; profile?: { username?: string; followers_count?: number; media_count?: number } };
}

const CATEGORY_KEYS: Record<string, string> = {
  ai: 'catAi',
  social: 'catSocial',
  ads: 'catAds',
  payment: 'catPayment',
  calendar: 'catCalendar',
  meeting: 'catMeeting',
  storage: 'catStorage',
  communication: 'catCommunication',
  sms: 'catSms',
  automation: 'catAutomation',
};

export default function IntegrationsPage() {
  const t = useTranslations('integrations');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [connectKey, setConnectKey] = useState<Provider | null>(null);
  const [secret, setSecret] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [dmToken, setDmToken] = useState('');

  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get<{ categories: string[]; providers: Provider[] }>('/integrations'),
  });

  const instagramProvider = data?.providers.find((p) => p.key === 'instagram');
  const instagramConnected = !!instagramProvider?.connected;
  const instagramHasDmToken = !!instagramProvider?.hasDmToken;
  const { data: igMedia, isLoading: igMediaLoading, isError: igMediaError } = useQuery({
    queryKey: ['instagram-media'],
    queryFn: () => api.get<{ media: InstagramMedia[] }>('/integrations/instagram/media'),
    enabled: instagramConnected,
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      api.post(`/integrations/${connectKey!.key}/connect`, {
        secret: secret || undefined,
        config:
          connectKey?.key === 'instagram'
            ? { igUserId }
            : connectKey?.key === 'meta_ads'
              ? { adAccountId }
              : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['marketing-metrics'] });
      setConnectKey(null);
      setSecret('');
      setIgUserId('');
      setAdAccountId('');
    },
  });
  const disconnectMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/integrations/${key}/disconnect`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const syncDmLeadsMutation = useMutation({
    mutationFn: () =>
      api.post<{
        created: number;
        skipped: number;
        results: { username?: string; phone?: string; reason: string; status: 'created' | 'skipped' }[];
      }>('/integrations/instagram/sync-dm-leads'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const saveDmTokenMutation = useMutation({
    mutationFn: () => api.post('/integrations/instagram/dm-token', { token: dmToken }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      setDmToken('');
    },
  });

  const byCategory = (data?.providers ?? []).reduce<Record<string, Provider[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>

      {Object.entries(byCategory).map(([cat, providers]) => (
        <div key={cat}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <div
                key={p.key}
                className={cn(
                  'flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm',
                  p.comingSoon && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted-bg text-muted">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.connected ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <Check className="h-3 w-3" />
                        {p.key === 'instagram' && p.config?.profile?.username
                          ? `@${p.config.profile.username} · ${p.config.profile.followers_count ?? 0} izləyici`
                          : t('connected')}
                      </span>
                    ) : p.comingSoon ? (
                      <span className="text-xs text-muted">{t('comingSoon')}</span>
                    ) : (
                      <span className="text-xs text-muted">{t('available')}</span>
                    )}
                  </div>
                </div>
                {can('integrations.manage') && !p.comingSoon && (
                  p.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate(p.key)}
                    >
                      {t('disconnect')}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConnectKey(p)}>
                      <Plus className="h-4 w-4" /> {t('connect')}
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {instagramConnected && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">{t('dmSyncTitle')}</h2>
              <p className="mt-1 text-xs text-muted">{t('dmSyncHint')}</p>
            </div>
            {can('integrations.manage') && instagramHasDmToken && (
              <Button
                size="sm"
                loading={syncDmLeadsMutation.isPending}
                onClick={() => syncDmLeadsMutation.mutate()}
              >
                <Phone className="h-4 w-4" /> {t('dmSyncButton')}
              </Button>
            )}
          </div>

          {can('integrations.manage') && !instagramHasDmToken && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label>{t('dmTokenLabel')}</Label>
                <Input
                  type="password"
                  placeholder="IGAA..."
                  value={dmToken}
                  onChange={(e) => setDmToken(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                loading={saveDmTokenMutation.isPending}
                disabled={!dmToken}
                onClick={() => saveDmTokenMutation.mutate()}
              >
                {tc('save')}
              </Button>
            </div>
          )}
          {saveDmTokenMutation.isError && (
            <p className="mt-2 text-sm text-danger">
              {(saveDmTokenMutation.error as { message?: string })?.message ?? t('dmSyncError')}
            </p>
          )}

          {syncDmLeadsMutation.isSuccess && (
            <div className="mt-3">
              <p className="text-sm text-success">
                {t('dmSyncResult', {
                  created: syncDmLeadsMutation.data?.created ?? 0,
                  skipped: syncDmLeadsMutation.data?.skipped ?? 0,
                })}
              </p>
              {(syncDmLeadsMutation.data?.results ?? []).filter((r) => r.status === 'created').length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {syncDmLeadsMutation.data!.results
                    .filter((r) => r.status === 'created')
                    .slice(0, 15)
                    .map((r, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2">
                        <span className="font-medium text-foreground">
                          {r.username ? `@${r.username}` : r.phone ?? '—'}
                        </span>
                        <span>· {r.reason}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {syncDmLeadsMutation.isError && (
            <p className="mt-3 text-sm text-danger">
              {(syncDmLeadsMutation.error as { message?: string })?.message ?? t('dmSyncError')}
            </p>
          )}
        </div>
      )}

      {instagramConnected && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('instagramFeedTitle')}
          </h2>
          {igMediaLoading && <p className="text-sm text-muted">{tc('loading')}</p>}
          {igMediaError && <p className="text-sm text-danger">{t('instagramFeedError')}</p>}
          {igMedia && igMedia.media.length === 0 && (
            <p className="text-sm text-muted">{t('instagramFeedEmpty')}</p>
          )}
          {igMedia && igMedia.media.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {igMedia.media.map((m) => (
                <a
                  key={m.id}
                  href={m.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
                >
                  <div className="aspect-square w-full overflow-hidden bg-muted-bg">
                    {(m.media_url || m.thumbnail_url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.thumbnail_url ?? m.media_url}
                        alt={m.caption ?? 'Instagram post'}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    {m.caption && <p className="line-clamp-2 text-xs text-muted">{m.caption}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {m.like_count ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {m.comments_count ?? 0}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <Drawer
        open={!!connectKey}
        onClose={() => setConnectKey(null)}
        title={t('connectTitle', { name: connectKey?.name ?? '' })}
        footer={
          <>
            <Button variant="outline" onClick={() => setConnectKey(null)}>
              {tc('cancel')}
            </Button>
            <Button loading={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
              {t('connect')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {connectKey?.key === 'instagram'
              ? t('instagramConnectHint')
              : connectKey?.key === 'meta_ads'
                ? t('metaAdsConnectHint')
                : connectKey?.category === 'ai'
                  ? t('aiConnectHint')
                  : t('defaultConnectHint')}
          </p>
          {connectKey?.key === 'meta_ads' && (
            <div>
              <Label>{t('adAccountIdLabel')}</Label>
              <Input
                placeholder="act_1234567890"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
              />
            </div>
          )}
          {connectKey?.key === 'instagram' && (
            <div>
              <Label>{t('igUserIdLabel')}</Label>
              <Input
                placeholder="17841400000000000"
                value={igUserId}
                onChange={(e) => setIgUserId(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label>{t('apiKeyLabel')}</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
          {connectMutation.isError && (
            <p className="text-sm text-danger">
              {(connectMutation.error as { message?: string })?.message ?? t('connectError')}
            </p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
