'use client';

import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export default function ForgotPasswordPage() {
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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-bold">Şifrəni yenilə</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted">
            Əgər bu e-poçt qeydiyyatdadırsa, yeniləmə keçidi göndərildi. Poçt qutunuzu yoxlayın.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="email">E-poçt</Label>
              <Input
                id="email"
                type="email"
                error={errors.email?.message}
                {...register('email', { required: 'E-poçt tələb olunur' })}
              />
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Keçid göndər
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Girişə qayıt
          </Link>
        </p>
      </div>
    </main>
  );
}
