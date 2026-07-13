'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string }>();

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
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      {serverError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
      )}
      <div>
        <Label htmlFor="password">Yeni şifrə</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password', {
            required: 'Şifrə tələb olunur',
            pattern: {
              value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
              message: 'Ən azı 8 simvol: böyük, kiçik hərf və rəqəm',
            },
          })}
        />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Şifrəni yenilə
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-bold">Yeni şifrə təyin et</h1>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
