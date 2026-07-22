'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { validatePassword } from '@edusphere/shared';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/data-table';
import { PasswordField } from '@/components/password-field';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt: string | null;
  roles: { key: string; name: string }[];
}

interface RoleRow {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

const TABS = [
  { key: 'users', tkey: 'tabUsers' },
  { key: 'roles', tkey: 'tabRoles' },
  { key: 'holidays', tkey: 'tabHolidays' },
  { key: 'billing', tkey: 'tabBilling' },
  { key: 'security', tkey: 'tabSecurity' },
] as const;

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tp = useTranslations('password');
  const qc = useQueryClient();
  const { user, can } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('users');
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.list<UserRow>('/users?limit=100'),
    enabled: tab === 'users',
  });
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<RoleRow[]>('/roles'),
    enabled: tab === 'users' || tab === 'roles',
  });
  const { data: holidays } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.get<Holiday[]>('/settings/holidays'),
    enabled: tab === 'holidays',
  });

  const inviteForm = useForm<{ email: string; roleId: string }>();
  const holidayForm = useForm<{ date: string; name: string }>();

  const inviteMutation = useMutation({
    mutationFn: (v: { email: string; roleId: string }) => api.post('/users/invite', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      setInviteOpen(false);
      inviteForm.reset();
    },
  });

  const addHoliday = useMutation({
    mutationFn: (v: { date: string; name: string }) => api.post('/settings/holidays', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['holidays'] });
      holidayForm.reset();
    },
  });
  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/holidays/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const passwordForm = useForm<ChangePasswordForm>({ mode: 'onChange' });
  const changePassword = useMutation({
    mutationFn: (v: ChangePasswordForm) =>
      api.post<{ accessToken: string }>('/auth/change-password', {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    onSuccess: (res) => {
      // The server revoked every session; adopt the fresh token so this tab
      // isn't logged out by its own password change.
      setAccessToken(res.accessToken);
      passwordForm.reset();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        {(can('apikeys.manage') || can('webhooks.manage')) && (
          <a
            href="/settings/developer"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-muted-bg"
          >
            {t('developerLink')}
          </a>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === tabItem.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {t(tabItem.tkey)}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-3">
          {can('users.manage') && (
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="h-4 w-4" /> {t('inviteUser')}
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted-bg/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-semibold">{t('colUser')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('tabRoles')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('colLastLogin')}</th>
                  <th className="px-4 py-2.5 font-semibold">{tc('status')}</th>
                </tr>
              </thead>
              <tbody>
                {users?.data.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r.key} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted tabular-nums">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('az-Latn-AZ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.name}</span>
                {r.isSystem && (
                  <span className="rounded bg-muted-bg px-1.5 py-0.5 text-xs text-muted">{t('system')}</span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted">
                {t('roleStats', { users: r.userCount, permissions: r.permissions.length })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'holidays' && (
        <div className="space-y-3">
          {can('settings.manage') && (
            <form
              onSubmit={holidayForm.handleSubmit((v) => addHoliday.mutate(v))}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div>
                <Label>{tc('date')}</Label>
                <Input type="date" {...holidayForm.register('date', { required: true })} />
              </div>
              <div className="min-w-48 flex-1">
                <Label>{tc('name')}</Label>
                <Input placeholder={t('holidayPlaceholder')} {...holidayForm.register('name', { required: true })} />
              </div>
              <Button type="submit" loading={addHoliday.isPending}>
                {tc('add')}
              </Button>
            </form>
          )}
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            {holidays?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">{t('noHolidays')}</div>
            ) : (
              <div className="divide-y divide-border">
                {holidays?.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="font-medium tabular-nums">
                        {new Date(h.date).toLocaleDateString('az-Latn-AZ')}
                      </span>{' '}
                      <span className="text-muted">— {h.name}</span>
                    </div>
                    {can('settings.manage') && (
                      <Button variant="ghost" size="icon" onClick={() => deleteHoliday.mutate(h.id)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{user?.tenant.plan?.name ?? t('noPlan')}</div>
              <div className="mt-0.5 text-sm text-muted">
                {tc('status')}: <StatusBadge status={user?.tenant.status ?? ''} />
                {user?.tenant.trialEndsAt && (
                  <span className="ml-2">
                    {t('trialEnds')}: {new Date(user.tenant.trialEndsAt).toLocaleDateString('az-Latn-AZ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {user?.tenant.plan && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(user.tenant.plan.limits).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted-bg p-3">
                  <div className="text-xs text-muted">{key}</div>
                  <div className="font-semibold tabular-nums">{value === -1 ? '∞' : value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="max-w-md rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">{t('changePassword')}</h2>
          <p className="mt-0.5 text-sm text-muted">{t('changePasswordHint')}</p>

          <form
            onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))}
            className="mt-4 space-y-4"
          >
            {changePassword.isError && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {(changePassword.error as Error).message}
              </div>
            )}
            {changePassword.isSuccess && (
              <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                {t('passwordChanged')}
              </div>
            )}

            <PasswordField
              label={t('currentPassword')}
              autoComplete="current-password"
              showMeter={false}
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register('currentPassword', { required: t('fieldRequired') })}
            />
            <PasswordField
              label={t('newPasswordLabel')}
              autoComplete="new-password"
              value={passwordForm.watch('newPassword') ?? ''}
              context={{ email: user?.email, firstName: user?.firstName, lastName: user?.lastName }}
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register('newPassword', {
                required: t('fieldRequired'),
                validate: (v) => {
                  const failed = validatePassword(v, {
                    email: user?.email,
                    firstName: user?.firstName,
                    lastName: user?.lastName,
                  });
                  return failed.length === 0 || tp(`rules.${failed[0]}`);
                },
              })}
            />
            <PasswordField
              label={t('confirmNewPassword')}
              autoComplete="new-password"
              showMeter={false}
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register('confirmPassword', {
                required: t('fieldRequired'),
                validate: (v) => v === passwordForm.watch('newPassword') || tp('mismatch'),
              })}
            />

            <Button type="submit" loading={changePassword.isPending}>
              {t('changePassword')}
            </Button>
          </form>
        </div>
      )}

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t('inviteUser')}
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={inviteMutation.isPending}
              onClick={inviteForm.handleSubmit((v) => inviteMutation.mutate(v))}
            >
              {t('sendInvite')}
            </Button>
          </>
        }
      >
        {inviteMutation.isError && (
          <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {(inviteMutation.error as Error).message}
          </div>
        )}
        <form className="space-y-4">
          <div>
            <Label>{tc('email')} *</Label>
            <Input
              type="email"
              error={inviteForm.formState.errors.email?.message}
              {...inviteForm.register('email', { required: t('fieldRequired') })}
            />
          </div>
          <div>
            <Label>{t('role')} *</Label>
            <Select
              placeholder={t('selectRole')}
              error={inviteForm.formState.errors.roleId?.message}
              options={(roles ?? [])
                .filter((r) => r.key !== 'owner')
                .map((r) => ({ value: r.id, label: r.name }))}
              {...inviteForm.register('roleId', { required: t('fieldRequired') })}
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
