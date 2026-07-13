# API

Base `/api/v1`. REST, kebab-case plural. Swagger at `/api/docs` (dev). Envelope:
`{success, data, meta}` | `{success:false, error:{code, message, details}}`.
Auth: `Authorization: Bearer <access>`; refresh via httpOnly cookie. Realms: tenant vs
platform (`/api/v1/platform/**` requires platform JWT). Lists: `?page&limit(≤100)&sort&search`
+ module filters. Errors: 401 auth, 403 permission, 402 PLAN_LIMIT_REACHED, 422 validation.

## Endpoint catalog (summary — Swagger is authoritative)

### Auth `/auth`
`POST /auth/register-tenant` (wizard: tenant+owner) · `POST /auth/login` · `POST /auth/refresh`
· `POST /auth/logout` · `POST /auth/forgot-password` · `POST /auth/reset-password` ·
`POST /auth/verify-email` · `GET /auth/me` (user+permissions+tenant+plan) ·
`GET/DELETE /auth/sessions` · `POST /auth/2fa/setup|verify|disable` ·
`POST /auth/invitations/accept`

### Core tenant resources (standard CRUD unless noted)
`/branches` · `/rooms` (+`GET /rooms/:id/occupancy?date`) · `/room-reservations` ·
`/holidays` · `/settings` (GET/PATCH) · `/users` (+invite, roles) · `/roles` (+permission
catalog `GET /roles/permissions`) · `/audit-log` (read) · `/files` (presigned upload/download)
· `/notifications` (+`POST /notifications/read-all`) · `/saved-filters`

### Education
`/course-categories` · `/courses` (+`GET /courses/:id/stats`) · `/groups`
(+`GET /groups/:id/students`, `POST /groups/:id/students`, `PATCH /groups/:id/students/:sid`
status changes) · `/students` (+`GET /students/:id/{balance|attendance|grades|timeline}`,
`POST /students/import`, `POST /students/bulk` actions) · `/teachers` (+`/teachers/:id/load`,
`/teachers/:id/rates`) · `/exams` + `/exams/:id/results` (bulk PUT) · `/certificates`

### Schedule
`GET /schedule?view=day|week|month|timeline&from&to&branchId&teacherId&roomId&groupId`
`POST /schedule/validate` → `{conflicts:[{type, message, entity}]}` ·
`POST /lessons` (single or from rule) · `PATCH /lessons/:id?scope=one|following|all` ·
`POST /lessons/:id/cancel` · `/schedule-rules` CRUD ·
`GET/PUT /lessons/:id/attendance` (bulk) · `PUT /lessons/:id/journal`

### CRM
`/lead-stages` · `/lead-sources` · `/leads` (+`PATCH /leads/:id/stage`,
`POST /leads/:id/convert` → student, `GET /leads/funnel` metrics) · `/leads/:id/activities` ·
`/tasks`

### Finance
`/invoices` (+`POST /invoices/generate` period run, `POST /invoices/:id/void`) ·
`/payments` (idempotency-key header) · `/refunds` · `/expenses` · `/expense-categories` ·
`/cash-accounts` (+`POST /cash-accounts/transfer`) · `/transactions` (read) ·
`/discounts` · `/promo-codes` · `/payroll` (`POST /payroll/runs`, `GET /payroll/runs/:id`,
`POST /payroll/runs/:id/approve|pay`) · `GET /finance/summary?from&to` (dashboard/cash flow)
· `GET /finance/debts`

### HR
`/employees` · `/leave-requests` (+approve/reject)

### Marketing
`/campaigns` · `/ad-spends` · `GET /marketing/metrics` (CPL/CAC/ROAS by campaign/source/course)

### Reports
`GET /reports/:key?filters` (keys: revenue, debts, attendance, group-fill, teacher-load,
teacher-performance, course-roi, lead-funnel) · `POST /exports` (async XLSX/PDF → job → file)

### Messaging
`/message-templates` · `POST /messages/send` (bulk SMS/email to filter/collection) ·
`/sms-log`, `/email-log` (read)

### AI
`POST /ai/chat` (SSE stream; conversationId) · `GET /ai/conversations/:id` ·
`GET /ai/insights` · `GET /ai/usage`

### Integrations & webhooks
`GET /integrations` (catalog+status) · `POST /integrations/:key/connect|disconnect|test` ·
`/webhook-endpoints` CRUD (+`GET /webhook-endpoints/:id/deliveries`, redeliver) ·
`/api-keys` CRUD (secret shown once)

### Dashboard
`GET /dashboard` (aggregated KPIs; cached 60s)

### Platform realm `/platform/**`
`/platform/auth/login` · `/platform/tenants` (+suspend/restore/extend-trial/impersonate) ·
`/platform/plans` · `/platform/subscriptions` (+invoices, record-payment) ·
`/platform/users` · `/platform/announcements` · `/platform/feature-flags` ·
`/platform/integration-catalog` · `/platform/analytics` (MRR/churn/usage) ·
`/platform/jobs` (queue stats) · `/platform/audit`

## Webhook events (v1)
`student.created`, `student.updated`, `lead.created`, `lead.stage_changed`, `payment.received`,
`invoice.overdue`, `lesson.created`, `lesson.cancelled`, `group.created`. HMAC-SHA256
`X-Signature`, retries ×5 exponential backoff.
