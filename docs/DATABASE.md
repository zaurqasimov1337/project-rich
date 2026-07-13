# DATABASE

PostgreSQL 16 via Prisma. `prisma/schema.prisma` is the source of truth; this file is the map.
Conventions: UUID PKs, `tenant_id` on all tenant-scoped tables (composite indexes lead with it),
money = integer minor units + `currency` (default AZN), UTC timestamps, soft delete
(`deleted_at`) on business entities, `created_at/updated_at` everywhere.

## Platform (no tenant_id)
- **tenants** — name, slug, status(trial|active|past_due|suspended|cancelled), planId, trialEndsAt, settings JSONB, branding JSONB
- **plans** — code, name, priceMonthly, priceYearly, limits JSONB {users, students, teachers, branches, aiRequests, storageMb, apiCalls}, features JSONB {crm, finance, marketing, ai, lms, hr, payroll, api, whiteLabel, multiBranch, whatsapp}, isCustom
- **subscriptions** — tenantId, planId, period(monthly|yearly), status, currentPeriodEnd, cancelAt
- **subscription_invoices** — subscriptionId, amount, status(draft|open|paid|void|uncollectible), dueAt, paidAt
- **usage_records** — tenantId, metric, value, date
- **platform_users** — email, passwordHash, role(super_admin|support|finance|analyst), totp
- **feature_flags** — key, enabled, perTenant JSONB
- **announcements** — title, body, audience JSONB, activeFrom/To
- **integration_catalog** — key, category, name, enabled, minPlan
- **audit_platform** — actorId, action, targetType/Id, diff JSONB, ip

## Identity (tenant)
- **users** — email (unique per tenant), passwordHash, firstName, lastName, phone, avatar, status, locale, totpSecret?, lastLoginAt
- **roles** / **role_permissions** (permission string) / **user_roles** (+branchId? scope)
- **refresh_tokens** — userId, familyId, tokenHash, expiresAt, revokedAt, ip, userAgent
- **invitations** — email, roleId, token, expiresAt, acceptedAt
- **api_keys** — name, prefix, keyHash, scopes[], lastUsedAt, revokedAt

## Org
- **branches** — name, address, phone, workingHours JSONB, isMain
- **rooms** — branchId, name, number, capacity, floor, equipment[], status, photos[]
- **room_reservations** — roomId, title, start, end, createdById (non-lesson bookings)
- **holidays** — date, name, branchId?
- **settings** — key, value JSONB (lesson defaults, minBreakMin, gradeScale, …)

## Education
- **courses** — categoryId, name, level, description, pricingModel(monthly|course|lesson), price, durationWeeks, defaultCapacity, syllabus JSONB, status
- **course_categories** — name, parentId?
- **students** — code, firstName, lastName, phone, email?, birthDate?, gender?, address?, parentName/Phone?, source(leadId?), status, photo, docs→files
- **student_notes** — studentId, authorId, body, pinned
- **teachers** — userId (1:1), subjects[], bio, hiredAt, workingHours JSONB, maxWeeklyHours, docs
- **teacher_rates** — teacherId, type(per_lesson|per_student|fixed_monthly|revenue_pct), amount, courseId?
- **groups** — courseId, branchId, teacherId, assistantId?, roomId?, name, capacity, priceOverride?, startDate, endDate?, status(planned|active|finished|archived)
- **group_students** — groupId, studentId, status(active|frozen|finished|dropped), joinedAt, leftAt?, priceOverride?, history via status rows
- **schedule_rules** — groupId, weekday[], startTime, endTime, roomId?, teacherId?, validFrom, validUntil?, type(online|offline|hybrid)
- **lessons** — groupId, ruleId?, teacherId, assistantId?, roomId?, date, startAt, endAt, type, status(scheduled|done|cancelled), cancelReason?, topic?, maxParticipants?
- **attendance** — lessonId, studentId, status(present|absent|late|excused), note?
- **journal_entries** — lessonId, topic, homework, notes
- **exams** — groupId, name, type, date, maxScore, weight
- **exam_results** — examId, studentId, score, comment
- **certificates** — studentId, courseId, number, issuedAt, pdfFileId

## CRM
- **lead_stages** — name, order, color, isWon, isLost
- **lead_sources** — name
- **leads** — name, phone, email?, sourceId, stageId, ownerId, courseInterestId?, value?, branchId, lostReason?, convertedStudentId?, utm JSONB
- **lead_activities** — leadId, type(call|meeting|note|sms|email|whatsapp|stage_change), body, dueAt?, doneAt?, userId
- **tasks** — title, body?, assigneeId, dueAt, priority, status, entityType?/entityId?
- **communication_log** — entityType/Id, channel, direction, body, meta JSONB

## Finance
- **invoices** — studentId, groupId?, number, amount, discount, tax, total, status(draft|open|paid|partial|overdue|void), dueAt, periodFrom/To?
- **invoice_items** — invoiceId, description, qty, unitPrice, total
- **payments** — invoiceId?, studentId, cashAccountId, method(cash|card|transfer|online), amount, paidAt, reference?, idempotencyKey
- **refunds** — paymentId, amount, reason
- **discounts** — name, type(pct|fixed), value, appliesTo JSONB
- **promo_codes** — code, discountId, maxUses, usedCount, validUntil
- **cash_accounts** — name, type(cash|bank|online), balance (derived), branchId?
- **transactions** — cashAccountId, type(income|expense|transfer_in|transfer_out|payroll|refund), amount, category?, entityType/Id?, date, note (every money movement)
- **expenses** — categoryId, cashAccountId, amount, date, vendor?, note, branchId?, fileId?
- **expense_categories** — name
- **payroll_runs** — period, status(draft|approved|paid), totals
- **payroll_items** — runId, employeeId|teacherId, base, lessonPay, bonus, deduction, total, detail JSONB

## HR
- **employees** — userId (1:1), position, contractType, salaryDef JSONB, hiredAt, firedAt?
- **leave_requests** — employeeId, from, to, type, status, approverId?

## Marketing
- **campaigns** — name, channel, budget, spent, startAt, endAt?, utmCampaign, status
- **ad_spends** — campaignId?, channel, amount, date, note
- **referrals** — studentId (referrer), leadId, rewardAmount?, status

## Messaging & system
- **notifications** — userId, type, title, body, entityType/Id?, readAt?
- **message_templates** — key, channel(email|sms), subject?, body (variables)
- **sms_log / email_log** — to, templateKey?, body, status, providerId?, error?
- **files** — key, name, mime, size, entityType/Id?, uploadedById
- **audit_log** — userId, action, entityType/Id, before/after JSONB, ip
- **import_jobs / export_jobs** — type, status, fileId, report JSONB
- **saved_filters** — userId, entity, name, filters JSONB, isShared
- **webhook_endpoints** — url, secret, events[], active
- **webhook_deliveries** — endpointId, event, payload JSONB, status, attempts, lastError?
- **tenant_integrations** — catalogKey, status, config JSONB, credentialsEnc (AES-256-GCM)
- **ai_conversations / ai_messages** — chat history; **ai_insights** — type, payload, period;
  **ai_usage_log** — tokens, tool, cost

## Key indexes
`(tenant_id, <fk>)` on every scoped table; lessons `(tenant_id, date)`, `(teacher_id, start_at)`,
`(room_id, start_at)`; invoices `(tenant_id, status, due_at)`; leads `(tenant_id, stage_id)`;
attendance unique `(lesson_id, student_id)`; payments unique `(tenant_id, idempotency_key)`.
