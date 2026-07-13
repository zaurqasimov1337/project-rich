'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff, GraduationCap, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

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
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0a0f1e] p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 50% at 15% 0%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(50% 50% at 100% 100%, rgba(56,189,248,0.14), transparent 60%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">EduSphere</div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-white/50">
              {t('brandTagline')}
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            {t('heroLine1')}
            <br />
            <span className="text-primary">{t('heroLine2')}</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60">{t('heroSubtitle')}</p>
        </div>

        <div className="relative text-sm text-white/40">{t('copyright', { year: 2026 })}</div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">EduSphere</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">{t('loginTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted">{t('loginSubtitle')}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {serverError && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-foreground">
                {t('email')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  className={inputCls(!!errors.email)}
                  {...register('email', { required: t('email') + ' *' })}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-foreground">
                {t('password')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputCls(!!errors.password) + ' pr-10'}
                  {...register('password', { required: t('password') + ' *' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary accent-primary"
                {...register('remember')}
              />
              {t('rememberMe')}
            </label>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="w-full shadow-lg shadow-primary/30"
            >
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
      </section>
    </main>
  );
}

function inputCls(hasError: boolean) {
  return [
    'h-11 w-full rounded-lg border bg-surface pl-10 pr-3 text-sm text-foreground',
    'placeholder:text-muted focus:outline-none focus:ring-2',
    hasError
      ? 'border-danger focus:border-danger focus:ring-danger/20'
      : 'border-border focus:border-primary focus:ring-primary/20',
  ].join(' ');
}
