'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.status === 401
          ? t('invalidCredentials')
          : (err as Error).message,
      );
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">EduSphere</h1>
          <p className="mt-1 text-sm text-muted">{t('welcomeBack')}</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          {serverError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
          )}
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ad@merkez.az"
              error={errors.email?.message}
              {...register('email', { required: 'Email tələb olunur' })}
            />
          </div>
          <div>
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password', { required: 'Şifrə tələb olunur' })}
            />
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('login')}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">
              {t('forgotPassword')}
            </Link>
            <Link href="/register" className="text-primary hover:underline">
              {t('register')}
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
