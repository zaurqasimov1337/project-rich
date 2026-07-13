'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plug, Plus } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';

interface Provider {
  key: string;
  category: string;
  name: string;
  comingSoon: boolean;
  status: string;
  connected: boolean;
  hasSecret: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  social: 'Sosial media',
  ads: 'Reklam',
  payment: 'Ödəniş',
  calendar: 'Təqvim',
  meeting: 'Görüş',
  storage: 'Yaddaş',
  communication: 'Kommunikasiya',
  sms: 'SMS',
  automation: 'Avtomatlaşdırma',
};

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [connectKey, setConnectKey] = useState<Provider | null>(null);
  const [secret, setSecret] = useState('');

  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get<{ categories: string[]; providers: Provider[] }>('/integrations'),
  });

  const connectMutation = useMutation({
    mutationFn: () => api.post(`/integrations/${connectKey!.key}/connect`, { secret: secret || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      setConnectKey(null);
      setSecret('');
    },
  });
  const disconnectMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/integrations/${key}/disconnect`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const byCategory = (data?.providers ?? []).reduce<Record<string, Provider[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">İnteqrasiyalar</h1>
        <p className="mt-1 text-sm text-muted">
          Xarici xidmətləri qoşun. Açarlar AES-256 ilə şifrələnərək saxlanılır.
        </p>
      </div>

      {Object.entries(byCategory).map(([cat, providers]) => (
        <div key={cat}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {CATEGORY_LABELS[cat] ?? cat}
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
                        <Check className="h-3 w-3" /> Qoşulub
                      </span>
                    ) : p.comingSoon ? (
                      <span className="text-xs text-muted">Tezliklə</span>
                    ) : (
                      <span className="text-xs text-muted">Mövcuddur</span>
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
                      Ayır
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConnectKey(p)}>
                      <Plus className="h-4 w-4" /> Qoş
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Drawer
        open={!!connectKey}
        onClose={() => setConnectKey(null)}
        title={`${connectKey?.name ?? ''} qoşulması`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConnectKey(null)}>
              Ləğv et
            </Button>
            <Button loading={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
              Qoş
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {connectKey?.category === 'ai'
              ? 'API açarınızı daxil edin. Şifrələnərək saxlanılacaq.'
              : 'Bu inteqrasiyanı aktivləşdirin.'}
          </p>
          <div>
            <Label>API açarı / Token</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
