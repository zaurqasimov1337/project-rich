/**
 * Permission catalog — single source of truth for API guards and UI gates.
 * Format: `<module>.<action>`.
 */
export const PERMISSIONS = {
  // Dashboard
  'dashboard.view': 'dashboard.view',

  // CRM
  'leads.read': 'leads.read',
  'leads.create': 'leads.create',
  'leads.update': 'leads.update',
  'leads.delete': 'leads.delete',
  'leads.convert': 'leads.convert',
  'leads.settings': 'leads.settings', // stages & sources

  // Students
  'students.read': 'students.read',
  'students.create': 'students.create',
  'students.update': 'students.update',
  'students.delete': 'students.delete',
  'students.import': 'students.import',
  'students.export': 'students.export',
  'students.bulk': 'students.bulk',

  // Teachers
  'teachers.read': 'teachers.read',
  'teachers.create': 'teachers.create',
  'teachers.update': 'teachers.update',
  'teachers.delete': 'teachers.delete',
  'teachers.rates': 'teachers.rates',

  // Courses & groups
  'courses.read': 'courses.read',
  'courses.manage': 'courses.manage',
  'groups.read': 'groups.read',
  'groups.manage': 'groups.manage',
  'groups.enroll': 'groups.enroll',

  // Schedule
  'schedule.read': 'schedule.read',
  'schedule.manage': 'schedule.manage',
  'schedule.cancel': 'schedule.cancel',

  // Attendance / journal / exams
  'attendance.read': 'attendance.read',
  'attendance.mark': 'attendance.mark',
  'journal.write': 'journal.write',
  'exams.read': 'exams.read',
  'exams.manage': 'exams.manage',
  'certificates.issue': 'certificates.issue',

  // Org
  'branches.read': 'branches.read',
  'branches.manage': 'branches.manage',
  'rooms.read': 'rooms.read',
  'rooms.manage': 'rooms.manage',

  // Finance
  'finance.read': 'finance.read',
  'finance.invoices.manage': 'finance.invoices.manage',
  'finance.invoices.void': 'finance.invoices.void',
  'finance.payments.create': 'finance.payments.create',
  'finance.refunds.create': 'finance.refunds.create',
  'finance.expenses.manage': 'finance.expenses.manage',
  'finance.accounts.manage': 'finance.accounts.manage',
  'finance.discounts.manage': 'finance.discounts.manage',
  'finance.payroll.read': 'finance.payroll.read',
  'finance.payroll.manage': 'finance.payroll.manage',

  // HR
  'hr.employees.read': 'hr.employees.read',
  'hr.employees.manage': 'hr.employees.manage',
  'hr.leave.read': 'hr.leave.read',
  'hr.leave.approve': 'hr.leave.approve',

  // Marketing
  'marketing.read': 'marketing.read',
  'marketing.manage': 'marketing.manage',

  // Tasks
  'tasks.read': 'tasks.read',
  'tasks.manage': 'tasks.manage',

  // Reports & collections
  'reports.view': 'reports.view',
  'reports.export': 'reports.export',
  'reports.print': 'reports.print',

  // Messaging
  'messages.send': 'messages.send',
  'messages.templates': 'messages.templates',

  // AI
  'ai.use': 'ai.use',
  'ai.insights': 'ai.insights',

  // Integrations & API
  'integrations.read': 'integrations.read',
  'integrations.manage': 'integrations.manage',
  'apikeys.manage': 'apikeys.manage',
  'webhooks.manage': 'webhooks.manage',

  // Settings & admin
  'settings.read': 'settings.read',
  'settings.manage': 'settings.manage',
  'users.read': 'users.read',
  'users.manage': 'users.manage',
  'roles.manage': 'roles.manage',
  'audit.read': 'audit.read',
  'billing.manage': 'billing.manage', // subscription/plan — owner only by default
  'files.manage': 'files.manage',
  'files.read': 'files.read',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Default (seeded) tenant roles → permission sets. Owner gets everything. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[] | '*'> = {
  owner: '*',
  admin: ALL_PERMISSIONS.filter((p) => p !== 'billing.manage') as Permission[],
  branch_manager: [
    'dashboard.view',
    'leads.read', 'leads.create', 'leads.update', 'leads.convert',
    'students.read', 'students.create', 'students.update', 'students.export', 'students.bulk',
    'teachers.read',
    'courses.read', 'groups.read', 'groups.manage', 'groups.enroll',
    'schedule.read', 'schedule.manage', 'schedule.cancel',
    'attendance.read', 'attendance.mark', 'journal.write',
    'exams.read', 'exams.manage',
    'branches.read', 'rooms.read', 'rooms.manage',
    'finance.read', 'finance.payments.create',
    'tasks.read', 'tasks.manage',
    'reports.view', 'reports.export',
    'messages.send',
    'users.read',
    'ai.use',
  ],
  teacher: [
    'dashboard.view',
    'students.read',
    'courses.read', 'groups.read',
    'schedule.read',
    'attendance.read', 'attendance.mark', 'journal.write',
    'exams.read', 'exams.manage',
    'tasks.read', 'tasks.manage',
  ],
  accountant: [
    'dashboard.view',
    'students.read',
    'finance.read', 'finance.invoices.manage', 'finance.invoices.void',
    'finance.payments.create', 'finance.refunds.create', 'finance.expenses.manage',
    'finance.accounts.manage', 'finance.discounts.manage',
    'finance.payroll.read', 'finance.payroll.manage',
    'reports.view', 'reports.export',
    'audit.read',
  ],
  receptionist: [
    'dashboard.view',
    'leads.read', 'leads.create', 'leads.update', 'leads.convert',
    'students.read', 'students.create', 'students.update',
    'courses.read', 'groups.read', 'groups.enroll',
    'schedule.read',
    'finance.read', 'finance.payments.create',
    'tasks.read', 'tasks.manage',
    'messages.send',
  ],
  marketer: [
    'dashboard.view',
    'leads.read', 'leads.create', 'leads.update', 'leads.settings',
    'marketing.read', 'marketing.manage',
    'reports.view',
    'messages.send', 'messages.templates',
    'ai.use',
  ],
};

/** Platform (super admin) realm roles. */
export const PLATFORM_ROLES = ['super_admin', 'support', 'finance', 'analyst'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];
