'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { platformApi } from '@/lib/platform';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data-table';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  trialEndsAt: string | null;
  plan: { id: string; code: string; name: string; priceMonthly: number } | null;
  usage: { users: number; students: number; groups: number };
  subscriptions: {
    id: string;
    period: string;
    status: string;
    currentPeriodEnd: string;
    invoices: { id: string; number: string; amount: number; status: string; dueAt: string }[];
  }[];
}

interface Plan {
  id: string;
  code: string;
  name: string;
}

export default function TenantDetailPage() {
  const t = useTranslations('platform');
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['platform-tenant', id],
    queryFn: () => platformApi.get<TenantDetail>(`/platform/tenants/${id}`),
  });
  const { data: plans } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => platformApi.get<Plan[]>('/platform/plans'),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: { status?: string; planId?: string }) =>
      platformApi.patch(`/platform/tenants/${id}`, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform-tenant', id] }),
  });

  if (isLoading || !tenant) return <div className="h-40 animate-pulse rounded-xl bg-muted-bg" />;

  return (
    <div className="space-y-5">
      <Link
        href="/superadmin/tenants"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('centers')}
      </Link>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{tenant.name}</h1>
              <StatusBadge status={tenant.status} />
            </div>
            <div className="mt-0.5 text-sm text-muted">
              <span className="font-mono">{tenant.slug}</span> · {t('registered')}:{' '}
              {new Date(tenant.createdAt).toLocaleDateString('az-Latn-AZ')}
              {tenant.trialEndsAt && (
                <> · {t('trialEnds')}: {new Date(tenant.trialEndsAt).toLocaleDateString('az-Latn-AZ')}</>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {tenant.status !== 'suspended' ? (
              <Button
                variant="destructive"
                size="sm"
                loading={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ status: 'suspended' })}
              >
                <Ban className="h-4 w-4" /> {t('suspend')}
              </Button>
            ) : (
              <Button
                size="sm"
                loading={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ status: 'active' })}
                className="!bg-admin-primary"
              >
                <PlayCircle className="h-4 w-4" /> {t('restore')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-3">
          {[
            [t('users'), tenant.usage.users],
            [t('students'), tenant.usage.students],
            [t('groups'), tenant.usage.groups],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted-bg p-3">
              <div className="text-xs text-muted">{label}</div>
              <div className="text-lg font-bold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">{t('plan')}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm">
            {t('current')}: <span className="font-semibold">{tenant.plan?.name ?? t('none')}</span>
            {tenant.plan && (
              <span className="ml-1 text-muted">({formatMoney(tenant.plan.priceMonthly)}{t('perMonthShort')})</span>
            )}
          </span>
          <div className="flex gap-2">
            {plans
              ?.filter((p) => p.id !== tenant.plan?.id)
              .map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  onClick={() => updateMutation.mutate({ planId: p.id })}
                >
                  {t('switchTo', { name: p.name })}
                </Button>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-3 font-semibold">{t('subscriptions')}</div>
        {tenant.subscriptions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">{t('noSubscriptions')}</div>
        ) : (
          <div className="divide-y divide-border">
            {tenant.subscriptions.map((s) => (
              <div key={s.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {s.period === 'yearly' ? t('yearly') : t('monthly')} {t('subscription')}
                  </span>
                  <StatusBadge status={s.status === 'trialing' ? 'trial' : s.status} />
                </div>
                <div className="mt-0.5 text-muted">
                  {t('periodEnd')}: {new Date(s.currentPeriodEnd).toLocaleDateString('az-Latn-AZ')} ·{' '}
                  {t('invoicesCount', { count: s.invoices.length })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
