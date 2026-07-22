/**
 * Password policy — the single source of truth shared by the API (server-side
 * enforcement) and the web app (live feedback while typing). Keep the two in
 * sync by importing from here rather than re-implementing the rules.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** argon2 hashes anything, but an unbounded body is a cheap DoS vector. */
export const PASSWORD_MAX_LENGTH = 72;

/** Machine-readable rule identifiers, used as i18n keys on the web side. */
export type PasswordRule =
  | 'minLength'
  | 'maxLength'
  | 'lowercase'
  | 'uppercase'
  | 'digit'
  | 'special'
  | 'noSpaces'
  | 'notCommon'
  | 'noRepeats'
  | 'noSequence'
  | 'notPersonal';

/** Rules shown as a live checklist while the user types. */
export const PASSWORD_CHECKLIST_RULES: PasswordRule[] = [
  'minLength',
  'lowercase',
  'uppercase',
  'digit',
  'special',
];

/**
 * Lowercased passwords rejected outright. Short list on purpose: it covers the
 * guesses a credential-stuffing script tries first without shipping a dictionary.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssword',
  'p@ssw0rd', 'qwerty', 'qwerty123', 'qwertyui', 'asdfghjk', 'zxcvbnm',
  '12345678', '123456789', '1234567890', '11111111', '00000000', 'abcd1234',
  'abc12345', '1q2w3e4r', 'q1w2e3r4', 'iloveyou', 'admin123', 'administrator',
  'welcome1', 'welcome123', 'letmein1', 'letmein123', 'monkey123', 'dragon123',
  'football', 'baseball', 'sunshine', 'princess', 'trustno1', 'superman',
  'starwars', 'whatever', 'computer', 'internet', 'samsung1', 'google123',
  'azerbaijan', 'azerbaycan', 'baku2024', 'baki2024', 'salam123', 'sifre123',
  'parol123', 'test1234', 'demo1234', 'user1234', 'edusphere', 'edusphere1',
]);

const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

/** Leet substitutions people reach for when a policy demands "complexity". */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

/**
 * True when the password is a known-common one, ignoring the decorations that
 * do not slow an attacker down: leet substitutions and trailing punctuation
 * ("P@ssw0rd!" is the same guess as "password").
 */
function isCommon(value: string): boolean {
  const lower = value.toLowerCase();
  const deleet = (s: string) => [...s].map((c) => LEET[c] ?? c).join('');
  const trimEnd = (s: string) => s.replace(/[^a-z0-9]+$/g, '');
  const candidates = [lower, trimEnd(lower), deleet(lower), deleet(trimEnd(lower))];
  return candidates.some((c) => COMMON_PASSWORDS.has(c));
}

function hasRun(value: string, length: number): boolean {
  let run = 1;
  for (let i = 1; i < value.length; i += 1) {
    run = value[i] === value[i - 1] ? run + 1 : 1;
    if (run >= length) return true;
  }
  return false;
}

function hasSequence(value: string, length: number): boolean {
  const lower = value.toLowerCase();
  for (const seq of SEQUENCES) {
    const reversed = [...seq].reverse().join('');
    for (const source of [seq, reversed]) {
      for (let i = 0; i + length <= source.length; i += 1) {
        if (lower.includes(source.slice(i, i + length))) return true;
      }
    }
  }
  return false;
}

/** Identifiers a password must not simply echo back (email, name, center name). */
export interface PasswordContext {
  email?: string;
  firstName?: string;
  lastName?: string;
  centerName?: string;
}

function personalTokens(ctx: PasswordContext): string[] {
  const raw = [ctx.email?.split('@')[0], ctx.firstName, ctx.lastName, ctx.centerName];
  return raw
    .flatMap((v) => (v ?? '').toLowerCase().split(/[^a-z0-9]+/i))
    .filter((v) => v.length >= 4);
}

/**
 * Returns the rules the password fails. Empty array means it is acceptable.
 * Order matters: the first entry is what we surface as the error message.
 */
export function validatePassword(password: string, ctx: PasswordContext = {}): PasswordRule[] {
  const failed: PasswordRule[] = [];
  const value = password ?? '';

  if (value.length < PASSWORD_MIN_LENGTH) failed.push('minLength');
  if (value.length > PASSWORD_MAX_LENGTH) failed.push('maxLength');
  if (!/[a-z]/.test(value)) failed.push('lowercase');
  if (!/[A-Z]/.test(value)) failed.push('uppercase');
  if (!/\d/.test(value)) failed.push('digit');
  if (!/[^A-Za-z0-9]/.test(value)) failed.push('special');
  if (/\s/.test(value)) failed.push('noSpaces');

  const lower = value.toLowerCase();
  if (isCommon(value)) failed.push('notCommon');
  // Same character four times in a row ("aaaa") adds no entropy.
  if (hasRun(value, 4)) failed.push('noRepeats');
  // Four-character keyboard or alphabet runs ("1234", "qwer") are trivially guessed.
  if (hasSequence(value, 4)) failed.push('noSequence');

  const tokens = personalTokens(ctx);
  if (tokens.some((token) => lower.includes(token))) failed.push('notPersonal');

  return failed;
}

/** Convenience wrapper for call sites that only need a yes/no answer. */
export function isPasswordValid(password: string, ctx: PasswordContext = {}): boolean {
  return validatePassword(password, ctx).length === 0;
}

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/**
 * Coarse 0–4 score for the strength meter. Independent of {@link validatePassword}:
 * a password can be valid yet still score low, which nudges users toward longer ones.
 */
export function passwordStrength(password: string): PasswordStrength {
  const value = password ?? '';
  if (value.length < PASSWORD_MIN_LENGTH) return 0;

  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  if (classes >= 3) score += 1;
  if (classes === 4) score += 1;
  if (new Set(value).size >= 8) score += 1;

  if (isCommon(value) || hasRun(value, 4) || hasSequence(value, 4)) {
    score = Math.min(score, 1);
  }
  return Math.min(score, 4) as PasswordStrength;
}
