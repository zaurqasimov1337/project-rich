# PART 1 — FOUNDATION: Tech Stack, Standards, Repository Structure

## 1. TECH STACK (fixed — do not substitute)

### Monorepo
- **pnpm workspaces + Turborepo**
- Node.js 22 LTS, TypeScript 5.x strict

### Backend — `apps/api`
- **NestJS 11** (REST, modular architecture)
- **PostgreSQL 16** + **Prisma ORM** (migrations, typed client)
- **Redis 7** — cache, sessions denylist, rate limiting, queues
- **BullMQ** — background jobs (emails, SMS, reports, AI jobs, webhooks, recurring billing)
- **Zod** (via nestjs-zod) or class-validator — request validation (pick one, use everywhere)
- **Passport + JWT** — auth (see 02_BACKEND.md)
- **MinIO** (S3-compatible) — file storage; S3 SDK so production can use any S3
- **Mailpit** in dev; provider-agnostic mail service (SMTP / Resend adapter)
- **OpenAPI** — auto-generated Swagger at `/api/docs` (dev only), exported to `docs/API.md` refs
- **Pino** — structured JSON logging with request-id correlation

### Frontend — `apps/web` (Tenant Panel) and `apps/admin` (Super Admin Panel)
- **Next.js 15 (App Router) + React 19**, TypeScript
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives) — themed by our design tokens (Part 3)
- **TanStack Query v5** — server state; **Zustand** — minimal client state
- **React Hook Form + Zod** — forms
- **next-intl** — i18n (az default, en, ru, tr)
- **Recharts** — charts; **FullCalendar** (or custom grid) — schedule views with drag & drop
- **TanStack Table v8** — all data tables
- **Lucide** icons only

### Shared packages — `packages/*`
- `packages/shared` — zod schemas, DTO types, enums, permission constants (single source of truth
  shared by API and both frontends)
- `packages/ui` — design system components used by both panels
- `packages/config` — eslint, tsconfig, tailwind preset, prettier

### Infra
- **Docker Compose** for dev: postgres, redis, minio, mailpit, api, web, admin
- **GitHub Actions** CI: lint → typecheck → test → build (every PR/push)
- Production: multi-stage Dockerfiles per app (Phase 9)

## 2. REPOSITORY STRUCTURE

```
edusphere/
├── apps/
│   ├── api/                  # NestJS
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── common/       # guards, interceptors, filters, decorators, pipes
│   │       ├── core/         # prisma, redis, queue, mail, storage, config, i18n
│   │       └── modules/      # one folder per business module
│   │           └── <module>/
│   │               ├── <module>.module.ts
│   │               ├── <module>.controller.ts
│   │               ├── <module>.service.ts
│   │               ├── dto/
│   │               └── <module>.spec.ts
│   ├── web/                  # Tenant panel (Next.js)
│   │   └── src/
│   │       ├── app/[locale]/(auth)/...       # login, register, forgot
│   │       ├── app/[locale]/(dashboard)/...  # all modules
│   │       ├── components/   # app-specific components
│   │       ├── features/     # one folder per module: api hooks, components, types
│   │       └── lib/          # api client, utils, providers
│   └── admin/                # Super admin panel (Next.js, same conventions)
├── packages/
│   ├── shared/
│   ├── ui/
│   └── config/
├── prisma/                   # schema.prisma, migrations/, seed.ts
├── docs/
├── docker-compose.yml
├── turbo.json
└── package.json
```

## 3. CODING STANDARDS

1. **Naming:** DB tables `snake_case` plural; Prisma models PascalCase singular; API routes
   kebab-case plural (`/api/v1/students`); components PascalCase; hooks `useX`.
2. **API layer never contains business logic** — controllers are thin; services own logic;
   repositories/Prisma calls are isolated in services.
3. **Feature-folder frontend:** everything for a module lives in `features/<module>/`
   (`api.ts` hooks, `components/`, `types.ts`, `schemas.ts`). Pages compose features.
4. **No copy-paste between panels** — shared visuals go to `packages/ui`, shared types/schemas
   to `packages/shared`.
5. **Error handling:** global NestJS exception filter → unified error envelope (Part 2 §4).
   Frontend: TanStack Query error boundaries + toast with human-readable i18n message.
6. **Every list endpoint** supports pagination (`page`, `limit` ≤ 100), sorting, filtering,
   and text search where meaningful. Default sort: newest first.
7. **Soft delete** (`deletedAt`) for business entities (students, groups, invoices…);
   hard delete only for junk (drafts, notifications).
8. **Audit fields** on every table: `createdAt`, `updatedAt`, `createdById` where meaningful.
9. **Comments:** only for non-obvious constraints/decisions. Code should read without them.
10. **Tests:** Vitest/Jest for API unit+integration (target ≥ 70% on services with logic),
    Playwright for E2E (Phase 7 expands; smoke E2E for auth + one CRUD exists from Phase 2).

## 4. ENVIRONMENT & CONFIG

- `.env.example` always current; config validated at boot with zod — app refuses to start on
  missing/invalid env.
- Secrets never committed. Dev defaults live in docker-compose only.
- Key envs: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `S3_*`, `SMTP_*`, `APP_URL_WEB`, `APP_URL_ADMIN`, `AI_PROVIDER`, `ANTHROPIC_API_KEY` (optional),
  `OPENAI_API_KEY` (optional).

## 5. DEVELOPMENT WORKFLOW (every module, every time)

1. Read the module spec in `docs/MODULES/<module>.md` (write it first if Phase 0 missed detail).
2. Prisma schema + migration + seed.
3. API: DTOs → service → controller → RBAC guard wiring → OpenAPI annotations.
4. API tests (service unit + endpoint integration incl. tenant-isolation case).
5. Frontend: feature folder → screens → wire to API → states (loading/empty/error) → i18n.
6. Manual smoke test in browser with seeded data.
7. Update docs (module doc, ROADMAP checkbox, CHANGELOG) + conventional commit.

## 6. GIT & BRANCHING

- Single `main` branch (solo agent development); commit small and often.
- Tags at phase completion: `phase-0` … `phase-9`.
- CHANGELOG.md entry format: `YYYY-MM-DD — <module> — <what was delivered>`.
