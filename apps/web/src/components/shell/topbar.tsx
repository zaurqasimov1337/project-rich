'use client';

import { useRouter } from 'next/navigation';
import { Bell, LogOut, Moon, PanelLeft, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils';

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <PanelLeft className="h-4.5 w-4.5" />
      </Button>

      <div className="flex-1" />

      {user?.tenant.status === 'trial' && (
        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          Sınaq müddəti
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        aria-label="Theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {mounted && theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
      </Button>

      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="h-4.5 w-4.5" />
      </Button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
          aria-label="User menu"
        >
          {initials(user?.firstName, user?.lastName)}
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg">
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
              <LogOut className="h-4 w-4" /> Çıxış
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
