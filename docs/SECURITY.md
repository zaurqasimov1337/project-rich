# SECURITY

## Controls (built-in from Phase 2)
- **Passwords:** argon2id; complexity ≥8 + classes; breach-common blocklist.
- **Sessions:** JWT access 15m; rotating refresh (httpOnly, Secure, SameSite=Lax cookie,
  hashed at rest, family reuse-detection → revoke family). Logout revokes. Session list UI.
- **Realms:** tenant vs platform JWT audiences; guards reject cross-realm tokens.
- **Tenant isolation:** Prisma extension injects `tenant_id` from AsyncLocalStorage on every
  query for scoped models; unit tests assert cross-tenant reads fail for every new model.
- **RBAC:** default-deny; `@RequirePermissions` on every route; UI gates mirror API.
- **Validation:** zod DTOs on every input; whitelist strip unknown fields; UUID params checked.
- **SQLi:** Prisma parameterized only; `$queryRaw` forbidden except reviewed, parameterized
  report queries. **XSS:** React escaping; no `dangerouslySetInnerHTML` (rich text sanitized
  server-side). **CSRF:** bearer header for API; refresh cookie endpoint origin-checked.
  **SSRF:** webhook/integration URLs validated (no private IP ranges, DNS re-resolution check).
- **Rate limiting:** Redis sliding window — global per IP, strict on auth (login 5/min,
  reset 3/h), per-API-key per plan. Account lockout with backoff.
- **File uploads:** type+size whitelist, content sniffing, random keys, private buckets,
  presigned URLs, no execution path, per-plan quota.
- **Secrets:** env only, zod-validated; integration credentials AES-256-GCM at rest (key from
  env); API keys & webhook secrets hashed/encrypted; secret shown once.
- **Headers:** helmet — CSP, HSTS, nosniff, frame-deny, referrer-policy. CORS allowlist.
- **Audit:** auth events, permission changes, exports, impersonation, destructive ops.
- **AI Copilot guardrails:** read-only whitelisted tools; tenant-scoped context injection;
  prompt-injection resistant (tool results treated as data); usage metering; no PII leaves
  tenant scope beyond configured provider.
- **Dependencies:** `pnpm audit` in CI; lockfile committed; Renovate-ready.

## Phase 8 audit checklist (execute after QA; produce SECURITY_AUDIT_REPORT.md)
1. OWASP Top 10 walkthrough with concrete attempts per category
2. Tenant-isolation attack: authenticated tenant A requests every endpoint with tenant B ids
   (automated test sweep over route catalog)
3. RBAC matrix sweep: each role × each endpoint → expected 200/403 table
4. Auth: token replay, refresh reuse, expired/foreign-audience tokens, 2FA bypass attempts,
   reset-token brute force, session fixation
5. Injection: SQLi payloads on all filters/search, XSS payloads on all text fields (stored +
   reflected), header injection in exports/emails
6. IDOR sweep on all `:id` params (cross-tenant + cross-branch + cross-role)
7. File upload abuse: polyglot files, oversized, wrong MIME, path traversal keys
8. SSRF via webhook endpoint URL & integration configs
9. Rate limit verification (auth, API keys, AI endpoints)
10. Secrets scan (gitleaks) + dependency audit + Docker image scan
11. Business logic: negative payments, invoice tampering, plan-limit bypass, promo reuse,
    payroll manipulation, impersonation audit completeness
12. Headers/CSP/CORS verification; cookie flags; error responses leak nothing (stack, SQL)
