import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LOCALES, USER_STATUSES } from '@edusphere/shared';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn(USER_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsIn(LOCALES as unknown as string[])
  locale?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
