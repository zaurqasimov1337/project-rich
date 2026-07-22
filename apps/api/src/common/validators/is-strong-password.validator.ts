import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordRule,
  validatePassword,
} from '@edusphere/shared';

/** Azerbaijani messages, one per rule — surfaced straight to the client. */
const MESSAGES: Record<PasswordRule, string> = {
  minLength: `Şifrə ən azı ${PASSWORD_MIN_LENGTH} simvol olmalıdır`,
  maxLength: `Şifrə ${PASSWORD_MAX_LENGTH} simvoldan uzun ola bilməz`,
  lowercase: 'Şifrədə ən azı bir kiçik hərf olmalıdır',
  uppercase: 'Şifrədə ən azı bir böyük hərf olmalıdır',
  digit: 'Şifrədə ən azı bir rəqəm olmalıdır',
  special: 'Şifrədə ən azı bir xüsusi simvol olmalıdır (!@#$% və s.)',
  noSpaces: 'Şifrədə boşluq ola bilməz',
  notCommon: 'Bu şifrə çox geniş yayılıb, başqa şifrə seçin',
  noRepeats: 'Şifrədə eyni simvol ardıcıl 4 dəfə təkrarlana bilməz',
  noSequence: 'Şifrədə "1234" və ya "abcd" kimi ardıcıllıq ola bilməz',
  notPersonal: 'Şifrə ad, soyad və ya e-poçt ünvanınızı təkrarlaya bilməz',
};

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    return validatePassword(value, this.context(args)).length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    if (typeof args.value !== 'string') return 'Şifrə mətn olmalıdır';
    const failed = validatePassword(args.value, this.context(args));
    return failed.map((rule) => MESSAGES[rule]).join('. ') || 'Şifrə tələblərə uyğun deyil';
  }

  /**
   * Personal-data rules need the sibling fields of the same DTO — the payload
   * carries email/name on register and invitation-accept.
   */
  private context(args: ValidationArguments) {
    const obj = (args.object ?? {}) as Record<string, unknown>;
    const str = (key: string) => (typeof obj[key] === 'string' ? (obj[key] as string) : undefined);
    return {
      email: str('email'),
      firstName: str('firstName'),
      lastName: str('lastName'),
      centerName: str('centerName'),
    };
  }
}

/** Enforces the shared password policy (see packages/shared/src/password.ts). */
export function IsStrongPassword(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options,
      validator: IsStrongPasswordConstraint,
    });
}
