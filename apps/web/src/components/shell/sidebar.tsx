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
  Clock,
  DoorOpen,
  GraduationCap,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Network,
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
import { BrandIcon, BrandLogo } from '@/components/brand';

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
      { href: '/crm/team', labelKey: 'crmTeam', icon: UserRound, permission: 'leads.read' },
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
      { href: '/marketing/campaigns', labelKey: 'marketing', icon: Megaphone, permission: 'marketing.read' },
      { href: '/messaging', labelKey: 'messaging', icon: MessageSquare, permission: 'messages.send' },
    ],
  },
  {
    titleKey: 'sectionHr',
    items: [
      { href: '/hr/dashboard', labelKey: 'hrDashboard', icon: LayoutDashboard, permission: 'hr.employees.read' },
      { href: '/hr/employees', labelKey: 'hr', icon: Briefcase, permission: 'hr.employees.read' },
      { href: '/hr/structure', labelKey: 'hrStructure', icon: Building2, permission: 'hr.employees.read' },
      { href: '/hr/org-chart', labelKey: 'hrOrgChart', icon: Network, permission: 'hr.employees.read' },
      { href: '/hr/attendance', labelKey: 'hrAttendance', icon: Clock, permission: 'hr.employees.read' },
      { href: '/hr/leave', labelKey: 'hrLeave', icon: CalendarDays, permission: 'hr.leave.read' },
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

export function Sidebar({
  collapsed,
  mobileOpen = false,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const can = useAuth((s) => s.can);

  return (
    <>
      {mobileOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-border bg-sidebar/75 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 lg:transition-[width]',
          collapsed ? 'lg:w-16' : 'lg:w-[260px]',
          mobileOpen ? 'translate-x-0 shadow-[var(--shadow-lg)]' : '-translate-x-full',
        )}
      >
      <div className="flex h-14 items-center border-b border-border px-4">
        {collapsed ? <BrandIcon className="h-8" /> : <BrandLogo className="h-8" />}
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
                    onClick={onCloseMobile}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                      active
                        ? 'bg-primary/10 font-semibold text-foreground'
                        : 'text-muted hover:bg-muted-bg hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-all duration-150 ease-[var(--ease)]',
                        active ? 'opacity-100' : 'scale-y-0 opacity-0',
                      )}
                    />
                    <Icon
                      className={cn(
                        'h-4.5 w-4.5 shrink-0 transition-transform duration-150 ease-[var(--ease)] group-hover:scale-105',
                        active && 'text-primary',
                      )}
                    />
                    <span
                      className={cn(
                        'truncate transition-[opacity,transform] duration-200 ease-[var(--ease)]',
                        collapsed && 'lg:pointer-events-none lg:w-0 lg:-translate-x-1 lg:opacity-0',
                      )}
                    >
                      {t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
