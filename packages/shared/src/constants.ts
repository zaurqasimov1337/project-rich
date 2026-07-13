export const DEFAULT_CURRENCY = 'AZN';
export const DEFAULT_TIMEZONE = 'Asia/Baku';
export const DEFAULT_LOCALE = 'az';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;
export const IMPERSONATION_TTL_SEC = 30 * 60;

export const JWT_AUDIENCE_TENANT = 'tenant';
export const JWT_AUDIENCE_PLATFORM = 'platform';

/** Plan limit metric keys (plans.limits JSONB + usage_records.metric). */
export const PLAN_METRICS = {
  users: 'users',
  students: 'students',
  teachers: 'teachers',
  branches: 'branches',
  aiRequests: 'aiRequests',
  storageMb: 'storageMb',
  apiCalls: 'apiCalls',
} as const;
export type PlanMetric = keyof typeof PLAN_METRICS;

/** Plan feature flag keys (plans.features JSONB). */
export const PLAN_FEATURES = [
  'crm', 'finance', 'marketing', 'ai', 'lms', 'hr', 'payroll', 'api',
  'whiteLabel', 'multiBranch', 'whatsapp', 'webhooks',
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/** Stable API error codes. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PLAN_LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  RATE_LIMITED: 'RATE_LIMITED',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

/** Schedule conflict types returned by POST /schedule/validate. */
export const SCHEDULE_CONFLICTS = {
  TEACHER_BUSY: 'TEACHER_BUSY',
  ROOM_BUSY: 'ROOM_BUSY',
  GROUP_BUSY: 'GROUP_BUSY',
  ROOM_CAPACITY: 'ROOM_CAPACITY',
  OUTSIDE_WORKING_HOURS: 'OUTSIDE_WORKING_HOURS',
  MAX_WEEKLY_HOURS: 'MAX_WEEKLY_HOURS',
  MIN_BREAK: 'MIN_BREAK',
  HOLIDAY: 'HOLIDAY',
} as const;
export type ScheduleConflictType = keyof typeof SCHEDULE_CONFLICTS;
