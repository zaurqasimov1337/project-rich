# PRD — EduSphere

Multi-tenant education SaaS. Two panels: **Tenant Panel** (training centers) and **Super Admin
Panel** (platform operator). Locales: az (default), en, ru, tr. Currency: AZN default,
multi-currency ready. Timezone: Asia/Baku default.

## 1. Tenant Panel modules

### T1. Dashboard
KPI cards (active students, MRR-equivalent monthly revenue, overdue payments, today's lessons,
new leads, attendance rate), revenue chart (12m), lead funnel, today's/tomorrow's schedule list,
recent activity, onboarding checklist for new tenants.

### T2. CRM / Leads
Configurable pipeline stages (Kanban + table), lead capture (manual, web form, import),
lead sources, assignment, activities & follow-up tasks, communication log (call/SMS/email/
WhatsApp note), conversion to student (wizard), loss reasons, funnel metrics (CPL, conversion %).

### T3. Students
Profile (personal, contacts, parent/guardian, documents, photo), enrollment in groups with
status history (active/frozen/finished/dropped), balance & payment history, attendance history,
grades, notes, bulk actions (SMS/email/export/edit), advanced filters + saved filters
(= Collections), CSV/XLSX import with mapping + validation report.

### T4. Teachers
Profile, subjects, qualification docs, assigned groups, weekly load & working hours,
rate definitions (per lesson / per student / fixed monthly / % of revenue), performance stats
(attendance of their groups, retention, revenue), payroll link.

### T5. Courses
Catalog with categories, pricing models (monthly / per course / per lesson), duration,
syllabus (modules/topics), level, capacity defaults, status; per-course economics
(active students, revenue, ad spend, ROI) on detail page.

### T6. Groups
Group = course instance: teacher, assistant, room default, schedule rule, capacity, price
override, start/end dates; roster management with enrollment statuses; fill-rate; archive.

### T7. Schedule (core engine)
Views: day / week / month / timeline (rooms × hours); filters: branch, teacher, room, group,
course. Lesson create/edit: course, group, teacher, assistant, room, start–end, recurrence
(weekly pattern, until/N), type (online/offline/hybrid), max participants, notes.
**Automatic validation** (hard blocks with named conflicts): teacher double-booking, room
double-booking, room capacity < group size, teacher working hours + max weekly hours,
minimum break between lessons (per teacher & room, tenant setting), holidays/non-working days,
group double-booking. Drag & drop reschedule (time/teacher/room) with live conflict check.
Series editing: this / this-and-following / all. Cancel with reason + notify students.

### T8. Attendance & Journal
Per-lesson roster: present/absent/late/excused, one-tap marking, topic covered, homework given,
lesson notes; per-student and per-group attendance analytics; low-attendance alerts.

### T9. Exams & Grades
Exam definitions (type, max score, weight), results entry grid, gradebook per group/student,
grade scale per tenant, certificates (template + issue log, PDF).

### T10. Rooms
Room list per branch: name, number, capacity, floor, equipment (tags), status, photos.
Occupancy view (who/when/free-busy), reservation outside lessons (events, meetings).

### T11. Branches
Multi-branch: each branch has staff assignments, rooms, courses offered, working hours,
holidays, finance scoping, dashboard filtered by branch. Branch switcher in top bar.

### T12. Finance
Invoices (auto-generated from enrollment billing cycle + manual), payments (cash/card/transfer,
partial, idempotent), student ledger & balances, debt list + dunning reminders (SMS/email),
discounts & promo codes, refunds, expenses with categories, cash accounts & transfers,
cash flow view, P&L summary, teacher payroll (rates → payroll run → payslips), export XLSX.

### T13. HR & Payroll
Employees (contract, position, salary def, documents), leave requests & approvals, payroll runs
(salary + teacher lesson-based pay merged), payslip PDF.

### T14. Marketing
Campaigns (budget, channel, dates, UTM), ad spend log per channel (Meta/Google/TikTok manual +
API later), lead-source attribution → CPL/CAC/ROAS/ROI per campaign & course, promo codes,
referral tracking.

### T15. Tasks
Personal + assigned tasks, due dates, priorities, linked entity (lead/student/group), board +
list views, reminders.

### T16. Reports & Collections
Report center: revenue, debts, attendance, group fill, teacher load & performance, course ROI,
lead funnel, by branch/date-range/teacher/course; export XLSX/PDF; **Collections** = saved
filter sets on any list with bulk ops (SMS/email/export/edit) and quick stats.

### T17. Notifications & Messaging
In-app notification center, email + SMS templates (variables), event triggers (payment due,
lesson cancelled, absence, birthday), per-user preferences, provider-agnostic SMS adapter.

### T18. Documents & Files
Per-entity attachments (student contracts, teacher certs), tenant file manager, storage quota
by plan.

### T19. Settings
Tenant profile & branding (logo, colors), branches, working hours, holidays, lesson defaults
(duration, break rules), grade scale, pipeline stages, lead sources, expense categories,
payment methods, roles & permissions (custom roles), users & invitations, templates, API keys,
webhooks, audit log viewer, subscription & plan usage (upgrade CTA).

### T20. AI Copilot
Chat panel over tenant data: natural-language Q&A ("Bu ay ən gəlirli kurs hansıdır?",
"Ödənişi gecikən tələbələri göstər"), powered by whitelisted analytical tools (SQL-safe,
tenant-scoped, read-only). Insights feed: risk alerts (churn-risk students by attendance drop,
overdue spike), weekly auto-report, forecasts (revenue, enrollment). Usage metered per plan.

### T21. Integrations (marketplace UI)
Categories: AI (OpenAI, Claude, Gemini, DeepSeek), Social (FB/IG/TikTok/LinkedIn/YouTube/X),
Ads (Meta/Google/TikTok/LinkedIn), Payment (Stripe/PayPal/local bank), Calendar (Google/
Outlook/Apple), Meeting (Zoom/Meet/Teams), Storage (Drive/Dropbox/OneDrive), Communication
(Gmail/Telegram/WhatsApp/Slack/Discord), SMS (Twilio/local), Automation (Zapier/Make/n8n/
Webhook). Each card: connect (OAuth/API key), status, config, disconnect, logs.
**v1 implemented connectors:** AI providers (OpenAI/Anthropic key), Google Calendar (one-way
push), generic Webhooks, SMTP. Others: catalog entries with "coming soon" flag off by default.

## 2. Super Admin Panel modules

### S1. Dashboard — MRR, ARR, tenant count by status, trial conversions, churn, usage totals, revenue chart.
### S2. Tenants — list/detail (status lifecycle: trial→active→past_due→suspended→cancelled), plan, usage vs limits, users, activity, impersonate (audited, 30-min token), suspend/restore, delete with retention window.
### S3. Plans & Features — Starter/Professional/Business/Enterprise/Custom; monthly+yearly price; limits (users, students, teachers, branches, AI requests, storage, API calls); feature matrix (CRM, Finance, Marketing, AI, WhatsApp, LMS, API, White-label, Multi-branch, HR, Payroll…); plan editor drives runtime feature gates.
### S4. Billing — subscriptions, invoices, manual payment record, dunning states, trial extension, coupon codes. (Card processing via Stripe adapter — stub-safe if no key.)
### S5. Platform users & roles — super_admin, support, finance, analyst.
### S6. Announcements — broadcast banners/messages to tenants (by plan/status).
### S7. Integration catalog management — enable/disable providers globally, per-plan availability.
### S8. Feature flags — global + per-tenant overrides.
### S9. Audit & Monitoring — platform audit log, background job dashboard, API usage, error log viewer, system health.

## 3. Phase-2 backlog (documented, not built)
Student/Parent/Teacher portals, mobile apps, online lesson (video) module, e-exam builder,
asset management & maintenance, knowledge base, visual workflow automation, API marketplace &
developer portal, white-label, full multi-currency accounting.

## 4. Non-functional requirements
Tenant isolation (row-level, centrally enforced), RBAC on every endpoint & UI element,
p95 API < 300ms on seeded data, all lists paginated, dark/light themes, WCAG AA, audit trail,
rate limiting, OWASP Top-10 hardening, automated tests (unit/integration/E2E), Docker deploy,
daily backups, structured logs.

## 5. Acceptance
A module is accepted only per the Definition of Done in `MASTER_PROMPT/00_MASTER_PROMPT.md §6`.
Progress tracked in `docs/ROADMAP.md`.
