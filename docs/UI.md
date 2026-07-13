# UI

Design system spec: `MASTER_PROMPT/03_DESIGN_SYSTEM.md` (tokens, colors, typography,
components, UX rules). This file: navigation & screen inventory.

## Shell
Sidebar (260px, collapsible) + topbar (search Cmd+K, branch switcher, quick-create, bell,
locale, theme, user menu). Tenant accent: indigo `#4F46E5`; Superadmin accent: teal `#0F766E`.
Dark/light via CSS vars. Fonts: Inter. Body 14px, tables 13px, tabular numbers.

## Tenant panel routes (`apps/web`)
```
/login /register /forgot-password /reset-password /invite/[token]
/dashboard
/crm/leads (kanban|table) /crm/leads/[id]
/students /students/[id] (tabs: profile|groups|payments|attendance|grades|docs|timeline)
/teachers /teachers/[id] (tabs: profile|groups|load|rates|payroll)
/courses /courses/[id]   /groups /groups/[id]
/schedule (day|week|month|timeline views, drag&drop)
/attendance (today's lessons quick-mark)
/exams /exams/[id]
/rooms /rooms/[id]  /branches
/finance (overview) /finance/invoices /finance/payments /finance/debts /finance/expenses
/finance/cash-accounts /finance/payroll
/hr/employees /hr/leave
/marketing/campaigns /marketing/analytics
/tasks
/reports /reports/[key]  /collections
/ai (copilot chat + insights)
/integrations
/settings/* (profile|branches|users|roles|pipeline|sources|templates|holidays|billing|
             api-keys|webhooks|audit)
```

## Superadmin routes (same app, `/superadmin/*`)
```
/superadmin/login
/superadmin (dashboard: MRR, tenants, churn)
/superadmin/tenants /superadmin/tenants/[id]
/superadmin/plans /superadmin/plans/[id]
/superadmin/billing
/superadmin/users /superadmin/announcements /superadmin/feature-flags
/superadmin/integrations /superadmin/jobs /superadmin/audit
```

## Screen patterns
- List = DataTable (search, filters, saved filters, column toggle, bulk bar, export).
- Detail = header card (avatar/status/primary actions) + tabs.
- Create/edit = drawer for simple entities, page wizard for student/lead-convert/tenant-signup.
- Schedule = calendar grid, conflict validation live during drag; conflict list panel on save.
- Every screen: skeleton loading, designed empty state (CTA), error state with retry.
- Mobile ≥360px usable: dashboard, schedule (day view), students list, payment intake.
