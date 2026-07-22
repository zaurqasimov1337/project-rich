export const TENANT_STATUSES = ['trial', 'active', 'past_due', 'suspended', 'cancelled'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const USER_STATUSES = ['active', 'invited', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LESSON_TYPES = ['offline', 'online', 'hybrid'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const LESSON_STATUSES = ['scheduled', 'done', 'cancelled'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['active', 'frozen', 'finished', 'dropped'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const GROUP_STATUSES = ['planned', 'active', 'finished', 'archived'] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'archived'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'open', 'partial', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TRANSACTION_TYPES = [
  'income', 'expense', 'transfer_in', 'transfer_out', 'payroll', 'refund',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PRICING_MODELS = ['monthly', 'course', 'lesson'] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const TEACHER_RATE_TYPES = [
  'per_lesson', 'per_student', 'fixed_monthly', 'revenue_pct',
] as const;
export type TeacherRateType = (typeof TEACHER_RATE_TYPES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;

export const LEAD_ACTIVITY_TYPES = [
  'call', 'meeting', 'note', 'sms', 'email', 'whatsapp', 'stage_change',
] as const;

export const DATE_RANGE_PRESETS = [
  'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month',
  'this_quarter', 'last_quarter', 'this_year', 'last_year',
  // Rolling look-back windows, counted backwards from now rather than snapped
  // to a calendar boundary — "the last 90 days", not "this quarter".
  'last_7_days', 'last_30_days', 'last_90_days', 'last_6_months',
  'last_12_months', 'last_2_years', 'all_time',
] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const EXPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export const EXPORT_SCOPES = ['page', 'selected', 'all'] as const;

export const LOCALES = ['az', 'en', 'ru', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

export const PLAN_CODES = ['starter', 'professional', 'business', 'enterprise', 'custom'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const SUBSCRIPTION_PERIODS = ['monthly', 'yearly'] as const;

export const WEBHOOK_EVENTS = [
  'student.created', 'student.updated', 'lead.created', 'lead.stage_changed',
  'payment.received', 'invoice.overdue', 'lesson.created', 'lesson.cancelled', 'group.created',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const INTEGRATION_CATEGORIES = [
  'ai', 'social', 'ads', 'payment', 'calendar', 'meeting', 'storage', 'communication',
  'sms', 'automation',
] as const;
