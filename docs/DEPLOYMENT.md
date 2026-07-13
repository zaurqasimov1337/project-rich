# DEPLOYMENT

## Local development
```bash
pnpm install
docker compose up -d                 # postgres:5439 redis:6380 minio:9002 mailpit:8025
cp .env.example .env
pnpm --filter @edusphere/shared build
pnpm --filter @edusphere/api db:migrate
pnpm --filter @edusphere/api db:seed
pnpm dev                             # api :4100, web :3000
```
Demo: owner@demo.az / Demo123! · Super admin at /superadmin: root@edusphere.app / Root123!

## Production (Docker Compose)
Multi-stage Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile`. Both run as non-root.
The API container runs `prisma migrate deploy` on start, then boots.

```bash
# Required env (set in shell or a .env next to compose.prod):
export POSTGRES_PASSWORD=... S3_ACCESS_KEY=... S3_SECRET_KEY=...
export JWT_ACCESS_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
export CREDENTIALS_ENC_KEY=$(openssl rand -hex 32)
export APP_URL_WEB=https://app.yourdomain.az
export ANTHROPIC_API_KEY=...          # optional, enables AI Copilot

docker compose -f docker-compose.prod.yml up -d --build
```
Put a TLS-terminating reverse proxy (Caddy/Nginx/Traefik) in front:
`app.yourdomain.az` → web:3000, and `/api/*` → api:4000 (or let Next.js rewrite proxy it).
Set `Secure` cookies work automatically because `NODE_ENV=production`.

## Environments
| | dev | prod |
|---|---|---|
| Secrets | docker-compose defaults | shell env / secrets manager, zod-validated at boot |
| Cookies | Lax, not Secure | Lax, Secure |
| Swagger | `/api/docs` on | off |
| Prisma logs | warn | off |

## Migrations
`prisma migrate dev` (local, creates), `prisma migrate deploy` (prod, applies). Never edit the DB
by hand. Rollback = restore from backup + re-apply prior migration set.

## Backups & restore
- **Postgres:** nightly `pg_dump` to object storage, 30-day retention.
  ```bash
  docker exec edusphere-postgres pg_dump -U edusphere edusphere | gzip > backup-$(date +%F).sql.gz
  # restore: gunzip -c backup.sql.gz | docker exec -i edusphere-postgres psql -U edusphere edusphere
  ```
- **MinIO/S3:** bucket versioning + lifecycle; or `mc mirror` to a second bucket.
- **Redis:** ephemeral (cache, rate-limit, sessions denylist) — appendonly on for warm restart,
  but safe to lose; refresh tokens are in Postgres.

## Monitoring & logging
- Structured JSON logs (pino) with request-id, userId, tenantId, latency — ship to Loki/ELK/Datadog.
- Health: `GET /api/v1/health` (liveness), `/health/ready` (DB+Redis) — wire to orchestrator probes.
- Background jobs surface in logs; BullMQ dashboard (Bull Board) can be mounted in the admin panel.
- Alert on: 5xx rate, `/health/ready` failures, auth-failure spikes, plan-limit 402 spikes.

## CI/CD
`ci/ci.yml` (move to `.github/workflows/` once the git token has `workflow` scope): lint →
typecheck → API tests → build on every push/PR. Add a deploy job that builds+pushes the two
images and runs `docker compose -f docker-compose.prod.yml up -d` on the host.

## Scaling notes
- API is stateless (JWT + Redis) — scale horizontally behind a load balancer.
- Run schedule-materialize / billing / metering as a single worker replica (or use BullMQ
  job locks) to avoid duplicate runs.
- Postgres: add read replicas for reporting once report volume grows; all queries are already
  tenant-indexed.
