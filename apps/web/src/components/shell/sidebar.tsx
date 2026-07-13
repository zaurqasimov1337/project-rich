'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  DoorOpen,
  GraduationCap,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PieChart,
  Puzzle,
  Settings,
  UserRound,
  Users,
  Wallet,
  BookOpen,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  exact?: boolean;
}

const SECTIONS: { titleKey?: string; items: NavItem[] }[] = [
  {
    items: [{ href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }],
  },
  {
    titleKey: 'sectionSales',
    items: [
      { href: '/crm', labelKey: 'crmDashboard', icon: PieChart, permission: 'leads.read', exact: true },
      { href: '/crm/leads', labelKey: 'crmLeads', icon: Users, permission: 'leads.read' },
      { href: '/crm/pipeline', labelKey: 'crmPipeline', icon: KanbanSquare, permission: 'leads.read' },
      { href: '/crm/follow-ups', labelKey: 'crmFollowUps', icon: Bell, permission: 'leads.read' },
      { href: '/tasks', labelKey: 'tasks', icon: CheckSquare, permission: 'tasks.read' },
    ],
  },
  {
    titleKey: 'sectionEducation',
    items: [
      { href: '/students', labelKey: 'students', icon: GraduationCap, permission: 'students.read' },
      { href: '/teachers', labelKey: 'teachers', icon: UserRound, permission: 'teachers.read' },
      { href: '/courses', labelKey: 'courses', icon: BookOpen, permission: 'courses.read' },
      { href: '/groups', labelKey: 'groups', icon: Users, permission: 'groups.read' },
      { href: '/schedule', labelKey: 'schedule', icon: CalendarDays, permission: 'schedule.read' },
      { href: '/attendance', labelKey: 'attendance', icon: ClipboardCheck, permission: 'attendance.read' },
      { href: '/exams', labelKey: 'exams', icon: FileSpreadsheet, permission: 'exams.read' },
    ],
  },
  {
    titleKey: 'sectionOrg',
    items: [
      { href: '/rooms', labelKey: 'rooms', icon: DoorOpen, permission: 'rooms.read' },
      { href: '/branches', labelKey: 'branches', icon: Building2, permission: 'branches.read' },
      { href: '/finance', labelKey: 'finance', icon: Wallet, permission: 'finance.read' },
      { href: '/hr/employees', labelKey: 'hr', icon: Briefcase, permission: 'hr.employees.read' },
      { href: '/marketing/campaigns', labelKey: 'marketing', icon: Megaphone, permission: 'marketing.read' },
      { href: '/messaging', labelKey: 'messaging', icon: MessageSquare, permission: 'messages.send' },
    ],
  },
  {
    titleKey: 'sectionAnalytics',
    items: [
      { href: '/reports', labelKey: 'reports', icon: BarChart3, permission: 'reports.view' },
      { href: '/ai', labelKey: 'ai', icon: Bot, permission: 'ai.use' },
    ],
  },
  {
    items: [
      { href: '/integrations', labelKey: 'integrations', icon: Puzzle, permission: 'integrations.read' },
      { href: '/settings', labelKey: 'settings', icon: Settings, permission: 'settings.read' },
    ],
  },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const can = useAuth((s) => s.can);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface transition-[width]',
        collapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          E
        </div>
        {!collapsed && <span className="text-lg font-bold text-foreground">EduSphere</span>}
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {SECTIONS.map((section, i) => {
          const visible = section.items.filter((item) => !item.permission || can(item.permission));
          if (visible.length === 0) return null;
          return (
            <div key={i}>
              {section.titleKey && !collapsed && (
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t(section.titleKey)}
                </div>
              )}
              {visible.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:bg-muted-bg hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
