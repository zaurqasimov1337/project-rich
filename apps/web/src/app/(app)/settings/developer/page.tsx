'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Plus, Trash2, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}
interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  deliveries: number;
}

export default function DeveloperPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [tab, setTab] = useState<'keys' | 'webhooks'>('keys');
  const [keyDrawer, setKeyDrawer] = useState(false);
  const [hookDrawer, setHookDrawer] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: keys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiKey[]>('/api-keys'),
    enabled: can('apikeys.manage'),
  });
  const { data: hooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<WebhookEndpoint[]>('/webhook-endpoints'),
    enabled: can('webhooks.manage'),
  });
  const { data: events } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: () => api.get<string[]>('/webhook-endpoints/events'),
    enabled: hookDrawer,
  });

  const keyForm = useForm<{ name: string; scopes: string }>({ defaultValues: { scopes: 'read' } });
  const hookForm = useForm<{ url: string }>();
  const [hookEvents, setHookEvents] = useState<string[]>([]);

  const createKey = useMutation({
    mutationFn: (v: { name: string; scopes: string }) =>
      api.post<{ key: string }>('/api-keys', { name: v.name, scopes: v.scopes.split(',') }),
    onSuccess: (data) => {
      setNewSecret(data.key);
      void qc.invalidateQueries({ queryKey: ['api-keys'] });
      setKeyDrawer(false);
      keyForm.reset();
    },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
  const createHook = useMutation({
    mutationFn: (v: { url: string }) =>
      api.post<{ secret: string }>('/webhook-endpoints', { url: v.url, events: hookEvents }),
    onSuccess: (data) => {
      setNewSecret(data.secret);
      void qc.invalidateQueries({ queryKey: ['webhooks'] });
      setHookDrawer(false);
      hookForm.reset();
      setHookEvents([]);
    },
  });
  const deleteHook = useMutation({
    mutationFn: (id: string) => api.delete(`/webhook-endpoints/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('developer')}</h1>

      <div className="flex gap-1 border-b border-border">
        {[
          ['keys', t('apiKeys')],
          ['webhooks', t('webhooks')],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as 'keys' | 'webhooks')}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium',
              tab === k ? 'border-primary text-primary' : 'border-transparent text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {newSecret && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <div className="text-sm font-medium text-warning">
            {t('secretWarning')}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-sm">
              {newSecret}
            </code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newSecret)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewSecret(null)}>
              {tc('close')}
            </Button>
          </div>
        </div>
      )}

      {tab === 'keys' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setKeyDrawer(true)}>
              <Plus className="h-4 w-4" /> {t('newKey')}
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            {keys?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">{t('noKeys')}</div>
            ) : (
              <div className="divide-y divide-border">
                {keys?.map((k) => (
                  <div key={k.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted" />
                      <div>
                        <div className="font-medium">{k.name}</div>
                        <div className="font-mono text-xs text-muted">
                          {k.prefix}··· · {k.scopes.join(', ')}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => revokeKey.mutate(k.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setHookDrawer(true)}>
              <Plus className="h-4 w-4" /> {t('newWebhook')}
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            {hooks?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">{t('noWebhooks')}</div>
            ) : (
              <div className="divide-y divide-border">
                {hooks?.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-muted" />
                      <div>
                        <div className="truncate font-mono text-sm">{h.url}</div>
                        <div className="text-xs text-muted">
                          {t('webhookMeta', {
                            events: h.events.length,
                            deliveries: h.deliveries,
                            status: h.active ? t('statusActive') : t('statusInactive'),
                          })}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteHook.mutate(h.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* API key drawer */}
      <Drawer
        open={keyDrawer}
        onClose={() => setKeyDrawer(false)}
        title={t('newApiKey')}
        footer={
          <>
            <Button variant="outline" onClick={() => setKeyDrawer(false)}>
              {tc('cancel')}
            </Button>
            <Button loading={createKey.isPending} onClick={keyForm.handleSubmit((v) => createKey.mutate(v))}>
              {tc('create')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>{tc('name')} *</Label>
            <Input {...keyForm.register('name', { required: true })} placeholder={t('keyNamePlaceholder')} />
          </div>
          <div>
            <Label>{t('scopes')}</Label>
            <select
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              {...keyForm.register('scopes')}
            >
              <option value="read">{t('scopeRead')}</option>
              <option value="read,write">{t('scopeReadWrite')}</option>
            </select>
          </div>
        </form>
      </Drawer>

      {/* Webhook drawer */}
      <Drawer
        open={hookDrawer}
        onClose={() => setHookDrawer(false)}
        title={t('newWebhook')}
        footer={
          <>
            <Button variant="outline" onClick={() => setHookDrawer(false)}>
              {tc('cancel')}
            </Button>
            <Button
              disabled={hookEvents.length === 0}
              loading={createHook.isPending}
              onClick={hookForm.handleSubmit((v) => createHook.mutate(v))}
            >
              {tc('create')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <Label>URL *</Label>
            <Input
              {...hookForm.register('url', { required: true })}
              placeholder="https://example.com/webhook"
            />
          </div>
          <div>
            <Label>{t('events')}</Label>
            <div className="mt-1 space-y-1.5">
              {events?.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hookEvents.includes(e)}
                    onChange={(ev) =>
                      setHookEvents((prev) =>
                        ev.target.checked ? [...prev, e] : prev.filter((x) => x !== e),
                      )
                    }
                  />
                  <span className="font-mono text-xs">{e}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
