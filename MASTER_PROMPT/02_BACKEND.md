# PART 2 — BACKEND: Multi-Tenancy, Auth, RBAC, Database, API Design

## 1. MULTI-TENANT ARCHITECTURE

**Strategy: shared database, shared schema, row-level isolation via `tenantId`.**

- Every tenant-scoped table has `tenant_id UUID NOT NULL` + composite indexes starting with it.
- A **Prisma client extension** injects `tenantId` into every query/create/update automatically
  from request context (AsyncLocalStorage). Endpoint code physically cannot forget the filter.
- Global (non-tenant) tables: `tenants`, `plans`, `platform_users`, `feature_flags`,
  `integration_catalog`, `system_settings`, `audit_platform`.
- **Tenant resolution:** JWT claim `tid`. (Subdomain routing `*.edusphere.app` is documented as
  Phase 2+ enhancement; JWT claim is authoritative.)
- **Branch scoping inside a tenant:** most education entities also carry `branchId`. Users have
  branch assignments; data access respects them (a branch manager sees only their branches).
- **Limits enforcement:** plan limits (max students, teachers, branches, storage, AI requests,
  API calls) are checked in a central `UsageService` before creating limited resources and
  metered daily into `usage_records`.

### Tenant lifecycle
`trial` → `active` → `past_due` → `suspended` → `cancelled` → (retention window) → purge.
Suspended tenants: users can log in but see only a "subscription required" screen + billing.

## 2. AUTHENTICATION

- **JWT access token** (15 min) + **rotating refresh token** (30 days, httpOnly secure cookie,
  stored hashed in DB, revocable, reuse detection revokes the whole family).
- Login with email + password (argon2id). Optional **TOTP 2FA** (mandatory-capable per tenant policy).
- Flows: register-tenant (onboarding wizard creates tenant + owner), login, logout,
  refresh, forgot/reset password (signed one-time token, 30 min), email verification,
  invite-user (admin invites by email → set-password flow), change password (revokes sessions).
- **Session management UI:** user sees active sessions (device, IP, last seen) and can revoke.
- Rate limits: login 5/min/IP + lockout with exponential backoff per account; reset 3/hour.
- Two user realms: `users` (tenant panel, tenant-scoped) and `platform_users` (super admin panel).
  Separate JWT audiences; a tenant token is never valid on admin API and vice versa.
- **Impersonation:** super admin can mint a short-lived (30 min) impersonation token for a tenant
  user; banner shows in UI; every action audit-logged with both identities.

## 3. RBAC

### System roles (tenant panel) — seeded per tenant, plus custom roles
| Role | Summary |
|---|---|
| `owner` | Everything incl. billing, cannot be deleted |
| `admin` | Everything except billing/plan & tenant deletion |
| `branch_manager` | Full control limited to assigned branches |
| `teacher` | Own groups: schedule, attendance, journal, grades, materials |
| `accountant` | Finance module full; students read-only |
| `receptionist` | CRM/leads, student registration, payments intake, schedule read |
| `marketer` | Marketing module, campaigns, lead sources, read-only reports |
| `custom:*` | Tenant-defined: any permission set |

### Permission model
- Format: `<module>.<action>` — e.g. `students.read`, `students.create`, `finance.invoice.void`,
  `schedule.manage`, `reports.export`. Full matrix generated in `docs/RBAC.md`.
- Stored: `roles`, `permissions` (constants in `packages/shared`), `role_permissions`,
  `user_roles` (+ optional branch scope per assignment).
- Enforced by `@RequirePermissions()` decorator + guard on every controller route.
  Frontend gets the current user's permission set at login → `<Can permission="x">` component
  and hook `usePermission()` hide unauthorized UI.
- Super admin panel has its own small role set: `super_admin`, `support`, `finance`, `analyst`.

## 4. API DESIGN

- Base: `/api/v1`. Resource-oriented REST, kebab-case plural nouns.
- **Response envelope:**
```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 143 } }
{ "success": false, "error": { "code": "STUDENT_NOT_FOUND", "message": "…", "details": [] } }
```
- Error codes are stable string constants; messages localized via `Accept-Language`.
- Validation errors: `422` with per-field details. Auth: `401`; permission: `403`;
  plan limit exceeded: `402` with `code: "PLAN_LIMIT_REACHED"`.
- Idempotency keys on payment-creating endpoints.
- **Public API** (Phase 6): same API surface, authenticated by tenant-scoped API keys with
  scopes + per-plan rate limits; keys hashed, prefix-identifiable, revocable.
- **Webhooks** (Phase 6): tenant-configurable endpoints, event catalog
  (`student.created`, `payment.received`, `lesson.cancelled`, …), HMAC-SHA256 signatures,
  retries with backoff, delivery log UI.

## 5. DATABASE — CORE DOMAIN MODEL

Full ERD belongs in `docs/DATABASE.md` (mermaid). Minimum entity inventory (~70 tables):

**Platform:** tenants, plans, plan_features, subscriptions, subscription_invoices, usage_records,
platform_users, feature_flags, announcements, audit_platform, integration_catalog.

**Identity:** users, roles, permissions, role_permissions, user_roles, sessions/refresh_tokens,
invitations, api_keys.

**Org:** branches, rooms, room_reservations, assets, asset_service_logs, holidays,
working_hours, settings.

**Education:** courses, course_categories, course_modules_content (syllabus), groups,
group_students (enrollment w/ status & history), students, student_notes, teachers
(profile over users), teacher_subjects, lessons (scheduled instances), lesson_occurrences,
attendance, journal_entries, grades, exams, exam_results, homework, homework_submissions,
certificates, materials (files).

**Schedule:** schedule_rules (recurrence), schedule_exceptions, conflicts are computed not stored.

**CRM:** leads, lead_sources, lead_stages (pipeline, tenant-configurable), lead_activities,
communication_log (call/sms/email/whatsapp), tasks, task_comments.

**Finance:** invoices, invoice_items, payments, payment_methods, refunds, discounts,
student_balances (ledger), expenses, expense_categories, cash_accounts, transactions (double-entry
lite: every money movement is a transaction row), payroll_runs, payroll_items, teacher_rates.

**HR:** employees (profile over users), contracts, positions, leave_requests, salary_definitions.

**Marketing:** campaigns, campaign_channels, ad_spends, promo_codes, referral_records.

**Messaging:** notifications, notification_preferences, message_templates, sms_log, email_log.

**AI:** ai_conversations, ai_messages, ai_usage_log, ai_insights (generated reports/alerts).

**Integrations:** tenant_integrations (config + encrypted credentials), webhook_endpoints,
webhook_deliveries, calendar_sync_state.

**System:** audit_log (tenant-scoped: who, what, before/after JSON, IP), files, import_jobs,
export_jobs, saved_filters (collections).

Rules: FKs with `onDelete` chosen deliberately; money = integer minor units + currency;
enums as Prisma enums; JSONB for flexible payloads (settings, feature matrices, audit diffs).

## 6. SCHEDULE ENGINE (the hardest module — design carefully)

Requirements from PRD:
- Lesson creation: course, group, teacher, assistant teacher, room, start/end, recurrence
  (weekly pattern, until date / N occurrences), type (online/offline/hybrid), capacity, notes.
- **Validation on create/update/drag — reject with specific conflict list:**
  1. Teacher double-booking (any branch)
  2. Room double-booking
  3. Room capacity < group size
  4. Teacher working-hours window + max weekly hours
  5. Minimum break between lessons (tenant setting, e.g. 10 min) per teacher and per room
  6. Holidays / non-working days (tenant calendar) — recurrences skip or prompt
  7. Group double-booking
- Recurring model: `schedule_rules` (RRULE-like) generate `lessons` materialized 12 weeks ahead
  by a nightly job; editing offers "this lesson / this and following / entire series".
- Conflict check endpoint: `POST /schedule/validate` returns all violations — the UI calls it
  live during drag & drop before committing.
- Views API: day/week/month/timeline(rooms×hours), filterable by branch, teacher, room, group.

## 7. BACKGROUND JOBS (BullMQ queues)

`mail`, `sms`, `notifications`, `schedule-materialize` (nightly), `billing` (subscription renewals,
dunning), `usage-metering` (daily), `reports` (heavy exports), `ai` (insight generation),
`webhooks` (delivery + retry), `imports` (CSV/XLSX student import), `backups-verify`.
Every job: idempotent, logged, visible in super admin "Jobs" screen (Bull Board in dev).

## 8. AUDIT & OBSERVABILITY

- `audit_log`: every create/update/delete on business entities + auth events + exports +
  permission changes. Retention per plan.
- Request logging: pino, request-id, userId, tenantId, latency; slow query log > 200ms.
- Health endpoints: `/health` (liveness), `/health/ready` (DB+Redis). Metrics endpoint reserved.
