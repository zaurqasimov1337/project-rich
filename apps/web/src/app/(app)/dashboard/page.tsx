'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, GraduationCap, UserPlus, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatMoney } from '@/lib/utils';

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
  const user = useAuth((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });

  const kpis = [
    { label: 'Aktiv tələbə', icon: GraduationCap, value: data?.activeStudents },
    { label: 'Aktiv qrup', icon: Users, value: data?.activeGroups },
    { label: 'Bugünkü dərslər', icon: CalendarDays, value: data?.todayLessons },
    { label: 'Bu ay yeni tələbə', icon: UserPlus, value: data?.newStudentsMonth },
    {
      label: 'Davamiyyət (30 gün)',
      icon: ClipboardCheck,
      value: data?.attendanceRate != null ? `${data.attendanceRate}%` : '—',
    },
    { label: 'Bu ay gəlir', icon: Wallet, value: data ? formatMoney(data.monthRevenue) : undefined },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">İdarə paneli</h1>
        <p className="mt-1 text-sm text-muted">
          Xoş gəldin, {user?.firstName}! {user?.tenant.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted">{kpi.label}</span>
                <Icon className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {isLoading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted-bg" />
                ) : (
                  (kpi.value ?? '—')
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-3 font-semibold">Növbəti dərslər</div>
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted-bg" />
            ))}
          </div>
        ) : data?.upcomingLessons.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Planlaşdırılmış dərs yoxdur</div>
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
