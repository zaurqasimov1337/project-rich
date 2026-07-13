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
- [x] Tenant context (AsyncLocalStorage + Prisma extension) — isolation tests pending
- [ ] RBAC: permissions catalog, seeded roles, guards, /roles CRUD, custom roles
- [ ] Users & invitations
- [ ] Settings module + holidays
- [ ] Audit log (interceptor + viewer API)
- [ ] Files (MinIO presigned)
- [ ] Notifications engine (in-app + mail queue + templates)
- [ ] Web: auth pages, app shell, dashboard placeholder wired to /auth/me, settings/users/roles UI

## Phase 3 — Education core
- [ ] Branches (API+UI) → Rooms (+occupancy) → Course categories & Courses
- [ ] Students (CRUD, filters, import, detail tabs skeleton)
- [ ] Teachers (profile, rates, load)
- [ ] Groups (+roster & enrollment statuses)
- [ ] Schedule engine: rules, materialization job, validate endpoint (7 conflict types), lessons CRUD, series edits, cancel+notify
- [ ] Schedule UI: week/day/month/timeline + drag&drop + live validation
- [ ] Attendance + journal (API+UI quick-mark)
- [ ] Exams & grades + certificates
- [ ] Dashboard v1 (real KPIs)

## Phase 4 — Business modules
- [ ] CRM: stages, sources, leads kanban/table, activities, convert-to-student, funnel metrics
- [ ] Tasks
- [ ] Finance: cash accounts, invoices (+generation run), payments (idempotent), debts+dunning, expenses, transactions ledger, summary/cash-flow, discounts/promo
- [ ] Payroll: teacher rates → runs → payslips; HR employees + leave
- [ ] Marketing: campaigns, ad spends, metrics (CPL/CAC/ROAS)
- [ ] Messaging: templates, bulk send, logs
- [ ] Reports center + Collections (saved filters + bulk ops) + async exports

## Phase 5 — Super admin
- [ ] Platform auth + users/roles
- [ ] Tenants management (lifecycle, impersonation)
- [ ] Plans & feature matrix editor → runtime gates + usage metering + limits (402)
- [ ] Subscriptions & billing (invoices, manual payments, dunning job)
- [ ] Platform analytics dashboard (MRR, churn, usage)
- [ ] Announcements, feature flags, integration catalog admin, jobs monitor, platform audit

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
