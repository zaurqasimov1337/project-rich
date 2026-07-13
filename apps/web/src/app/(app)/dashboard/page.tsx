'use client';

import { useTranslations } from 'next-intl';
import { GraduationCap, Users, Wallet, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';

const KPIS = [
  { key: 'students', label: 'Aktiv tələbə', icon: GraduationCap, value: '—' },
  { key: 'groups', label: 'Aktiv qrup', icon: Users, value: '—' },
  { key: 'revenue', label: 'Bu ay gəlir', icon: Wallet, value: '—' },
  { key: 'lessons', label: 'Bugünkü dərslər', icon: CalendarDays, value: '—' },
];

export default function DashboardPage() {
  const t = useTranslations('nav');
  const user = useAuth((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-muted">
          Xoş gəldin, {user?.firstName}! {user?.tenant.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">{kpi.label}</span>
                <Icon className="h-4.5 w-4.5 text-muted" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-semibold">Başlanğıc addımları</h2>
        <p className="mt-1 text-sm text-muted">
          Real KPI-lər Phase 3 modulları (tələbələr, qruplar, cədvəl, maliyyə) hazır olduqca bu
          paneldə görünəcək.
        </p>
      </div>
    </div>
  );
}
