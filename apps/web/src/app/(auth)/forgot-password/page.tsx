'use client';

import { BrandLogo } from '@/components/brand';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>();

  const onSubmit = handleSubmit(async ({ email }) => {
    await api.post('/auth/forgot-password', { email }).catch(() => undefined);
    setSent(true);
  });

  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[400px] animate-scale-in rounded-2xl border border-border bg-surface/80 p-8 shadow-[var(--shadow-lg)] backdrop-blur-xl">
        {/* Brand block */}
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="h-9" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {t('resetPassword')}
          </h1>
          {!sent && <p className="mt-1.5 text-sm text-muted">{t('sendResetLink')}</p>}
        </div>

        {sent ? (
          <p className="rounded-lg bg-muted-bg px-3 py-2 text-center text-sm text-muted">
            {t('resetLinkSentInfo')}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                error={errors.email?.message}
                {...register('email', { required: t('emailRequired') })}
              />
            </div>
            <Button type="submit" className="h-10 w-full" loading={isSubmitting}>
              {t('sendResetLink')}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center">
          <Link href="/login" className="text-sm text-muted transition-colors hover:text-foreground">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </main>
  );
}
