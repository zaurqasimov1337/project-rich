# EduSphere — Enterprise Education SaaS Platform

Multi-tenant SaaS for training centers, language schools and academies: ERP + CRM + LMS +
Finance + HR + Marketing + Scheduling + AI Copilot, with a Tenant Panel and a Super Admin Panel.

## Stack

- **API:** NestJS 11, Prisma, PostgreSQL 16, Redis 7, BullMQ
- **Web:** Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui, TanStack Query
- **Monorepo:** pnpm workspaces — `apps/api`, `apps/web`, `packages/shared`
- **Infra:** Docker Compose (postgres, redis, minio, mailpit)

## Panels

| Panel | URL path | Users |
|---|---|---|
| Tenant Panel | `/` (`/dashboard`, …) | Training center staff (owner, admin, teacher, accountant, …) |
| Super Admin | `/superadmin` | Platform operators (tenants, plans, billing, analytics) |

Both panels live in one Next.js app with strictly separated auth realms (separate JWT audiences).

## Quick start

```bash
pnpm install
docker compose up -d          # postgres, redis, minio, mailpit
cp .env.example .env
pnpm db:migrate               # prisma migrate dev
pnpm db:seed                  # demo tenant + super admin
pnpm dev                      # api :4000, web :3000
```

Demo logins (after seed):

- Tenant owner: `owner@demo.az` / `Demo123!`
- Super admin: `root@edusphere.app` / `Root123!` (at `/superadmin`)

## Docs

`docs/PRD.md` · `docs/ARCHITECTURE.md` · `docs/DATABASE.md` · `docs/API.md` · `docs/UI.md` ·
`docs/SECURITY.md` · `docs/ROADMAP.md` (progress tracker). Original spec: `MASTER_PROMPT/`.
