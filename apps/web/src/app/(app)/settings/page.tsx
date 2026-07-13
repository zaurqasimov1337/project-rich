'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/data-table';

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
  { key: 'users', label: 'İstifadəçilər' },
  { key: 'roles', label: 'Rollar' },
  { key: 'holidays', label: 'Qeyri-iş günləri' },
  { key: 'billing', label: 'Abunəlik' },
] as const;

export default function SettingsPage() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Parametrlər</h1>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-3">
          {can('users.manage') && (
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="h-4 w-4" /> İstifadəçi dəvət et
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted-bg/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-semibold">İstifadəçi</th>
                  <th className="px-4 py-2.5 font-semibold">Rollar</th>
                  <th className="px-4 py-2.5 font-semibold">Son giriş</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
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
                  <span className="rounded bg-muted-bg px-1.5 py-0.5 text-xs text-muted">Sistem</span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted">
                {r.userCount} istifadəçi · {r.permissions.length} icazə
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
                <Label>Tarix</Label>
                <Input type="date" {...holidayForm.register('date', { required: true })} />
              </div>
              <div className="min-w-48 flex-1">
                <Label>Ad</Label>
                <Input placeholder="Məs: Novruz bayramı" {...holidayForm.register('name', { required: true })} />
              </div>
              <Button type="submit" loading={addHoliday.isPending}>
                Əlavə et
              </Button>
            </form>
          )}
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            {holidays?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">Bu il üçün qeyri-iş günü yoxdur</div>
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
              <div className="font-semibold">{user?.tenant.plan?.name ?? 'Plan yoxdur'}</div>
              <div className="mt-0.5 text-sm text-muted">
                Status: <StatusBadge status={user?.tenant.status ?? ''} />
                {user?.tenant.trialEndsAt && (
                  <span className="ml-2">
                    Sınaq bitir: {new Date(user.tenant.trialEndsAt).toLocaleDateString('az-Latn-AZ')}
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

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="İstifadəçi dəvət et"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Ləğv et
            </Button>
            <Button
              loading={inviteMutation.isPending}
              onClick={inviteForm.handleSubmit((v) => inviteMutation.mutate(v))}
            >
              Dəvət göndər
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
            <Label>E-poçt *</Label>
            <Input
              type="email"
              error={inviteForm.formState.errors.email?.message}
              {...inviteForm.register('email', { required: 'Tələb olunur' })}
            />
          </div>
          <div>
            <Label>Rol *</Label>
            <Select
              placeholder="Rol seçin"
              error={inviteForm.formState.errors.roleId?.message}
              options={(roles ?? [])
                .filter((r) => r.key !== 'owner')
                .map((r) => ({ value: r.id, label: r.name }))}
              {...inviteForm.register('roleId', { required: 'Tələb olunur' })}
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
