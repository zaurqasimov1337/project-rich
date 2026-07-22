import { passwordStrength, validatePassword } from '@edusphere/shared';

describe('password policy', () => {
  it('accepts a password that satisfies every rule', () => {
    expect(validatePassword('Kx7#mQvz2Ln')).toEqual([]);
  });

  it.each([
    ['Ab1!', 'minLength'],
    ['alllower1!', 'uppercase'],
    ['ALLUPPER1!', 'lowercase'],
    ['NoDigitsHere!', 'digit'],
    ['NoSpecial123', 'special'],
    ['With Space1!', 'noSpaces'],
    ['Aaaa1111!', 'noRepeats'],
    ['Abcd1234!', 'noSequence'],
  ])('rejects %s for %s', (password, rule) => {
    expect(validatePassword(password)).toContain(rule);
  });

  it('rejects common passwords through leet and punctuation decoration', () => {
    expect(validatePassword('P@ssw0rd')).toContain('notCommon');
    expect(validatePassword('Passw0rd!')).toContain('notCommon');
  });

  it('rejects passwords echoing the user identity', () => {
    const ctx = { email: 'nihad@demo.az', firstName: 'Nihad', lastName: 'Qasimov' };
    expect(validatePassword('Nihad#2026x', ctx)).toContain('notPersonal');
    expect(validatePassword('Kx7#mQvz2Ln', ctx)).toEqual([]);
  });

  it('caps overly long passwords', () => {
    expect(validatePassword(`Aa1!${'x'.repeat(100)}`)).toContain('maxLength');
  });

  it('scores strength between 0 and 4, penalising predictable inputs', () => {
    expect(passwordStrength('short')).toBe(0);
    expect(passwordStrength('Abcd1234!')).toBeLessThanOrEqual(1);
    expect(passwordStrength('Kx7#mQvz2Ln!pQ')).toBe(4);
  });
});
