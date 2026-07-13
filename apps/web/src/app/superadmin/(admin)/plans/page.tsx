'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { platformApi } from '@/lib/platform';
import { formatMoney } from '@/lib/utils';

interface Plan {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  isActive: boolean;
  _count: { tenants: number };
}

export default function PlansPage() {
  const t = useTranslations('platform');

  const LIMIT_LABELS: Record<string, string> = {
    users: t('limitUsers'),
    students: t('limitStudents'),
    teachers: t('limitTeachers'),
    branches: t('limitBranches'),
    aiRequests: t('limitAiRequests'),
    storageMb: t('limitStorage'),
    apiCalls: t('limitApiCalls'),
  };

  const FEATURE_LABELS: Record<string, string> = {
    crm: 'CRM',
    finance: t('featureFinance'),
    marketing: t('featureMarketing'),
    ai: 'AI Copilot',
    lms: 'LMS',
    hr: 'HR',
    payroll: t('featurePayroll'),
    api: 'Public API',
    whiteLabel: 'White Label',
    multiBranch: t('featureMultiBranch'),
    whatsapp: 'WhatsApp',
    webhooks: 'Webhooks',
  };

  const { data: plans, isLoading } = useQuery({
    queryKey: ['platform-plans-full'],
    queryFn: () => platformApi.get<Plan[]>('/platform/plans'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('plansTitle')}</h1>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted-bg" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted-bg/50">
                <th className="px-4 py-3 text-left font-semibold text-muted">{t('feature')}</th>
                {plans?.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs font-normal text-muted">
                      {formatMoney(p.priceMonthly)}{t('perMonthShort')} · {t('centersCount', { count: p._count.tenants })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                <tr key={key} className="border-b border-border">
                  <td className="px-4 py-2.5 font-medium">{label}</td>
                  {plans?.map((p) => (
                    <td key={p.id} className="px-4 py-2.5 text-center tabular-nums">
                      {p.limits[key] === -1 ? '∞' : (p.limits[key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
              {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{label}</td>
                  {plans?.map((p) => (
                    <td key={p.id} className="px-4 py-2.5 text-center">
                      {p.features[key] ? (
                        <Check className="mx-auto h-4 w-4 text-success" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-muted opacity-40" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
