'use client';

import { BrandLogo } from '@/components/brand';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/password-field';

import { validatePassword } from '@edusphere/shared';

function ResetForm() {
  const t = useTranslations('auth');
  const tp = useTranslations('password');
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string; confirmPassword: string }>({ mode: 'onChange' });

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      router.replace('/login');
    } catch (err) {
      setServerError((err as Error).message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
      )}
      <PasswordField
        id="password"
        label={t('newPassword')}
        autoComplete="new-password"
        value={watch('password') ?? ''}
        error={errors.password?.message}
        {...register('password', {
          required: t('passwordRequired'),
          validate: (v) => {
            const failed = validatePassword(v);
            return failed.length === 0 || tp(`rules.${failed[0]}`);
          },
        })}
      />
      <PasswordField
        id="confirmPassword"
        label={t('confirmPassword')}
        autoComplete="new-password"
        showMeter={false}
        error={errors.confirmPassword?.message}
        {...register('confirmPassword', {
          required: t('passwordRequired'),
          validate: (v) => v === watch('password') || tp('mismatch'),
        })}
      />
      <Button type="submit" className="h-10 w-full" loading={isSubmitting}>
        {t('updatePassword')}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[400px] animate-scale-in rounded-2xl border border-border bg-surface/80 p-8 shadow-[var(--shadow-lg)] backdrop-blur-xl">
        {/* Brand block */}
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="h-9" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {t('setNewPassword')}
          </h1>
        </div>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
