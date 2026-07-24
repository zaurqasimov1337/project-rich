'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';

interface Automation {
  id: string;
  name: string;
  mediaId: string | null;
  mediaCaption: string | null;
  keywords: string[];
  publicReply: string | null;
  dmMessage: string | null;
  enabled: boolean;
  matchCount: number;
  lastMatchedAt: string | null;
}

interface MediaOption {
  id: string;
  caption?: string;
  thumbnail_url?: string;
  media_url?: string;
}

interface FormState {
  id?: string;
  name: string;
  mediaId: string;
  keywords: string;
  publicReply: string;
  dmMessage: string;
  enabled: boolean;
}

const EMPTY: FormState = {
  name: '',
  mediaId: '',
  keywords: '',
  publicReply: '',
  dmMessage: '',
  enabled: true,
};

/** Comment→reply/DM automation manager, shown once Instagram is connected. */
export function InstagramAutomations({ media }: { media: MediaOption[] }) {
  const t = useTranslations('automations');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const manage = can('integrations.manage');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data } = useQuery({
    queryKey: ['ig-automations'],
    queryFn: () => api.get<{ automations: Automation[] }>('/integrations/instagram/automations'),
  });
  const rules = data?.automations ?? [];

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['ig-automations'] });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const body = {
        name: f.name,
        mediaId: f.mediaId || undefined,
        mediaCaption: f.mediaId ? media.find((m) => m.id === f.mediaId)?.caption?.slice(0, 300) : undefined,
        keywords: f.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        publicReply: f.publicReply || undefined,
        dmMessage: f.dmMessage || undefined,
        enabled: f.enabled,
      };
      return f.id
        ? api.patch(`/integrations/instagram/automations/${f.id}`, body)
        : api.post('/integrations/instagram/automations', body);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm(EMPTY);
    },
  });

  const toggle = useMutation({
    mutationFn: (r: Automation) =>
      api.patch(`/integrations/instagram/automations/${r.id}`, { enabled: !r.enabled }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/instagram/automations/${id}`),
    onSuccess: invalidate,
  });

  const run = useMutation({
    mutationFn: () =>
      api.post<{ scanned: number; acted: number; skipped: number; errors: number }>(
        '/integrations/instagram/process-comments',
      ),
  });

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (r: Automation) => {
    setForm({
      id: r.id,
      name: r.name,
      mediaId: r.mediaId ?? '',
      keywords: r.keywords.join(', '),
      publicReply: r.publicReply ?? '',
      dmMessage: r.dmMessage ?? '',
      enabled: r.enabled,
    });
    setOpen(true);
  };

  const mediaLabel = (id: string | null, caption: string | null) => {
    if (!id) return t('allPosts');
    const cap = caption ?? media.find((m) => m.id === id)?.caption;
    return cap ? `${cap.slice(0, 40)}…` : `${t('post')} ${id.slice(-6)}`;
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" /> {t('title')}
          </h2>
          <p className="mt-1 text-xs text-muted">{t('hint')}</p>
        </div>
        {manage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" loading={run.isPending} onClick={() => run.mutate()}>
              <Play className="h-4 w-4" /> {t('runNow')}
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" /> {t('newRule')}
            </Button>
          </div>
        )}
      </div>

      {run.isSuccess && (
        <p className="mt-3 text-sm text-success">
          {t('runResult', {
            acted: run.data?.acted ?? 0,
            scanned: run.data?.scanned ?? 0,
          })}
        </p>
      )}
      {run.isError && (
        <p className="mt-3 text-sm text-danger">
          {(run.error as { message?: string })?.message ?? tc('error')}
        </p>
      )}

      {rules.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${r.enabled ? 'bg-success/15 text-success' : 'bg-muted/15 text-muted'}`}
                  >
                    {r.enabled ? t('on') : t('off')}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted">
                  <div>
                    {t('scope')}: {mediaLabel(r.mediaId, r.mediaCaption)}
                    {' · '}
                    {r.keywords.length ? `${t('keywords')}: ${r.keywords.join(', ')}` : t('anyComment')}
                  </div>
                  {r.publicReply && <div>↳ {t('reply')}: “{r.publicReply}”</div>}
                  {r.dmMessage && <div>↳ DM: “{r.dmMessage}”</div>}
                  <div>{t('matched', { count: r.matchCount })}</div>
                </div>
              </div>
              {manage && (
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-md p-1.5 text-muted hover:bg-muted/10 hover:text-foreground"
                    onClick={() => toggle.mutate(r)}
                    title={r.enabled ? t('off') : t('on')}
                  >
                    <span className="text-xs font-medium">{r.enabled ? t('off') : t('on')}</span>
                  </button>
                  <button
                    className="rounded-md p-1.5 text-muted hover:bg-muted/10 hover:text-foreground"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                    onClick={() => remove.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? t('editRule') : t('newRule')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={save.isPending}
              disabled={!form.name || (!form.publicReply && !form.dmMessage)}
              onClick={() => save.mutate(form)}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>{t('nameLabel')} *</Label>
            <Input
              value={form.name}
              placeholder={t('namePlaceholder')}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('postLabel')}</Label>
            <Select
              value={form.mediaId}
              onChange={(e) => setForm({ ...form, mediaId: e.target.value })}
              options={[
                { value: '', label: t('allPosts') },
                ...media.map((m) => ({
                  value: m.id,
                  label: m.caption ? m.caption.slice(0, 50) : `${t('post')} ${m.id.slice(-6)}`,
                })),
              ]}
            />
          </div>
          <div>
            <Label>{t('keywordsLabel')}</Label>
            <Input
              value={form.keywords}
              placeholder={t('keywordsPlaceholder')}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted">{t('keywordsHint')}</p>
          </div>
          <div>
            <Label>{t('replyLabel')}</Label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
              value={form.publicReply}
              placeholder={t('replyPlaceholder')}
              onChange={(e) => setForm({ ...form, publicReply: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('dmLabel')}</Label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
              value={form.dmMessage}
              placeholder={t('dmPlaceholder')}
              onChange={(e) => setForm({ ...form, dmMessage: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            {t('enabledLabel')}
          </label>
          {save.isError && (
            <p className="text-sm text-danger">
              {(save.error as { message?: string })?.message ?? tc('error')}
            </p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
