import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PAYMENT_METHODS } from '@edusphere/shared';

export class CreateInvoiceDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class GenerateInvoicesDto {
  @Matches(/^\d{4}-\d{2}$/)
  period!: string; // YYYY-MM
}

export class CreatePaymentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @IsIn(PAYMENT_METHODS as unknown as string[])
  method!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class CreateExpenseDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CashAccountDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(['cash', 'bank', 'online'])
  type?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CategoryNameDto {
  @IsString()
  @MaxLength(80)
  name!: string;
}
