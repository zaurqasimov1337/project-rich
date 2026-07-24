'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trophy, Users, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

interface MemberForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  bonusRate: string;
}

const EMPTY_MEMBER: MemberForm = { firstName: '', lastName: '', email: '', phone: '', password: '', bonusRate: '5' };

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<MemberForm>(EMPTY_MEMBER);
  const [error, setError] = useState('');
  const set = (k: keyof MemberForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: () =>
      api.post('/sales/team', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        bonusRate: form.bonusRate === '' ? undefined : Number(form.bonusRate),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-team'] });
      void qc.invalidateQueries({ queryKey: ['sales-meta'] });
      onClose();
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Xəta baş verdi');
    },
  });

  const valid =
    form.firstName.trim() && form.lastName.trim() && form.email.trim().includes('@') && form.password.length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yeni satış üzvü</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-muted-bg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ad</Label>
              <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div>
              <Label>Soyad</Label>
              <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <Label>Telefon (opsional)</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parol</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Min. 8 simvol"
              />
            </div>
            <div>
              <Label>Bonus dərəcəsi (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.bonusRate}
                onChange={(e) => set('bonusRate', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Üzv <b>sales_manager</b> rolu ilə aktiv istifadəçi kimi yaradılır və dərhal daxil ola bilər.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Ləğv et</Button>
          <Button disabled={!valid || createMut.isPending} onClick={() => createMut.mutate()}>
            {createMut.isPending ? 'Yaradılır…' : 'Əlavə et'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TeamRow {
  userId: string;
  name: string;
  email: string;
  totalLeads: number;
  closedCount: number;
  conversionRate: number;
  revenue: number;
  bonusRate: number;
  bonus: number;
}

interface TeamResp {
  seeAll: boolean;
  data: TeamRow[];
}

export default function SalesTeamPage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canManage = can('leads.settings');
  const [editing, setEditing] = useState<{ userId: string; rate: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-team'],
    queryFn: () => api.get<TeamResp>('/sales/team'),
  });

  const rateMut = useMutation({
    mutationFn: ({ userId, bonusRate }: { userId: string; bonusRate: number }) =>
      api.patch(`/sales/team/${userId}`, { bonusRate }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-team'] });
      setEditing(null);
    },
  });

  const rows = data?.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.totalLeads,
      closed: acc.closed + r.closedCount,
      revenue: acc.revenue + r.revenue,
      bonus: acc.bonus + r.bonus,
    }),
    { leads: 0, closed: 0, revenue: 0, bonus: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Satış komandası</h1>
          <p className="mt-1 text-sm text-muted">
            Menecer üzrə nəticələr: lead, bağlanan satış, konversiya, gəlir və bonus.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni üzv
          </Button>
        )}
      </div>

      {/* totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Ümumi lead', value: String(totals.leads), icon: Users, tone: 'text-info' },
          { label: 'Bağlanan satış', value: String(totals.closed), icon: Trophy, tone: 'text-success' },
          { label: 'Yığılmış gəlir', value: formatMoney(totals.revenue), icon: Wallet, tone: 'text-primary' },
          { label: 'Hesablanmış bonus', value: formatMoney(totals.bonus), icon: Wallet, tone: 'text-warning' },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{k.label}</span>
                <Icon className={`h-4 w-4 ${k.tone}`} />
              </div>
              <div className="mt-2 text-2xl font-bold">{k.value}</div>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted-bg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-bg text-muted">
              <Users className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold">Hələ nəticə yoxdur</div>
            <div className="mt-1 text-sm text-muted">Lead-lər menecerlərə təyin edildikdə nəticələr burada görünəcək.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Menecer</th>
                <th className="px-3 py-2.5 text-right">Lead</th>
                <th className="px-3 py-2.5 text-right">Satış</th>
                <th className="px-3 py-2.5 text-right">Konversiya</th>
                <th className="px-3 py-2.5 text-right">Gəlir</th>
                <th className="px-3 py-2.5 text-right">Bonus dərəcəsi</th>
                <th className="px-3 py-2.5 text-right">Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.userId} className="hover:bg-muted-bg/50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted">{r.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">{r.totalLeads}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-success">{r.closedCount}</td>
                  <td className="px-3 py-2.5 text-right">{r.conversionRate}%</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatMoney(r.revenue)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {editing?.userId === r.userId ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          className="h-8 w-20 text-right"
                          value={editing.rate}
                          onChange={(e) => setEditing({ userId: r.userId, rate: e.target.value })}
                        />
                        <button
                          className="rounded-lg p-1.5 text-success hover:bg-success/10"
                          onClick={() => {
                            const n = Number(editing.rate);
                            if (Number.isFinite(n) && n >= 0 && n <= 100) {
                              rateMut.mutate({ userId: r.userId, bonusRate: n });
                            }
                          }}
                          disabled={rateMut.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-lg p-1.5 text-muted hover:bg-muted-bg"
                          onClick={() => setEditing(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{r.bonusRate}%</span>
                        {canManage && (
                          <button
                            className="rounded-lg p-1 text-muted hover:bg-muted-bg hover:text-foreground"
                            onClick={() => setEditing({ userId: r.userId, rate: String(r.bonusRate) })}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-warning">{formatMoney(r.bonus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!data?.seeAll && !isLoading && (
        <p className="text-xs text-muted">Yalnız öz nəticələrinizi görürsünüz.</p>
      )}

      {addOpen && <AddMemberModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}
