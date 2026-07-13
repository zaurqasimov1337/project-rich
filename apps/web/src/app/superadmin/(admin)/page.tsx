'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { platformApi } from '@/lib/platform';
import { formatMoney } from '@/lib/utils';
import { StatusBadge } from '@/components/data-table';

interface Analytics {
  tenantsByStatus: Record<string, number>;
  totalTenants: number;
  mrr: number;
  arr: number;
  recentTenants: { id: string; name: string; status: string; plan: string | null; createdAt: string }[];
}

export default function PlatformDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-analytics'],
    queryFn: () => platformApi.get<Analytics>('/platform/analytics'),
  });

  const kpis = [
    { label: 'MRR', value: data ? formatMoney(data.mrr) : '—' },
    { label: 'ARR', value: data ? formatMoney(data.arr) : '—' },
    { label: 'Ümumi mərkəz', value: data?.totalTenants ?? '—' },
    { label: 'Aktiv', value: data?.tenantsByStatus.active ?? 0 },
    { label: 'Sınaqda', value: data?.tenantsByStatus.trial ?? 0 },
    { label: 'Dayandırılıb', value: data?.tenantsByStatus.suspended ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Platform analitikası</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="text-[13px] font-medium text-muted">{kpi.label}</div>
            <div className="mt-1.5 text-xl font-bold tabular-nums">
              {isLoading ? <div className="h-7 w-16 animate-pulse rounded bg-muted-bg" /> : kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-3 font-semibold">Son qeydiyyatlar</div>
        <div className="divide-y divide-border">
          {data?.recentTenants.map((t) => (
            <Link
              key={t.id}
              href={`/superadmin/tenants/${t.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-muted-bg/50"
            >
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-sm text-muted">{t.plan ?? 'Plansız'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted tabular-nums">
                  {new Date(t.createdAt).toLocaleDateString('az-Latn-AZ')}
                </span>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
