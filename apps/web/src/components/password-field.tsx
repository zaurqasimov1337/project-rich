'use client';

import { Check, Eye, EyeOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useState } from 'react';
import {
  PASSWORD_CHECKLIST_RULES,
  passwordStrength,
  validatePassword,
  type PasswordContext,
} from '@edusphere/shared';
import { cn } from '@/lib/utils';
import { Input, Label, type InputProps } from '@/components/ui/input';

export interface PasswordFieldProps extends Omit<InputProps, 'type'> {
  label?: string;
  /** Current value, needed for the meter — pass react-hook-form's watch(). */
  value?: string;
  /** Identifiers the password must not echo (email, name). */
  context?: PasswordContext;
  /** Hide the strength meter and rule checklist (e.g. on the login form). */
  showMeter?: boolean;
}

const BAR_COLORS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-success'];

/**
 * Password input with a show/hide toggle and, for new passwords, a live
 * strength meter plus a checklist driven by the shared password policy — the
 * same rules the API enforces, so the user never guesses what will be rejected.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, value = '', context, showMeter = true, className, id, ...props }, ref) => {
    const t = useTranslations('password');
    const ta = useTranslations('auth');
    const [visible, setVisible] = useState(false);

    const failed = validatePassword(value, context);
    const score = passwordStrength(value);

    return (
      <div>
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            className={cn('pr-9', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? ta('hidePassword') : ta('showPassword')}
            className="absolute right-2 top-2 text-muted hover:text-foreground"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {showMeter && value.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-full flex-1 rounded-full transition-colors',
                      i < score ? BAR_COLORS[score] : 'bg-muted-bg',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted">{t(`strength.${score}`)}</span>
            </div>

            <ul className="grid gap-0.5 sm:grid-cols-2">
              {PASSWORD_CHECKLIST_RULES.map((rule) => {
                const ok = !failed.includes(rule);
                return (
                  <li
                    key={rule}
                    className={cn('flex items-center gap-1 text-xs', ok ? 'text-success' : 'text-muted')}
                  >
                    {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {t(`rules.${rule}`)}
                  </li>
                );
              })}
            </ul>

            {/* Rules that only matter once broken stay out of the checklist. */}
            {failed
              .filter((r) => !PASSWORD_CHECKLIST_RULES.includes(r))
              .map((rule) => (
                <p key={rule} className="text-xs text-danger">
                  {t(`rules.${rule}`)}
                </p>
              ))}
          </div>
        )}
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';
