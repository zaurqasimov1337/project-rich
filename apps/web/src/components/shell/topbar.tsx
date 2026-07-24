'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Moon, PanelLeft, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const router = useRouter();
  const t = useTranslations('topbar');
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const can = useAuth((s) => s.can);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: notif } = useQuery({
    queryKey: ['sales-notifications'],
    queryFn: () =>
      api.get<{ overdueFollowups: number; todayFollowups: number; upcomingPayments: number }>('/sales/notifications'),
    enabled: can('leads.read'),
    refetchInterval: 60_000,
  });
  const alertCount = (notif?.overdueFollowups ?? 0) + (notif?.upcomingPayments ?? 0);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-topbar/80 px-4 backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-foreground"
        onClick={onToggleSidebar}
        aria-label={t('toggleSidebar')}
      >
        <PanelLeft className="h-4.5 w-4.5" />
      </Button>

      <div className="flex-1" />

      {user?.tenant.status === 'trial' && (
        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          {t('trial')}
        </span>
      )}

      <LanguageSwitcher />

      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-foreground"
        aria-label={t('theme')}
        onClick={() => {
          // Cross-fade colors during the theme swap (class defined in globals.css)
          const root = document.documentElement;
          root.classList.add('theme-transition');
          setTheme(theme === 'dark' ? 'light' : 'dark');
          window.setTimeout(() => root.classList.remove('theme-transition'), 350);
        }}
      >
        {mounted && theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
      </Button>

      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted hover:text-foreground"
          aria-label={t('notifications')}
          onClick={() => can('leads.read') && router.push('/crm/follow-ups?bucket=overdue')}
        >
          <Bell className="h-4.5 w-4.5" />
        </Button>
        {alertCount > 0 && (
          <span
            key={alertCount}
            className="animate-pulse-once pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
          aria-label="User menu"
        >
          {initials(user?.firstName, user?.lastName)}
        </button>
        {menuOpen && (
          <div className="animate-scale-in absolute right-0 top-10 w-56 rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow-lg)]">
            <div className="border-b border-border px-3 py-2">
              <div className="text-sm font-semibold">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-muted">{user?.email}</div>
              <div className="mt-0.5 text-xs text-muted">{user?.tenant.name}</div>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-muted-bg"
            >
              <LogOut className="h-4 w-4" /> {t('logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
