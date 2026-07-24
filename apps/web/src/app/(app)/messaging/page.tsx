'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/data-table';

interface Template {
  id: string;
  key: string;
  channel: string;
  subject: string | null;
  body: string;
}
interface LogRow {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function MessagingPage() {
  const t = useTranslations('messaging');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [tab, setTab] = useState<'send' | 'templates' | 'logs'>('send');
  const [tplDrawer, setTplDrawer] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => api.get<Template[]>('/message-templates'),
    enabled: can('messages.templates'),
  });
  const { data: logs } = useQuery({
    queryKey: ['message-logs'],
    queryFn: () => api.list<LogRow>('/messages/logs?limit=50'),
    enabled: tab === 'logs',
    placeholderData: keepPreviousData,
  });
  const { data: students } = useQuery({
    queryKey: ['students-for-msg'],
    queryFn: () => api.list<{ id: string; firstName: string; lastName: string }>('/students?limit=500&status=active'),
    enabled: tab === 'send',
  });

  const sendForm = useForm<{ channel: string; subject?: string; body: string }>({
    defaultValues: { channel: 'email' },
  });
  const channel = sendForm.watch('channel');
  const [selected, setSelected] = useState<string[]>([]);

  const sendMutation = useMutation({
    mutationFn: (v: { channel: string; subject?: string; body: string }) =>
      api.post<{ sent: number; failed: number; skipped: number }>('/messages/send', {
        ...v,
        studentIds: selected,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['message-logs'] });
      setSelected([]);
      sendForm.reset({ channel: 'email' });
    },
  });

  const tplForm = useForm<{ key: string; channel: string; subject?: string; body: string }>({
    defaultValues: { channel: 'email' },
  });
  const saveTpl = useMutation({
    mutationFn: (v: { key: string; channel: string; subject?: string; body: string }) =>
      api.post('/message-templates', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['message-templates'] });
      setTplDrawer(false);
      tplForm.reset({ channel: 'email' });
    },
  });
  const deleteTpl = useMutation({
    mutationFn: (id: string) => api.delete(`/message-templates/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['message-templates'] }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} />

      <div className="flex gap-1 border-b border-border">
        {[
          ['send', t('tabSend')],
          ['templates', t('tabTemplates')],
          ['logs', t('tabLogs')],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as typeof tab)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium',
              tab === k ? 'border-primary text-primary' : 'border-transparent text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <form
            onSubmit={sendForm.handleSubmit((v) => sendMutation.mutate(v))}
            className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
          >
            {sendMutation.isSuccess && (
              <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                {t('sendResult', {
                  sent: sendMutation.data.sent,
                  failed: sendMutation.data.failed,
                  skipped: sendMutation.data.skipped,
                })}
              </div>
            )}
            <div>
              <Label>{t('channel')}</Label>
              <Select
                options={[
                  { value: 'email', label: t('email') },
                  { value: 'sms', label: 'SMS' },
                ]}
                {...sendForm.register('channel')}
              />
            </div>
            {channel === 'email' && (
              <div>
                <Label>{t('subject')}</Label>
                <Input {...sendForm.register('subject', { required: channel === 'email' })} />
              </div>
            )}
            <div>
              <Label>{t('bodyLabel')} ({t('variablesHint')}: {'{{firstName}} {{lastName}} {{code}}'})</Label>
              <textarea
                className="min-h-32 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
                placeholder={t('bodyPlaceholder')}
                {...sendForm.register('body', { required: true })}
              />
            </div>
            <Button type="submit" disabled={selected.length === 0} loading={sendMutation.isPending}>
              <Send className="h-4 w-4" /> {t('sendToStudents', { count: selected.length })}
            </Button>
          </form>

          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">{t('recipients')} ({selected.length})</span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSelected(
                    selected.length === (students?.data.length ?? 0)
                      ? []
                      : (students?.data ?? []).map((s) => s.id),
                  )
                }
              >
                {selected.length === (students?.data.length ?? 0) ? t('deselectAll') : t('selectAll')}
              </button>
            </div>
            <div className="max-h-96 divide-y divide-border overflow-y-auto">
              {students?.data.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                      )
                    }
                  />
                  {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-3">
          {can('messages.templates') && (
            <div className="flex justify-end">
              <Button onClick={() => setTplDrawer(true)}>
                <Plus className="h-4 w-4" /> {t('newTemplate')}
              </Button>
            </div>
          )}
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
            {templates?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">{t('noTemplates')}</div>
            ) : (
              <div className="divide-y divide-border">
                {templates?.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      {t.channel === 'email' ? (
                        <Mail className="h-4 w-4 text-muted" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-muted" />
                      )}
                      <div>
                        <div className="font-medium">{t.key}</div>
                        <div className="truncate text-xs text-muted">{t.body.slice(0, 60)}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteTpl.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
          {logs?.data.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">{t('noLogs')}</div>
          ) : (
            <div className="divide-y divide-border">
              {logs?.data.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div>
                    <span className="font-mono text-xs">{l.recipient}</span>
                    {l.subject && <span className="ml-2 text-muted">{l.subject}</span>}
                  </div>
                  <span title={l.error ?? ''}>
                    <StatusBadge status={l.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Drawer
        open={tplDrawer}
        onClose={() => setTplDrawer(false)}
        title={t('newTemplate')}
        footer={
          <>
            <Button variant="outline" onClick={() => setTplDrawer(false)}>
              {tc('cancel')}
            </Button>
            <Button loading={saveTpl.isPending} onClick={tplForm.handleSubmit((v) => saveTpl.mutate(v))}>
              {tc('save')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('templateKey')} *</Label>
              <Input placeholder="payment_reminder" {...tplForm.register('key', { required: true })} />
            </div>
            <div>
              <Label>{t('channel')}</Label>
              <Select
                options={[
                  { value: 'email', label: t('email') },
                  { value: 'sms', label: 'SMS' },
                ]}
                {...tplForm.register('channel')}
              />
            </div>
          </div>
          <div>
            <Label>{t('subjectEmail')}</Label>
            <Input {...tplForm.register('subject')} />
          </div>
          <div>
            <Label>{t('bodyLabel')} *</Label>
            <textarea
              className="min-h-28 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
              {...tplForm.register('body', { required: true })}
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
