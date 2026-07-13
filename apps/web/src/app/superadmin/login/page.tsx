'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { usePlatformAuth } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export default function PlatformLoginPage() {
  const router = useRouter();
  const login = usePlatformAuth((s) => s.login);
  const [error, setError] = useState<string | null>(null);
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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-admin-primary">EduSphere</h1>
          <p className="mt-1 text-sm text-muted">Platform İdarəetməsi</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
          )}
          <div>
            <Label htmlFor="email">E-poçt</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email', { required: true })} />
          </div>
          <div>
            <Label htmlFor="password">Şifrə</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password', { required: true })}
            />
          </div>
          <Button
            type="submit"
            loading={isSubmitting}
            className="w-full !bg-admin-primary hover:opacity-90"
          >
            Daxil ol
          </Button>
        </form>
      </div>
    </main>
  );
}
