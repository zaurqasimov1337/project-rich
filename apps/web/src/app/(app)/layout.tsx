'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, bootstrap } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

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
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} />
      <div className={cn('transition-[margin]', collapsed ? 'ml-16' : 'ml-[260px]')}>
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="mx-auto max-w-[1440px] p-6">{children}</main>
      </div>
    </div>
  );
}
