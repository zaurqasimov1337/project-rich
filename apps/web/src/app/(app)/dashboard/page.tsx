'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, GraduationCap, UserPlus, Users, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';

interface DashboardData {
  activeStudents: number;
  activeGroups: number;
  todayLessons: number;
  newStudentsMonth: number;
  attendanceRate: number | null;
  monthRevenue: number;
  upcomingLessons: { id: string; startAt: string; endAt: string; group: string; course: string }[];
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const user = useAuth((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });

  const kpis = [
    { label: t('activeStudents'), icon: GraduationCap, value: data?.activeStudents },
    { label: t('activeGroups'), icon: Users, value: data?.activeGroups },
    { label: t('todayLessons'), icon: CalendarDays, value: data?.todayLessons },
    { label: t('newStudentsMonth'), icon: UserPlus, value: data?.newStudentsMonth },
    {
      label: t('attendanceRate30'),
      icon: ClipboardCheck,
      value: data?.attendanceRate != null ? `${data.attendanceRate}%` : '—',
    },
    { label: t('monthRevenue'), icon: Wallet, value: data ? formatMoney(data.monthRevenue) : undefined },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        description={`${t('welcome', { name: user?.firstName ?? '' })} ${user?.tenant.name ?? ''}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            icon={kpi.icon}
            tone="text-muted"
            value={
              isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted-bg" />
              ) : (
                (kpi.value ?? '—')
              )
            }
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="border-b border-border px-5 py-3 text-[15px] font-bold">{t('upcomingLessons')}</div>
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted-bg" />
            ))}
          </div>
        ) : data?.upcomingLessons.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{t('noUpcomingLessons')}</div>
        ) : (
          <div className="divide-y divide-border">
            {data?.upcomingLessons.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-medium">{l.group}</span>{' '}
                  <span className="text-sm text-muted">· {l.course}</span>
                </div>
                <span className="text-sm text-muted tabular-nums">
                  {new Date(l.startAt).toLocaleDateString('az-Latn-AZ', {
                    day: '2-digit',
                    month: '2-digit',
                  })}{' '}
                  {new Date(l.startAt).toTimeString().slice(0, 5)}–
                  {new Date(l.endAt).toTimeString().slice(0, 5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
