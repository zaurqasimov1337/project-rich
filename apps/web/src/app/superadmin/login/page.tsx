'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { usePlatformAuth } from '@/lib/platform';
import { Button } from '@/components/ui/button';

export default function PlatformLoginPage() {
  const t = useTranslations('platform');
  const tc = useTranslations('common');
  const router = useRouter();
  const login = usePlatformAuth((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ email: string; password: string }>();

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await login(v.email, v.password);
      router.replace('/superadmin');
    } catch (err) {
      setError((err as Error).message);
    }
  });

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-[#243044] bg-[#0B1220] p-12 text-white lg:flex">
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-admin-primary text-white">
            <ShieldCheck className="h-6 w-6" />
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
            <span className="text-admin-primary">{t('heroLine2')}</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60">{t('heroSubtitle')}</p>
        </div>

        <div className="relative text-sm text-white/40">{t('copyright', { year: 2026 })}</div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-admin-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">EduSphere</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">{t('loginTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted">{t('loginSubtitle')}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-foreground">
                {tc('email')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus:border-admin-primary focus:outline-none focus:ring-2 focus:ring-admin-primary/20"
                  {...register('email', { required: true })}
                />
              </div>
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
                  className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-10 text-sm text-foreground placeholder:text-muted focus:border-admin-primary focus:outline-none focus:ring-2 focus:ring-admin-primary/20"
                  {...register('password', { required: true })}
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
            </div>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="w-full !bg-admin-primary hover:opacity-90"
            >
              {t('login')}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
