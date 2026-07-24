import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';
import {
  DEMO_STATUSES,
  LEAD_GENDERS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_PLANS,
  PAYMENT_STATUSES,
} from '../sales.constants';

const STR = LEAD_STATUSES as unknown as string[];
const SRC = LEAD_SOURCES as unknown as string[];
const GEN = LEAD_GENDERS as unknown as string[];
const DEMO = DEMO_STATUSES as unknown as string[];
const PAY_ST = PAYMENT_STATUSES as unknown as string[];
const PAY_M = PAYMENT_METHODS as unknown as string[];
const PAY_PLAN = PAYMENT_PLANS as unknown as string[];

export class CreateSalesLeadDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(120) instagram?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsIn(GEN) gender?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) educationStatus?: string;
  @IsOptional() @IsString() @MaxLength(120) currentField?: string;
  @IsOptional() @IsUUID() interestedTrainingId?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsIn(SRC) source?: string;
  @IsOptional() @IsIn(STR) status?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsDateString() firstContactAt?: string;
  @IsOptional() @IsDateString() nextFollowupAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  // scoring flags (optional at creation)
  @IsOptional() @IsBoolean() askedDemo?: boolean;
  @IsOptional() @IsBoolean() askedPrice?: boolean;
  @IsOptional() @IsBoolean() callAnswered?: boolean;
  @IsOptional() @IsBoolean() parentInvolved?: boolean;
  @IsOptional() @IsBoolean() budgetOk?: boolean;
  @IsOptional() @IsBoolean() notResponding?: boolean;
  @IsOptional() @IsBoolean() passive7d?: boolean;
}

export class UpdateSalesLeadDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(120) instagram?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsIn(GEN) gender?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) educationStatus?: string;
  @IsOptional() @IsString() @MaxLength(120) currentField?: string;
  @IsOptional() @IsUUID() interestedTrainingId?: string;
  @IsOptional() @IsIn(SRC) source?: string;
  @IsOptional() @IsIn(STR) status?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(200) lostReason?: string;
  @IsOptional() @IsString() @MaxLength(200) objectionReason?: string;

  // sales/payment state
  @IsOptional() @IsIn(DEMO) demoStatus?: string;
  @IsOptional() @IsString() @MaxLength(60) callStatus?: string;
  @IsOptional() @IsString() @MaxLength(60) registrationStatus?: string;
  @IsOptional() @IsString() @MaxLength(60) remarketingStatus?: string;
  @IsOptional() @IsIn(PAY_ST) paymentStatus?: string;
  @IsOptional() @IsIn(PAY_M) paymentMethod?: string;
  @IsOptional() @IsIn(PAY_PLAN) paymentPlan?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @IsString() @MaxLength(60) budgetMatch?: string;
  @IsOptional() @IsDateString() courseStartDate?: string;
  @IsOptional() @IsString() @MaxLength(60) firstContactChannel?: string;

  // scoring flags
  @IsOptional() @IsBoolean() askedDemo?: boolean;
  @IsOptional() @IsBoolean() askedPrice?: boolean;
  @IsOptional() @IsBoolean() callAnswered?: boolean;
  @IsOptional() @IsBoolean() parentInvolved?: boolean;
  @IsOptional() @IsBoolean() budgetOk?: boolean;
  @IsOptional() @IsBoolean() notResponding?: boolean;
  @IsOptional() @IsBoolean() passive7d?: boolean;
}

// ===== Lead payments =====
export class CreateLeadPaymentDto {
  @IsUUID() leadId!: string;
  @IsOptional() @IsUUID() trainingId?: string;
  @IsInt() @Min(0) amountDue!: number; // minor units (qəpik)
  @IsOptional() @IsInt() @Min(0) amountPaid?: number;
  @IsOptional() @IsInt() @Min(0) monthlyAmount?: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsDateString() nextDueAt?: string;
  @IsOptional() @IsIn(PAY_ST) status?: string;
  @IsOptional() @IsIn(PAY_M) method?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateLeadPaymentDto {
  @IsOptional() @IsUUID() trainingId?: string;
  @IsOptional() @IsInt() @Min(0) amountDue?: number;
  @IsOptional() @IsInt() @Min(0) amountPaid?: number;
  @IsOptional() @IsInt() @Min(0) monthlyAmount?: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsDateString() nextDueAt?: string;
  @IsOptional() @IsIn(PAY_ST) status?: string;
  @IsOptional() @IsIn(PAY_M) method?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// ===== Sales team =====
export class UpdateTeamMemberDto {
  @IsNumber() @Min(0) @Max(100) bonusRate!: number;
}

export class AddTeamMemberDto {
  @IsString() @MaxLength(80) firstName!: string;
  @IsString() @MaxLength(80) lastName!: string;
  @IsString() @MaxLength(160) email!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsStrongPassword() password!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bonusRate?: number;
}

export class MoveLeadColumnDto {
  @IsString() column!: string; // pipeline column key
}

export class BulkAssignDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsUUID() assignedTo!: string;
}

export class CreateFollowupDto {
  @IsUUID() leadId!: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateFollowupDto {
  @IsOptional() @IsBoolean() isDone?: boolean;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AddLeadActivityDto {
  @IsString() @MaxLength(40) type!: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) body?: string;
}
