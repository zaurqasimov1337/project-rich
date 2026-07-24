'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, bootstrap } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') void bootstrap();
  }, [status, bootstrap]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-backdrop min-h-screen">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className={cn('transition-[margin]', collapsed ? 'lg:ml-16' : 'lg:ml-[260px]')}>
        <Topbar
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) setMobileOpen((o) => !o);
            else setCollapsed((c) => !c);
          }}
        />
        <main className="mx-auto max-w-[1440px] p-4 sm:p-6">
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
