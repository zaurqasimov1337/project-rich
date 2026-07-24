'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface NotifCounts {
  overdueFollowups: number;
  todayFollowups: number;
  upcomingPayments: number;
  overduePayments: number;
}

function OverduePill() {
  const { data } = useQuery({
    queryKey: ['sales-notifications'],
    queryFn: () => api.get<NotifCounts>('/sales/notifications'),
    refetchInterval: 60_000,
  });
  const overdue = data?.overdueFollowups ?? 0;
  if (overdue === 0) return null;
  return (
    <Link
      href="/crm/follow-ups?bucket=overdue"
      className="mb-4 inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
    >
      <AlertTriangle className="h-4 w-4" />
      {overdue} gecikmiş follow-up
    </Link>
  );
}

// The MilliSec-style dark navy theme is scoped to the whole sales section:
// negative margins stretch the backdrop over the app shell's main padding.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crm-theme -m-6 min-h-[calc(100vh-3.5rem)] p-6">
      <OverduePill />
      {children}
    </div>
  );
}
