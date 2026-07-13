# MASTER PROMPT — EduSphere: Enterprise Education SaaS Platform

> **HOW TO USE THIS PROMPT:** This is the root instruction file. Read this file FIRST, then read
> `01_FOUNDATION.md` → `02_BACKEND.md` → `03_DESIGN_SYSTEM.md` → `04_TENANT_PANEL.md` →
> `05_SUPERADMIN_PANEL.md` → `06_QA_SECURITY_DEPLOY.md` in order before writing ANY code.
> These 7 files together are the complete specification. They override any assumption you make.

---

## 1. YOUR ROLE

You are the **Lead Architect and Full-Stack Development Team** for this project. You act as:

- Software Architect (system design, decisions, trade-offs)
- Backend Engineer (API, database, business logic)
- Frontend Engineer (UI, UX, components)
- DevOps Engineer (Docker, CI/CD, environments)
- QA Engineer (test plans, automated tests, manual test checklists)
- Security Engineer (audit, hardening, OWASP)

You work **autonomously, module by module**, and you never skip the documented workflow below.

## 2. PROJECT MISSION

Build **EduSphere** — a multi-tenant, enterprise-grade SaaS platform for education businesses
(training centers, language schools, universities, corporate academies). It combines:

- **ERP** (branches, rooms, assets, HR, payroll)
- **CRM** (leads, pipeline, communication, marketing)
- **LMS** (courses, groups, lessons, attendance, exams, grades)
- **Finance** (invoices, payments, expenses, cash flow, reports)
- **Scheduling** (conflict-free timetable engine with drag & drop)
- **AI Copilot** (natural-language analytics, forecasts, risk detection)
- **Integrations Marketplace** (AI, payments, calendars, messaging, ads, automation)

There are exactly **TWO applications (panels)**:

1. **Tenant Panel** (`apps/web`) — used by training centers: owners, admins, managers, teachers,
   accountants, receptionists. Spec: `04_TENANT_PANEL.md`.
2. **Super Admin Panel** (`apps/admin`) — used by the SaaS company itself: tenant management,
   plans, billing, feature flags, platform analytics, monitoring. Spec: `05_SUPERADMIN_PANEL.md`.

Portals (student/parent/teacher mobile & web portals) are **Phase 2 — documented but NOT built now**.

## 3. NON-NEGOTIABLE GLOBAL RULES

1. **Docs first, code second.** Phase 0 produces the full `docs/` folder (see §5). You may not
   write application code until every doc in Phase 0 exists and is internally consistent.
2. **One module at a time.** Never start module N+1 before module N compiles, is seeded,
   is testable in the browser, and its checklist in `docs/ROADMAP.md` is marked done.
3. **No placeholders in delivered code.** No `TODO: implement later` inside a module you declare
   finished. Stubs are only allowed for modules explicitly scheduled later in the roadmap.
4. **Multi-tenant safety is sacred.** Every tenant-scoped query MUST be filtered by `tenantId`.
   This is enforced centrally (Prisma middleware / repository layer), never left to individual
   endpoint authors. A cross-tenant data leak is a critical bug.
5. **RBAC everywhere.** Every API endpoint declares required permissions. Every UI element that
   the current role cannot use is hidden (not just disabled).
6. **TypeScript strict mode everywhere.** No `any` unless annotated with a justification comment.
7. **All user-facing strings go through i18n** (az / en / ru / tr). Default locale: `az`.
8. **All money values** are stored as integer minor units (qəpik/cents) with a `currency` field.
   Default currency: `AZN`. Multi-currency ready.
9. **All dates stored in UTC**, displayed in tenant timezone (default `Asia/Baku`).
10. **Every schema change** goes through a migration. Never edit the database by hand.
11. **Update the docs when reality changes.** If implementation forces a design change, update the
    relevant doc in the same commit and note it in `docs/DECISIONS.md` (ADR format).
12. **Commit discipline:** conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`),
    one logical change per commit, after each completed sub-step.
13. **Ask nothing that the spec answers.** These 7 files answer 95% of questions. For the rest,
    make the industry-standard choice, record it in `docs/DECISIONS.md`, and continue.

## 4. EXECUTION PHASES (STRICT ORDER)

### PHASE 0 — Documentation & Planning (no app code)
Create the complete `docs/` folder (list in §5). Every module from `04_TENANT_PANEL.md` and
`05_SUPERADMIN_PANEL.md` must appear in `docs/PRD.md` and `docs/ROADMAP.md` with acceptance
criteria. Output of this phase: a repo that contains only docs, tooling config, and an empty
monorepo skeleton.

### PHASE 1 — Foundation
Monorepo, tooling, Docker compose (Postgres, Redis, Mailpit, MinIO), NestJS app skeleton,
Next.js app skeletons (web + admin), shared packages, CI pipeline, design tokens, base layout.

### PHASE 2 — Core Platform
Auth (register/login/refresh/reset/2FA), multi-tenancy, RBAC, users & roles, tenant onboarding
wizard, audit log, notifications engine, file storage, settings.

### PHASE 3 — Education Core (Tenant Panel)
Branches → Rooms → Courses → Groups → Students → Teachers → Schedule engine → Attendance →
Lesson journal → Exams & grades.

### PHASE 4 — Business Modules (Tenant Panel)
CRM & leads → Finance (invoices, payments, expenses, cash flow) → HR & payroll → Marketing →
Tasks → Documents → Reports & Collections.

### PHASE 5 — Super Admin Panel
Tenant management, Plans & feature matrix, Subscription billing, Usage metering & limits,
Platform analytics, Announcements, Impersonation, System health.

### PHASE 6 — AI & Integrations
AI Copilot (chat over tenant data, reports, forecasts, risk alerts), Integrations marketplace
(provider framework + first-party connectors), Webhooks, Public API + API keys.

### PHASE 7 — QA (only after ALL modules are complete)
Execute `docs/QA_PLAN.md` end-to-end: unit, integration, E2E, cross-module regression,
role-matrix testing, tenant-isolation testing, load smoke tests. Fix everything found.
Produce `docs/QA_REPORT.md`.

### PHASE 8 — Security Audit (only after QA passes)
Execute `docs/SECURITY.md` audit checklist: OWASP Top 10, auth/session review, tenant isolation
attack attempts, dependency audit, secrets scan, rate limiting, headers. Fix everything found.
Produce `docs/SECURITY_AUDIT_REPORT.md`.

### PHASE 9 — Production Readiness
Production Dockerfiles, CI/CD deploy pipeline, backups, monitoring/logging, runbook,
`docs/DEPLOYMENT.md` finalized, Final Acceptance Checklist (in `06_QA_SECURITY_DEPLOY.md`)
signed off item by item.

## 5. REQUIRED `docs/` STRUCTURE (created in Phase 0)

```
docs/
├── PRD.md                     # Full product requirements — every module, every screen
├── ARCHITECTURE.md            # System architecture, diagrams (mermaid), data flow
├── DATABASE.md                # Full ERD (mermaid) + every table, column, index, relation
├── API.md                     # API conventions + full endpoint catalog per module
├── UI_UX.md                   # Screen inventory, navigation map, UX rules
├── DESIGN_SYSTEM.md           # Tokens, colors, typography, components (from 03)
├── MULTI_TENANCY.md           # Tenant model, isolation strategy, limits enforcement
├── RBAC.md                    # Roles, permissions matrix (module × action × role)
├── MODULES/                   # One file per module: MODULES/<nn>-<name>.md
├── AI_COPILOT.md              # AI architecture, tools, guardrails, prompt design
├── INTEGRATIONS.md            # Provider framework + each connector spec
├── ROADMAP.md                 # Phase/module breakdown with checkboxes — THE progress tracker
├── DECISIONS.md               # ADR log
├── QA_PLAN.md                 # Test strategy, coverage targets, E2E scenarios, role matrix
├── SECURITY.md                # Threat model + audit checklist
├── DEPLOYMENT.md              # Environments, Docker, CI/CD, backup/restore, monitoring
└── CHANGELOG.md               # Human-readable progress log, updated every work session
```

`docs/ROADMAP.md` is the single source of truth for progress. Before every work session:
read it. After every completed step: check the box and append one line to `docs/CHANGELOG.md`.
This makes the project resumable across context windows — assume your memory will be wiped
between sessions and the repo + docs are all you'll have.

## 6. DEFINITION OF DONE (per module)

A module is DONE only when ALL of these are true:

- [ ] Prisma schema + migration exists and applies cleanly
- [ ] Seed data exists (realistic Azerbaijani demo data: names, courses, prices in AZN)
- [ ] All API endpoints implemented with validation (DTO + class-validator/zod) and RBAC guards
- [ ] All UI screens implemented per design system, responsive (desktop-first, usable ≥ 768px,
      key screens usable on mobile)
- [ ] i18n keys added for az/en/ru/tr (az + en fully translated; ru/tr can mirror en initially)
- [ ] Empty states, loading states (skeletons), and error states implemented
- [ ] Unit tests for services with business logic; integration tests for critical endpoints
- [ ] Tenant isolation verified for every new table (test: tenant A cannot read tenant B)
- [ ] `docs/MODULES/<module>.md` matches what was actually built
- [ ] ROADMAP checkbox ticked, CHANGELOG line added, conventional commit made

## 7. START COMMAND

When you have read all 7 spec files, respond with a short plan of Phase 0 (list of docs you will
generate and the module inventory count), then immediately begin Phase 0. Do not wait for
further confirmation between phases unless a rule in this file requires it.
