'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDebounced } from '@/lib/hooks';
import { initials, formatMoney } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';

interface TeacherRate {
  id: string;
  type: string;
  amount: number; // qəpik (minor units), or percent*100 for revenue_pct
  courseId?: string | null;
}

interface TeacherRow {
  id: string;
  user: { firstName: string; lastName: string; email: string; phone: string | null } | null;
  subjects: string[];
  maxWeeklyHours: number;
  activeGroups: { id: string; name: string }[];
  rates: TeacherRate[];
  revenuePct: number;
  monthlyEarnings: number;
}

const RATE_TYPE_LABELS: Record<string, string> = {
  per_lesson: 'Dərs başı',
  per_hour: 'Saat başı',
  per_student: 'Hər tələbədən',
  per_group: 'Hər qrupdan',
  fixed_monthly: 'Fix aylıq maaş',
  revenue_pct: 'Gəlirdən faiz (%)',
};

const RATE_TYPE_SHORT: Record<string, string> = {
  per_lesson: 'Dərs',
  per_hour: 'Saat',
  per_student: 'Tələbə',
  per_group: 'Qrup',
  fixed_monthly: 'Fix',
  revenue_pct: '',
};

const RATE_TYPE_OPTIONS = Object.entries(RATE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** amount is stored ×100: qəpik for money types, percent*100 for revenue_pct. */
function formatRateAmount(rate: TeacherRate): string {
  return rate.type === 'revenue_pct' ? `${rate.amount / 100}%` : formatMoney(rate.amount);
}

function rateSummary(rates: TeacherRate[] | undefined): string {
  if (!rates?.length) return '—';
  return rates
    .map((r) => {
      const short = RATE_TYPE_SHORT[r.type] ?? r.type;
      const amount = formatRateAmount(r);
      return short ? `${short} ${amount}` : amount;
    })
    .join(' · ');
}

interface TeacherForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subjects?: string;
  maxWeeklyHours?: number;
  revenuePct?: number;
}

export default function TeachersPage() {
  const t = useTranslations('teachers');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [rateType, setRateType] = useState<string>('per_lesson');
  const [rateAmount, setRateAmount] = useState('');
  const debouncedSearch = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['teachers', page, debouncedSearch],
    queryFn: () =>
      api.list<TeacherRow>(
        `/teachers?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const form = useForm<TeacherForm>();

  const openAdd = () => {
    setEditing(null);
    form.reset({ firstName: '', lastName: '', email: '', phone: '', subjects: '' });
    setDrawer(true);
  };
  const openEdit = (r: TeacherRow) => {
    setEditing(r);
    setRateType('per_lesson');
    setRateAmount('');
    form.reset({
      firstName: r.user?.firstName ?? '',
      lastName: r.user?.lastName ?? '',
      email: r.user?.email ?? '',
      phone: r.user?.phone ?? '',
      subjects: r.subjects.join(', '),
      maxWeeklyHours: r.maxWeeklyHours,
      revenuePct: r.revenuePct,
    });
    setDrawer(true);
  };

  const buildPayload = (v: TeacherForm, isEdit: boolean) => {
    const subjects = v.subjects
      ? v.subjects.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const base: Record<string, unknown> = {
      subjects,
      ...(v.maxWeeklyHours ? { maxWeeklyHours: Number(v.maxWeeklyHours) } : {}),
      ...(v.revenuePct != null && `${v.revenuePct}` !== '' ? { revenuePct: Number(v.revenuePct) } : {}),
    };
    if (isEdit) {
      return {
        ...base,
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone ?? '',
      };
    }
    return {
      ...base,
      newUser: {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        ...(v.phone ? { phone: v.phone } : {}),
      },
    };
  };

  const saveMutation = useMutation({
    mutationFn: (v: TeacherForm) =>
      editing
        ? api.patch(`/teachers/${editing.id}`, buildPayload(v, true))
        : api.post('/teachers', buildPayload(v, false)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] });
      setDrawer(false);
      setEditing(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teachers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teachers'] }),
  });

  // Keep the drawer's rate list in sync after add/delete refetches.
  const editingRow = editing ? (data?.data.find((r) => r.id === editing.id) ?? editing) : null;

  const addRateMutation = useMutation({
    mutationFn: () =>
      api.post(`/teachers/${editing!.id}/rates`, {
        type: rateType,
        // Stored ×100: AZN → qəpik for money types, percent → percent*100 for revenue_pct.
        amount: Math.round(Number(rateAmount) * 100),
      }),
    onSuccess: () => {
      setRateAmount('');
      void qc.invalidateQueries({ queryKey: ['teachers'] });
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: (rateId: string) => api.delete(`/teachers/${editing!.id}/rates/${rateId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const columns: Column<TeacherRow>[] = [
    {
      key: 'name',
      header: t('teacher'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials(r.user?.firstName, r.user?.lastName)}
          </span>
          <div>
            <div className="font-medium">
              {r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}
            </div>
            <div className="text-xs text-muted">{r.user?.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('phone'),
      render: (r) => <span className="text-sm text-muted">{r.user?.phone ?? '—'}</span>,
    },
    {
      key: 'subjects',
      header: t('specialty'),
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.subjects.length ? (
            r.subjects.map((s) => (
              <span key={s} className="rounded bg-muted-bg px-1.5 py-0.5 text-xs">
                {s}
              </span>
            ))
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'salaryModel',
      header: 'Ödəniş modeli',
      render: (r) => (
        <span className="text-sm tabular-nums" title={rateSummary(r.rates)}>
          {rateSummary(r.rates)}
        </span>
      ),
    },
    {
      key: 'groups',
      header: t('activeGroups'),
      render: (r) => <span className="tabular-nums">{r.activeGroups.length}</span>,
    },
    {
      key: 'earnings',
      header: t('monthlyEarnings'),
      render: (r) => (
        <span className="font-semibold tabular-nums text-success">{formatMoney(r.monthlyEarnings)}</span>
      ),
      className: 'text-right',
    },
    {
      key: 'actions',
      header: tc('actions'),
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {can('teachers.update') && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title={tc('edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {can('teachers.delete') && (
            <Button
              variant="ghost"
              size="icon"
              title={tc('delete')}
              loading={deleteMutation.isPending && deleteMutation.variables === r.id}
              onClick={() => {
                if (window.confirm(tc('confirmDelete'))) deleteMutation.mutate(r.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        description={t('inviteHint')}
        actions={
          can('teachers.create') && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> {t('addTeacher')}
            </Button>
          )
        }
      />
      {deleteMutation.isError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {(deleteMutation.error as Error).message}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        total={data?.meta.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        emptyTitle={t('emptyTitle')}
      />

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={editing ? t('editTeacher') : t('addTeacher')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={saveMutation.isPending}
              onClick={form.handleSubmit((v) => saveMutation.mutate(v))}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          {saveMutation.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(saveMutation.error as Error).message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('firstName')} *</Label>
              <Input {...form.register('firstName', { required: true })} />
            </div>
            <div>
              <Label>{t('lastName')} *</Label>
              <Input {...form.register('lastName', { required: true })} />
            </div>
          </div>
          <div>
            <Label>{t('email')} *</Label>
            <Input type="email" {...form.register('email', { required: true })} />
          </div>
          <div>
            <Label>{t('phone')}</Label>
            <Input {...form.register('phone')} />
          </div>
          <div>
            <Label>{t('subjectsLabel')}</Label>
            <Input placeholder="Riyaziyyat, Fizika" {...form.register('subjects')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('weeklyLimit')}</Label>
              <Input type="number" min={1} max={80} {...form.register('maxWeeklyHours')} />
            </div>
            <div>
              <Label>{t('revenuePct')}</Label>
              <Input type="number" min={0} max={100} {...form.register('revenuePct')} />
            </div>
          </div>

          {editingRow && can('teachers.rates') && (
            <div className="space-y-3 border-t border-border pt-4">
              <Label>Ödəniş modeli</Label>
              {(addRateMutation.isError || deleteRateMutation.isError) && (
                <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {((addRateMutation.error ?? deleteRateMutation.error) as Error).message}
                </div>
              )}
              {editingRow.rates.length ? (
                <ul className="space-y-2">
                  {editingRow.rates.map((rate) => (
                    <li
                      key={rate.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>{RATE_TYPE_LABELS[rate.type] ?? rate.type}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">{formatRateAmount(rate)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={tc('delete')}
                          loading={
                            deleteRateMutation.isPending && deleteRateMutation.variables === rate.id
                          }
                          onClick={() => deleteRateMutation.mutate(rate.id)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value)}
                    options={RATE_TYPE_OPTIONS}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={rateType === 'revenue_pct' ? '%' : 'AZN'}
                    value={rateAmount}
                    onChange={(e) => setRateAmount(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  loading={addRateMutation.isPending}
                  disabled={!rateAmount || Number.isNaN(Number(rateAmount))}
                  onClick={() => addRateMutation.mutate()}
                >
                  Əlavə et
                </Button>
              </div>
            </div>
          )}
        </form>
      </Drawer>
    </div>
  );
}
