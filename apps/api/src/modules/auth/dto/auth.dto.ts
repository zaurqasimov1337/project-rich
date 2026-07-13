import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_MSG =
  'Password must be at least 8 characters with upper, lower case letters and a digit';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  centerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName!: string;

  @IsEmail()
  email!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  @MinLength(8)
  newPassword!: string;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;
}
