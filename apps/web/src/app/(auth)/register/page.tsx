'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useState } from 'react';
import { api, setAccessToken } from '@/lib/api';
import { useAuth, type Me } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

interface FormValues {
  centerName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

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
          <p className="mt-1 text-sm text-muted">Tədris mərkəzinizi qeydiyyatdan keçirin — 14 gün pulsuz</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          {serverError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
          )}
          <div>
            <Label htmlFor="centerName">Mərkəzin adı</Label>
            <Input
              id="centerName"
              placeholder="Məs: Zirvə Tədris Mərkəzi"
              error={errors.centerName?.message}
              {...register('centerName', { required: 'Mərkəz adı tələb olunur' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">Ad</Label>
              <Input
                id="firstName"
                error={errors.firstName?.message}
                {...register('firstName', { required: 'Ad tələb olunur' })}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Soyad</Label>
              <Input
                id="lastName"
                error={errors.lastName?.message}
                {...register('lastName', { required: 'Soyad tələb olunur' })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">E-poçt</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email', { required: 'E-poçt tələb olunur' })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefon (opsional)</Label>
            <Input id="phone" placeholder="+994 50 123 45 67" {...register('phone')} />
          </div>
          <div>
            <Label htmlFor="password">Şifrə</Label>
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
            Qeydiyyat
          </Button>
          <p className="text-center text-sm text-muted">
            Hesabınız var?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Daxil ol
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
