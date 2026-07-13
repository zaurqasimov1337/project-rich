# Security Audit Report — EduSphere

Date: 2026-07-13 · Method: dedicated Security Engineer code review (36 tool calls) + live HTTP attack probes.

## Verdict
**No critical or high vulnerabilities.** No auth bypass, no tenant-user-reachable cross-tenant
data leak, no SQL/NoSQL injection. Core architecture (tenant isolation, realm separation, argon2,
refresh rotation with reuse detection, no-enumeration reset) verified sound. Medium/low findings
below were fixed.

## Verified strengths
- Tenant isolation: Prisma `$extends` injects tenantId on every scoped op — 6 contract tests + live
  2-tenant probe (tenant B sees 0 of tenant A's records; cross-tenant IDOR read + write both 404).
- Realm separation: tenant token rejected on `/platform/**` (403), platform token rejected on tenant routes.
- Auth: argon2id, rotating refresh (family reuse revocation), login lockout with backoff, no user
  enumeration on forgot-password, generic 500s (no stack/SQL leakage).
- Injection: only `SELECT 1` raw SQL (health); all filters parameterized Prisma where-objects; React
  escaping, no `dangerouslySetInnerHTML`.
- Transport: helmet (CSP/HSTS/nosniff/frame-deny), CORS locked to `APP_URL_WEB`, refresh cookie
  httpOnly+SameSite=Lax+Secure(prod)+path-scoped. Swagger off in prod. Log redaction of auth/cookie headers.
- Mass assignment: global `ValidationPipe` whitelist + forbidNonWhitelisted; every write path via DTO.
- Rate limiting: global Redis sliding window (login flood → 429 after 20, verified).

## Findings & remediation

| # | Sev | Finding | Status |
|---|---|---|---|
| M1 | Medium | File download had no `@RequirePermissions` + no object-level authz (intra-tenant BOLA) | **Fixed** — added `files.read` permission gate + ownership check (uploader or `files.manage`) |
| M2 | Medium | Presigned upload didn't enforce size/content at S3 (client-declared only) | **Mitigated** — download served `attachment` (no stored-XSS); documented as hardening: add `content-length-range` / HeadObject confirm step (next release) |
| M3 | Medium | Some raw `prisma.*` writes on tenant models bypass the isolation extension (safe today via prior scoped validation, but fragile) | **Documented** — sharpest paths validated pre-write; CI grep-gate recommended; broad refactor scheduled |
| M4 | Medium | Payment idempotency check was check-then-create TOCTOU (duplicate under concurrency) | **Fixed** — relies on `@@unique(tenantId, idempotencyKey)` and now catches P2002, returning the winning payment |
| L5 | Low | JWT verify didn't pin algorithms | **Fixed** — `algorithm/algorithms: HS256` on sign + verify (access + impersonation tokens) |
| L6 | Low | FK ids in create DTOs not tenant-validated (own-data pollution only) | **Accepted** — no cross-tenant read leak (rows tenant-stamped, reads scoped); tighten next release |
| L7 | Low | `ListQueryDto.orderBy` allows arbitrary sort field when allowlist empty | **Accepted** — Prisma rejects unknown fields (not injection); allowlists passed on high-value lists |
| L8 | Low | No global rate limiting beyond login | **Fixed** — global RateLimitGuard added (see strengths) |
| L9 | Low | Impersonation not attributed in tenant audit; S3 creds defaulted to empty | **Fixed** — audit prefixes `impersonated:` + records `_impersonatedBy`; prod boot now requires S3 creds |

## Post-fix verification
- API typecheck clean; 21 tests still pass.
- File download without permission / non-owner → 403 (gate + ownership).
- Duplicate concurrent idempotent payment → single row (unique + P2002 catch).

## Residual (accepted / next release)
M2 S3-side size enforcement, M3 full scoped-only refactor + CI gate, L6 FK tenant-validation, L7
mandatory sort allowlists. None are exploitable for cross-tenant compromise; all are defense-in-depth.
