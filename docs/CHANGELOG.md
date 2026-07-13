# CHANGELOG

Human-readable progress log. Format: `YYYY-MM-DD — module — what shipped`.

## 2026-07-13
- docs — Phase 0: PRD, ARCHITECTURE, DATABASE, API, UI, SECURITY, REPORTING, ROADMAP
- foundation — pnpm monorepo, docker-compose, NestJS + Next.js skeletons, shared package, CI
- core — auth (login/register/refresh-rotation/reset/invitations), tenant isolation (Prisma extension), RBAC, users/roles/settings/audit/files/notifications; web auth pages + app shell
- education — branches, rooms, courses, students, teachers, groups; schedule engine (8 conflict rules) + materialization; attendance/journal; exams; dashboard KPIs
- education-ui — students/groups/courses/teachers/rooms/branches pages, schedule week grid, attendance quick-mark, exam results, student/group detail tabs
- business — CRM (kanban, lead→student convert, funnel), finance (invoices, idempotent payments, expenses, cash accounts, debts, P&L), payroll runs, tasks, marketing (campaigns, CPL/CAC/ROAS)
- business-ui — CRM board, finance suite (overview/debts/invoices/payments/expenses/payroll), tasks, marketing, settings
- superadmin — platform auth realm, tenants management (suspend/plan-switch/impersonate), plans feature-matrix, analytics (MRR/ARR), platform audit
- ai — AI Copilot with 7 read-only tenant-scoped analytics tools, conversation persistence, plan enforcement (limits/features/AI quota)
- qa — 21 tests passing (isolation, schedule, finance); RBAC/auth sweep; 2-tenant isolation + IDOR probes; fixed platform-login FK bug, ALS lazy-promise bug
- security — global rate limiting (429 verified), production Dockerfiles (non-root), compose.prod, DEPLOYMENT.md
- security-fixes — audit findings fixed (file authz, idempotency race, JWT alg pin, impersonation audit)
- reports — 7 report generators + XLSX/CSV export engine + browser print; reports center UI
- hr — employees + leave requests (approve/reject) API + UI
- integrations — marketplace (24 providers), AES-256-GCM encrypted creds, webhooks (HMAC + retry + SSRF guard), public API keys
- messaging — templates + bulk email/SMS with placeholder rendering; email delivery verified
