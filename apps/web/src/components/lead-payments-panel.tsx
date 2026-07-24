'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import {
  fmtDate,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentStatusBadgeStyle,
} from '@/lib/sales';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaymentRow {
  id: string;
  leadId: string;
  leadNo: number | null;
  leadName: string;
  leadPhone: string | null;
  trainingId: string | null;
  trainingName: string | null;
  amountDue: number;
  amountPaid: number;
  monthlyAmount: number | null;
  remaining: number;
  paidAt: string | null;
  nextDueAt: string | null;
  status: string;
  method: string | null;
  note: string | null;
  createdAt: string;
}

interface PaymentsResp {
  data: PaymentRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  totals: { due: number; paid: number; remaining: number };
}

interface LeadOption {
  id: string;
  leadNo: number | null;
  fullName: string;
  phone: string | null;
}

interface PaymentForm {
  leadId: string;
  amountDueAzn: string;
  amountPaidAzn: string;
  monthlyAzn: string;
  nextDueAt: string;
  status: string;
  method: string;
  note: string;
}

const EMPTY_FORM: PaymentForm = {
  leadId: '',
  amountDueAzn: '',
  amountPaidAzn: '',
  monthlyAzn: '',
  nextDueAt: '',
  status: 'gozleyir',
  method: '',
  note: '',
};

const toMinor = (s: string): number | undefined => {
  if (s.trim() === '') return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
};
const toAzn = (minor: number | null | undefined): string =>
  minor == null ? '' : String(Math.round(minor) / 100);

const STATUS_TABS = [{ key: '', label: 'Hamısı' }, ...Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => ({ key, label }))];

function PaymentModal({
  initial,
  paymentId,
  onClose,
}: {
  initial: PaymentForm;
  paymentId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PaymentForm>(initial);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadPicked, setLeadPicked] = useState<LeadOption | null>(null);
  const isEdit = paymentId != null;

  const { data: leadResults } = useQuery({
    queryKey: ['payment-lead-search', leadQuery],
    queryFn: () => api.get<{ data: LeadOption[] }>(`/leads?q=${encodeURIComponent(leadQuery)}&limit=8`),
    enabled: !isEdit && leadQuery.trim().length >= 2,
  });

  const set = (k: keyof PaymentForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        amountDue: toMinor(form.amountDueAzn) ?? 0,
        amountPaid: toMinor(form.amountPaidAzn),
        monthlyAmount: toMinor(form.monthlyAzn),
        nextDueAt: form.nextDueAt ? new Date(form.nextDueAt).toISOString() : undefined,
        status: form.status || undefined,
        method: form.method || undefined,
        note: form.note || undefined,
      };
      return isEdit
        ? api.patch(`/lead-payments/${paymentId}`, payload)
        : api.post('/lead-payments', { ...payload, leadId: form.leadId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lead-payments'] });
      onClose();
    },
  });

  const canSave = isEdit || form.leadId !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'Ödənişi redaktə et' : 'Yeni ödəniş'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-muted-bg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {!isEdit && (
            <div>
              <Label>Müraciət (lead)</Label>
              {leadPicked ? (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>
                    #{leadPicked.leadNo} {leadPicked.fullName} {leadPicked.phone ? `· ${leadPicked.phone}` : ''}
                  </span>
                  <button
                    className="text-muted hover:text-foreground"
                    onClick={() => {
                      setLeadPicked(null);
                      set('leadId', '');
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Ad və ya telefonla axtar…"
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                  />
                  {(leadResults?.data ?? []).length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                      {(leadResults?.data ?? []).map((l) => (
                        <button
                          key={l.id}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted-bg"
                          onClick={() => {
                            setLeadPicked(l);
                            set('leadId', l.id);
                            setLeadQuery('');
                          }}
                        >
                          #{l.leadNo} {l.fullName} {l.phone ? `· ${l.phone}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ümumi məbləğ (₼)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amountDueAzn}
                onChange={(e) => set('amountDueAzn', e.target.value)}
              />
            </div>
            <div>
              <Label>Ödənilib (₼)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amountPaidAzn}
                onChange={(e) => set('amountPaidAzn', e.target.value)}
              />
            </div>
            <div>
              <Label>Aylıq məbləğ (₼)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyAzn}
                onChange={(e) => set('monthlyAzn', e.target.value)}
              />
            </div>
            <div>
              <Label>Növbəti ödəniş tarixi</Label>
              <Input type="date" lang="az" value={form.nextDueAt} onChange={(e) => set('nextDueAt', e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                options={Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div>
              <Label>Ödəniş üsulu</Label>
              <Select
                value={form.method}
                onChange={(e) => set('method', e.target.value)}
                options={[
                  { value: '', label: '—' },
                  ...Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
            </div>
          </div>

          <div>
            <Label>Qeyd</Label>
            <Input value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Ləğv et
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
            {saveMut.isPending ? 'Yadda saxlanılır…' : 'Yadda saxla'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LeadPaymentsPanel() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canManage = can('leads.settings');

  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; paymentId: string | null; form: PaymentForm }>({
    open: false,
    paymentId: null,
    form: EMPTY_FORM,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (debouncedQ) p.set('q', debouncedQ);
    p.set('page', String(page));
    p.set('limit', '25');
    return p.toString();
  }, [status, debouncedQ, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['lead-payments', qs],
    queryFn: () => api.get<PaymentsResp>(`/lead-payments?${qs}`),
    placeholderData: keepPreviousData,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/lead-payments/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lead-payments'] }),
  });

  const openEdit = (r: PaymentRow) =>
    setModal({
      open: true,
      paymentId: r.id,
      form: {
        leadId: r.leadId,
        amountDueAzn: toAzn(r.amountDue),
        amountPaidAzn: toAzn(r.amountPaid),
        monthlyAzn: toAzn(r.monthlyAmount),
        nextDueAt: r.nextDueAt ? r.nextDueAt.slice(0, 10) : '',
        status: r.status,
        method: r.method ?? '',
        note: r.note ?? '',
      },
    });

  const totals = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Lead-lərin ödəniş izləməsi (borc, ödənilən, qalıq).</p>
        {canManage && (
          <Button onClick={() => setModal({ open: true, paymentId: null, form: EMPTY_FORM })}>
            <Plus className="h-4 w-4" /> Yeni ödəniş
          </Button>
        )}
      </div>

      {/* totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Ümumi məbləğ', value: totals?.due },
          { label: 'Ödənilib', value: totals?.paid },
          { label: 'Qalıq borc', value: totals?.remaining },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t.label}</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold">{t.value != null ? formatMoney(t.value) : '—'}</div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === tab.key ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-muted-bg hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Ad və ya telefonla axtar…"
          className="max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-shimmer rounded-lg bg-muted-bg" />
            ))}
          </div>
        ) : (data?.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-bg text-muted">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold">Ödəniş tapılmadı</div>
            <div className="mt-1 text-sm text-muted">Yeni ödəniş əlavə edin.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Lead</th>
                <th className="px-3 py-2.5">Təlim</th>
                <th className="px-3 py-2.5 text-right">Məbləğ</th>
                <th className="px-3 py-2.5 text-right">Ödənilib</th>
                <th className="px-3 py-2.5 text-right">Qalıq</th>
                <th className="px-3 py-2.5 text-right">Aylıq</th>
                <th className="px-3 py-2.5">Növbəti ödəniş</th>
                <th className="px-3 py-2.5">Üsul</th>
                <th className="px-3 py-2.5">Status</th>
                {canManage && <th className="px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.data ?? []).map((r) => {
                const overdue =
                  r.nextDueAt &&
                  !['odenib', 'legv_edilib'].includes(r.status) &&
                  new Date(r.nextDueAt) < new Date();
                return (
                  <tr key={r.id} className="hover:bg-muted-bg/50">
                    <td className="px-3 py-2.5">
                      <Link href={`/crm/leads/${r.leadId}`} className="font-medium text-primary hover:underline">
                        #{r.leadNo} {r.leadName}
                      </Link>
                      {r.leadPhone && <div className="text-xs text-muted">{r.leadPhone}</div>}
                    </td>
                    <td className="px-3 py-2.5">{r.trainingName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMoney(r.amountDue)}</td>
                    <td className="px-3 py-2.5 text-right text-success">{formatMoney(r.amountPaid)}</td>
                    <td className={cn('px-3 py-2.5 text-right font-medium', r.remaining > 0 && 'text-danger')}>
                      {formatMoney(r.remaining)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {r.monthlyAmount != null ? formatMoney(r.monthlyAmount) : '—'}
                    </td>
                    <td className={cn('px-3 py-2.5', overdue && 'font-medium text-danger')}>{fmtDate(r.nextDueAt)}</td>
                    <td className="px-3 py-2.5">{r.method ? (PAYMENT_METHOD_LABELS[r.method] ?? r.method) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={paymentStatusBadgeStyle(r.status)}
                      >
                        {PAYMENT_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="rounded-lg border border-border bg-muted-bg/50 p-1.5 text-muted transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                            onClick={() => openEdit(r)}
                            aria-label="Redaktə et"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="rounded-lg border border-danger/25 bg-danger/10 p-1.5 text-danger transition-colors duration-150 hover:bg-danger/20"
                            onClick={() => {
                              if (window.confirm('Ödəniş silinsin?')) deleteMut.mutate(r.id);
                            }}
                            aria-label="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {data.total} nəticə · səhifə {data.page}/{data.pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Əvvəlki
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Növbəti
            </Button>
          </div>
        </div>
      )}

      {modal.open && (
        <PaymentModal
          initial={modal.form}
          paymentId={modal.paymentId}
          onClose={() => setModal({ open: false, paymentId: null, form: EMPTY_FORM })}
        />
      )}
    </div>
  );
}
