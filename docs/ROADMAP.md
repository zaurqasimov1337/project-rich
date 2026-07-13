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
- [ ] AI provider adapter (Anthropic/OpenAI key-based) + tool framework (read-only, tenant-scoped)
- [ ] AI chat (SSE) + insights job (weekly report, churn-risk, overdue spike) + usage metering
- [ ] Integrations marketplace UI + connect framework (encrypted creds)
- [ ] Connectors v1: SMTP, generic webhook, Google Calendar push, AI keys
- [ ] Public API keys + scoped access + rate limits; webhook endpoints + deliveries + retries

## Phase 7 — QA
- [ ] Unit+integration suite green, coverage ≥70% services
- [ ] Playwright E2E: auth, student lifecycle, schedule conflict, payment flow, lead convert, superadmin tenant+plan
- [ ] Role-matrix sweep; tenant-isolation sweep; fix all; QA_REPORT.md

## Phase 8 — Security
- [ ] Execute SECURITY.md checklist; fix all; SECURITY_AUDIT_REPORT.md

## Phase 9 — Production
- [ ] Perf pass (indexes, N+1, bundle, caching)
- [ ] Prod Dockerfiles + compose.prod + CI deploy job
- [ ] Backups + restore runbook + monitoring/log guidance → DEPLOYMENT.md
- [ ] Final acceptance checklist signed
