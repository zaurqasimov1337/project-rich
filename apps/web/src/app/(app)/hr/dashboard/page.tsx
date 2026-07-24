'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  FileWarning,
  HeartPulse,
  Hourglass,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { HR_STATUS_LABELS } from '@/lib/hr';

interface HrDashboard {
  activeCount: number;
  hiredThisMonth: number;
  leftThisMonth: number;
  onProbation: number;
  onLeave: number;
  sick: number;
  contractsExpiring30d: {
    count: number;
    list: { id: string; employeeId: string; employeeName: string; title: string; expiresAt: string | null }[];
  };
  documentsExpiring30d?: {
    count: number;
    list: { id: string; employeeId: string; employeeName: string; title: string; type: string; expiresAt: string | null }[];
  };
  birthdaysThisMonth: {
    count: number;
    list: { employeeId: string; employeeName: string; birthDate: string | null }[];
  };
  byStatus: Record<string, number>;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  sexsiyyet: 'Şəxsiyyət (Ş/V, pasport)',
  cv: 'CV',
  diplom: 'Diplom',
  sertifikat: 'Sertifikat',
  muqavile: 'Müqavilə sənədi',
  siyaset: 'Siyasət',
  diger: 'Sənəd',
};

function daysLeft(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function HrDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: () => api.get<HrDashboard>('/hr/dashboard'),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="HR Panel" />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Aktiv işçi" value={data.activeCount} icon={Users} />
            <StatCard label="Bu ay qəbul" value={data.hiredThisMonth} icon={UserPlus} tone="text-success" />
            <StatCard label="Bu ay çıxan" value={data.leftThisMonth} icon={UserMinus} tone="text-danger" />
            <StatCard label="Sınaqda" value={data.onProbation} icon={Hourglass} tone="text-warning" />
            <StatCard label="Məzuniyyətdə" value={data.onLeave} icon={CalendarDays} tone="text-info" />
            <StatCard label="Xəstəlik" value={data.sick} icon={HeartPulse} tone="text-danger" />
            <StatCard
              label="Müqavilə/sənəd bitəcək"
              value={data.contractsExpiring30d.count + (data.documentsExpiring30d?.count ?? 0)}
              sub="30 gün ərzində"
              icon={FileWarning}
              tone="text-warning"
            />
            <StatCard label="Ad günü bu ay" value={data.birthdaysThisMonth.count} icon={Cake} tone="text-accent" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <AlertTriangle className="h-4 w-4 text-warning" /> 30 günə bitəcək müqavilə və sənədlər
              </h3>
              <div className="mt-3 space-y-2">
                {data.contractsExpiring30d.list.length === 0 &&
                  (data.documentsExpiring30d?.list.length ?? 0) === 0 && (
                    <p className="text-sm text-muted">Yaxın 30 gündə bitəcək müqavilə və ya sənəd yoxdur.</p>
                  )}
                {[
                  ...data.contractsExpiring30d.list.map((c) => ({ ...c, kind: 'Müqavilə' })),
                  ...(data.documentsExpiring30d?.list ?? []).map((doc) => ({
                    ...doc,
                    kind: DOC_TYPE_LABELS[doc.type] ?? 'Sənəd',
                  })),
                ]
                  .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''))
                  .map((c) => {
                    const d = daysLeft(c.expiresAt);
                    const urgent = d !== null && d <= 7;
                    return (
                      <Link
                        key={c.id}
                        href={`/hr/employees/${c.employeeId}`}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary ${
                          urgent ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5'
                        }`}
                      >
                        <div>
                          <div className="font-medium">{c.employeeName}</div>
                          <div className="text-xs text-muted">
                            {c.kind} · {c.title}
                          </div>
                        </div>
                        <Badge tone={urgent ? 'danger' : 'warning'}>
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('az-Latn-AZ') : '—'}
                          {d !== null && ` · ${d} gün`}
                        </Badge>
                      </Link>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Cake className="h-4 w-4 text-accent" /> Bu ay ad günləri
              </h3>
              <div className="mt-3 space-y-2">
                {data.birthdaysThisMonth.list.length === 0 && (
                  <p className="text-sm text-muted">Bu ay ad günü yoxdur.</p>
                )}
                {data.birthdaysThisMonth.list.map((b) => (
                  <Link
                    key={b.employeeId}
                    href={`/hr/employees/${b.employeeId}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary"
                  >
                    <span className="font-medium">{b.employeeName}</span>
                    <span className="text-muted">
                      {b.birthDate ? new Date(b.birthDate).toLocaleDateString('az-Latn-AZ') : '—'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h3 className="text-sm font-bold">Status üzrə bölgü</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.byStatus).map(([status, count]) => {
                const st = HR_STATUS_LABELS[status] ?? { label: status, tone: 'neutral' as const };
                return (
                  <Badge key={status} tone={st.tone} dot>
                    {st.label}: {count}
                  </Badge>
                );
              })}
              {Object.keys(data.byStatus).length === 0 && (
                <p className="text-sm text-muted">Məlumat yoxdur.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
