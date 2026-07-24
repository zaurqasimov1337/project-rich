'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { BrandLogo } from '@/components/brand';

interface FormValues {
  email: string;
  password: string;
  remember: boolean;
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { remember: true } });

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
    <main className="auth-backdrop flex min-h-screen">
      {/* Hero panel — brand + slogan (hidden on mobile) */}
      <div className="animate-fade-in relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-br from-muted/10 via-transparent to-muted/5 p-12 lg:flex">
        {/* light play: soft spotlight + floating glow orbs */}
        <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-foreground/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-96 w-96 rounded-full bg-foreground/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
        <div className="animate-fade-scale flex items-center gap-3">
          <BrandLogo className="h-10" />
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t('brandTagline')}</div>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground">
            {t('heroLine1')}
            <br />
            <span className="bg-gradient-to-r from-foreground to-muted bg-clip-text text-transparent">{t('heroLine2')}</span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-muted">CRM + LMS + Maliyyə + Satış — hamısı bir platformada.</p>
        </div>
        <div className="text-xs text-muted">© {new Date().getFullYear()} Mactab</div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center p-4">
        {/* halo glow behind the card */}
        <div className="pointer-events-none absolute h-[420px] w-[420px] rounded-full bg-foreground/[0.05] blur-3xl" />
      <div className="relative w-full max-w-[400px] animate-fade-up rounded-2xl border border-border bg-surface/80 p-8 shadow-[var(--shadow-lg)] ring-1 ring-foreground/[0.06] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-foreground/25 before:to-transparent">
        {/* Brand block (mobile only — hero carries it on desktop) */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="animate-fade-scale lg:hidden">
            <BrandLogo className="h-9" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground lg:mt-0">{t('loginTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
          )}

          <div className="animate-fade-up anim-delay-1">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              error={errors.email?.message}
              {...register('email', { required: t('email') + ' *' })}
            />
          </div>

          <div className="animate-fade-up anim-delay-2">
            <Label htmlFor="password">{t('password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-9"
                error={errors.password?.message}
                {...register('password', { required: t('password') + ' *' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                className="absolute right-2 top-2 text-muted transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="animate-fade-up anim-delay-3 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary accent-primary"
                {...register('remember')}
              />
              {t('rememberMe')}
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          <Button type="submit" loading={isSubmitting} className="animate-fade-up anim-delay-btn h-10 w-full">
            {t('login')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('register')}
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
