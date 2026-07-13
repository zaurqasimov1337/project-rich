# ROADMAP — progress tracker (single source of truth)

Update after every completed step. `[x]` = done & committed.

## Phase 0 — Docs
- [x] MASTER_PROMPT specs (00–03)
- [x] README, PRD, ARCHITECTURE, DATABASE, API, UI, SECURITY, ROADMAP

## Phase 1 — Foundation
- [x] pnpm workspace + tooling (tsconfig, prettier, editorconfig, gitattributes)
- [x] docker-compose (postgres:5439, redis:6380, minio:9002, mailpit:8025 — ports shifted for host conflicts)
- [x] packages/shared (permissions catalog, enums, constants — built with tsup)
- [x] apps/api NestJS skeleton (zod env, prisma tenant-scoped client, health, pino, envelope, exception filter)
- [x] prisma schema v1 (platform + identity + org + system) + init migration + seed (plans, root@edusphere.app, demo tenant)
- [x] apps/web Next.js skeleton (tailwind v4 tokens, dark mode, next-intl az/en/ru/tr, query provider, api client)
- [x] CI workflow (lint, typecheck, test, build)

## Phase 2 — Core platform
- [x] Auth: register-tenant, login, refresh rotation (family reuse detection), logout, forgot/reset, invitations/accept, me — verified live
- [x] Tenant context (AsyncLocalStorage + Prisma extension) + 6 isolation tests passing
- [x] RBAC: permissions catalog, seeded roles, global AuthGuard, /roles CRUD (custom roles)
- [x] Users & invitations (invite by email, role assignment, owner protection)
- [x] Settings module (whitelisted keys) + holidays CRUD
- [x] Audit log (AuditService + viewer API) — call-site wiring expands with modules
- [x] Files (MinIO presigned upload/download, MIME+size whitelist, bucket bootstrap)
- [x] Notifications (in-app list/read; mail via MailService; queue delivery in Phase 4)
- [x] Web: login/register/forgot/reset pages, auth store with silent refresh, app shell (collapsible sidebar with permission gating, topbar, dark mode), dashboard v0 — login→dashboard verified in browser
- [ ] Settings/users/roles UI pages (with education modules in Phase 3)

## Phase 3 — Education core
- [x] Branches (API+UI cards) · Rooms (API+occupancy+reservations, UI cards) · Categories & Courses (API+UI)
- [x] Students (CRUD, search/filters, detail tabs: profile/groups/attendance/grades; import → Phase 4 Collections)
- [x] Teachers (profile over user, rates, weekly load endpoint, UI list)
- [x] Groups (CRUD, roster, enroll/drop/freeze, fill-rate, detail UI)
- [x] Schedule engine: 8 conflict rules, rule materialization (12 weeks), validate endpoint, series edits (one/following), cancel+notify — 8 integration tests passing
- [x] Schedule UI: week grid + navigation (drag&drop + timeline views → Phase 9 polish)
- [x] Attendance quick-mark UI (today's lessons, one-tap) + journal API
- [x] Exams: create, bulk results entry UI, student grades (certificates → Phase 4)
- [x] Dashboard v1: real KPIs (students, groups, today lessons, attendance rate) + upcoming lessons, 60s cache
- [ ] Settings UI (users/roles/holidays) — with Phase 4 batch

## Phase 4 — Business modules
- [ ] CRM: stages, sources, leads kanban/table, activities, convert-to-student, funnel metrics
- [ ] Tasks
- [ ] Finance: cash accounts, invoices (+generation run), payments (idempotent), debts+dunning, expenses, transactions ledger, summary/cash-flow, discounts/promo
- [ ] Payroll: teacher rates → runs → payslips; HR employees + leave
- [ ] Marketing: campaigns, ad spends, metrics (CPL/CAC/ROAS)
- [ ] Messaging: templates, bulk send, logs
- [ ] Reports center + Collections (saved filters + bulk ops) + async exports

## Phase 5 — Super admin
- [x] Platform auth (separate realm, cookie `prt`, refresh rotation) + /superadmin login
- [x] Tenants management: list w/ usage counts, detail, suspend/restore, plan switch, impersonation endpoint (30-min token, audited)
- [x] Plans & feature matrix (read UI + update API) — runtime gates/metering → Phase 6
- [x] Platform analytics (MRR/ARR from active subscriptions, tenants by status, recent signups) — verified in browser
- [x] Platform audit log (writes on tenant update/impersonate + viewer UI)
- [ ] Subscriptions billing automation (renewal/dunning jobs), announcements, feature flags UI → Phase 6/9

## Phase 6 — AI & integrations
- [x] AI Copilot: Anthropic SDK (claude-opus-4-8, env-configurable), 7 read-only tenant-scoped analytics tools (KPIs, revenue, debtors, course performance, teacher load, attendance+churn-risk, lead funnel), manual tool loop with refusal handling, conversation persistence, token usage log, graceful no-key fallback with live KPIs — verified
- [x] Plan enforcement: PlanService (limits 402 / features 403 / monthly AI quota), wired into student/user/branch creation and AI chat
- [x] AI chat UI: conversation sidebar, suggestions, typing indicator
- [x] Reports center: 7 reports (revenue/debts/attendance/group-fill/teacher-load/course-roi/lead-funnel) + XLSX/CSV export + browser print — verified
- [x] HR: employees + leave requests (approve/reject) — E2E verified
- [x] Integrations marketplace: 24 providers/10 categories, AES-256-GCM encrypted creds
- [x] Webhooks: HMAC-signed delivery + retry + SSRF guard; wired payment.received
- [x] Public API keys: create/list/revoke, sha256-hashed, shown once
- [x] Messaging: templates + bulk email/SMS with {{placeholders}} — email delivery verified via Mailpit

Remaining for future: Phase-2 portals (student/parent/teacher), mobile apps, live SMS connector impl (framework + logging done), calendar/ads OAuth connectors (catalog + encrypted-cred framework done).

## Phase 7 — QA ✅
- [x] Unit+integration suite green (21 tests: isolation, schedule engine, finance flow)
- [x] Browser E2E (gstack): auth, dashboard, attendance mark, schedule, superadmin — 0 console errors
- [x] Role-matrix sweep (11 cases) + 2-tenant isolation + IDOR sweep; 3 bugs fixed; QA_REPORT.md

## Phase 8 — Security ✅
- [x] Dedicated Security Engineer code review + live attack probes; SECURITY_AUDIT_REPORT.md
- [x] No critical/high; fixed M1 (file download authz), M4 (idempotency race), L5 (JWT alg pin),
      L8 (global rate limiting), L9 (impersonation audit + prod S3 creds); post-fix re-verified

## Phase 9 — Production ✅
- [x] Prod Dockerfiles (non-root, multi-stage) + compose.prod (secret guards)
- [x] Both production builds pass (api nest build, web next build ~102kB shared)
- [x] Backups + restore + monitoring/scaling → DEPLOYMENT.md
- [x] Final acceptance checklist → ACCEPTANCE.md
