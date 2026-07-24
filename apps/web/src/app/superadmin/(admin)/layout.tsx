'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, Building2, CreditCard, LogOut, ScrollText } from 'lucide-react';
import { usePlatformAuth } from '@/lib/platform';
import { cn, initials } from '@/lib/utils';

interface AdminNavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV: AdminNavItem[] = [
  { href: '/superadmin', labelKey: 'analytics', icon: BarChart3, exact: true },
  { href: '/superadmin/tenants', labelKey: 'centers', icon: Building2 },
  { href: '/superadmin/plans', labelKey: 'plans', icon: CreditCard },
  { href: '/superadmin/audit', labelKey: 'audit', icon: ScrollText },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('platform');
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, bootstrap, logout } = usePlatformAuth();

  useEffect(() => {
    if (status === 'loading') void bootstrap();
  }, [status, bootstrap]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/superadmin/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-admin-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-admin-primary text-sm font-bold text-white">
            M
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Mactab</div>
            <div className="text-[10px] uppercase tracking-wider text-admin-primary">Super Admin</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-admin-primary/10 text-admin-primary'
                    : 'text-muted hover:bg-muted-bg hover:text-foreground',
                )}
              >
                <Icon className="h-4.5 w-4.5" /> {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-admin-primary/15 text-xs font-bold text-admin-primary">
              {initials(user?.firstName, user?.lastName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="truncate text-xs text-muted">{user?.role}</div>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.replace('/superadmin/login');
              }}
              className="text-muted hover:text-danger"
              aria-label={t('logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="ml-[240px] p-6">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
