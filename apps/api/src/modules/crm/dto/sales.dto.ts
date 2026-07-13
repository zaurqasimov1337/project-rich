import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LEAD_GENDERS, LEAD_SOURCES, LEAD_STATUSES } from '../sales.constants';

const STR = LEAD_STATUSES as unknown as string[];
const SRC = LEAD_SOURCES as unknown as string[];
const GEN = LEAD_GENDERS as unknown as string[];

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

  // scoring flags
  @IsOptional() @IsBoolean() askedDemo?: boolean;
  @IsOptional() @IsBoolean() askedPrice?: boolean;
  @IsOptional() @IsBoolean() callAnswered?: boolean;
  @IsOptional() @IsBoolean() parentInvolved?: boolean;
  @IsOptional() @IsBoolean() budgetOk?: boolean;
  @IsOptional() @IsBoolean() notResponding?: boolean;
  @IsOptional() @IsBoolean() passive7d?: boolean;
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
