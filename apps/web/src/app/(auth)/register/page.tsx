'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { api, setAccessToken } from '@/lib/api';
import { useAuth, type Me } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { PasswordField } from '@/components/password-field';
import { validatePassword } from '@edusphere/shared';

interface FormValues {
  centerName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onChange' });

  const tp = useTranslations('password');
  const pwContext = {
    email: watch('email'),
    firstName: watch('firstName'),
    lastName: watch('lastName'),
    centerName: watch('centerName'),
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api.post<{ accessToken: string; user: Me }>(
        '/auth/register-tenant',
        values,
      );
      setAccessToken(res.accessToken);
      useAuth.setState({ user: res.user, status: 'authenticated' });
      router.replace('/dashboard');
    } catch (err) {
      setServerError((err as Error).message);
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">EduSphere</h1>
          <p className="mt-1 text-sm text-muted">{t('registerSubtitle')}</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          {serverError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
          )}
          <div>
            <Label htmlFor="centerName">{t('centerName')}</Label>
            <Input
              id="centerName"
              placeholder={t('centerNamePlaceholder')}
              error={errors.centerName?.message}
              {...register('centerName', { required: t('centerNameRequired') })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">{tc('firstName')}</Label>
              <Input
                id="firstName"
                error={errors.firstName?.message}
                {...register('firstName', { required: t('firstNameRequired') })}
              />
            </div>
            <div>
              <Label htmlFor="lastName">{tc('lastName')}</Label>
              <Input
                id="lastName"
                error={errors.lastName?.message}
                {...register('lastName', { required: t('lastNameRequired') })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email', { required: t('emailRequired') })}
            />
          </div>
          <div>
            <Label htmlFor="phone">{t('phoneOptional')}</Label>
            <Input id="phone" placeholder="+994 50 123 45 67" {...register('phone')} />
          </div>
          <PasswordField
            id="password"
            label={t('password')}
            autoComplete="new-password"
            value={watch('password') ?? ''}
            context={pwContext}
            error={errors.password?.message}
            {...register('password', {
              required: t('passwordRequired'),
              validate: (v) => {
                const failed = validatePassword(v, pwContext);
                return failed.length === 0 || tp(`rules.${failed[0]}`);
              },
            })}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('register')}
          </Button>
          <p className="text-center text-sm text-muted">
            {t('haveAccount')}{' '}
            <Link href="/login" className="text-primary hover:underline">
              {t('login')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
