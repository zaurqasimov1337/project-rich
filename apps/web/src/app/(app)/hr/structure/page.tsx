'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, FolderOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Label } from '@/components/ui/input';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface Department {
  id: string;
  name: string;
  kind: string; // departament|sobe|bolme
  parentId: string | null;
  note: string | null;
  employeeCount: number;
  teacherCount: number;
}

interface DeptForm {
  name: string;
  kind: string;
  parentId: string;
  note: string;
}

const EMPTY_FORM: DeptForm = { name: '', kind: 'departament', parentId: '', note: '' };

const KIND_KEYS: Record<string, string> = {
  departament: 'kindDepartament',
  sobe: 'kindSobe',
  bolme: 'kindBolme',
};

const KIND_TONES: Record<string, 'primary' | 'info' | 'accent'> = {
  departament: 'primary',
  sobe: 'info',
  bolme: 'accent',
};

/** A bölmə is the deepest level — it cannot hold children. */
const canHaveChildren = (kind: string) => kind !== 'bolme';

/** The kind a child created under this level should get. */
const childKindOf = (parent: Department | null) =>
  !parent ? 'departament' : parent.kind === 'departament' ? 'sobe' : 'bolme';

export default function StructurePage() {
  const t = useTranslations('hr');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canManage = can('hr.employees.manage');

  // Drill-down navigation: stack of selected department ids (empty = root level).
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/departments'),
  });

  const byId = useMemo(() => new Map((departments ?? []).map((d) => [d.id, d])), [departments]);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Department[]>();
    for (const d of departments ?? []) {
      // Parents outside the list (should not happen) fall back to root.
      const key = d.parentId && byId.has(d.parentId) ? d.parentId : null;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [departments, byId]);

  // Resolve the path stack against fresh data; a deleted/missing node trims the chain.
  const chain = useMemo(() => {
    const out: Department[] = [];
    for (const id of path) {
      const d = byId.get(id);
      if (!d) break;
      out.push(d);
    }
    return out;
  }, [path, byId]);

  const current = chain.length > 0 ? chain[chain.length - 1] : null;
  const rows = childrenOf.get(current?.id ?? null) ?? [];
  const filtered = search.trim()
    ? rows.filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const childKind = childKindOf(current);
  const newLabel = !current
    ? 'Yeni departament'
    : current.kind === 'departament'
      ? 'Yeni şöbə'
      : 'Yeni bölmə';
  const levelTitle = !current
    ? t('structureTitle')
    : current.kind === 'departament'
      ? 'Şöbələr'
      : current.kind === 'sobe'
        ? 'Bölmələr'
        : 'Alt bölmələr';

  const drillIn = (d: Department) => {
    if (!canHaveChildren(d.kind)) return;
    setPath((p) => [...p, d.id]);
    setSearch('');
  };

  const goBack = () => {
    setPath((p) => p.slice(0, -1));
    setSearch('');
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['departments'] });
    void qc.invalidateQueries({ queryKey: ['employees'] });
  };

  const saveMutation = useMutation({
    mutationFn: (v: DeptForm) => {
      const payload = {
        name: v.name.trim(),
        kind: v.kind,
        parentId: v.parentId || undefined,
        note: v.note.trim() || undefined,
      };
      return editing
        ? api.patch(`/departments/${editing.id}`, payload)
        : api.post('/departments', payload);
    },
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
  });

  // Create always targets the current level: parent + kind are implied.
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId: current?.id ?? '', kind: childKind });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, kind: d.kind, parentId: d.parentId ?? '', note: d.note ?? '' });
    setFormError(null);
    setModalOpen(true);
  };

  // A node cannot be re-parented to itself or its own subtree.
  const parentOptions = useMemo(() => {
    const all = departments ?? [];
    if (!editing) return all;
    const blocked = new Set<string>([editing.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const d of all) {
        if (d.parentId && blocked.has(d.parentId) && !blocked.has(d.id)) {
          blocked.add(d.id);
          grew = true;
        }
      }
    }
    return all.filter((d) => !blocked.has(d.id));
  }, [departments, editing]);

  const newButton = canManage && (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" /> {newLabel}
    </Button>
  );

  return (
    <div className="space-y-5">
      {current ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={goBack} title="Geri" aria-label="Geri">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight">{levelTitle}</h1>
              <div className="mt-0.5 text-sm text-muted">{chain.map((d) => d.name).join(' - ')}</div>
            </div>
          </div>
          {newButton}
        </div>
      ) : (
        <PageHeader title={t('structureTitle')} actions={newButton} />
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Building2}
            title={current ? 'Bu səviyyədə vahid yoxdur' : t('noUnits')}
            description={current ? 'Bu vahidin altına hələ heç nə əlavə edilməyib.' : t('noUnitsDesc')}
            action={newButton}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad üzrə axtar..."
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="w-12 px-4 py-2.5 text-left font-semibold">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Başlıq</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Alt vahid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">İşçi</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Müəllim</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      Heç nə tapılmadı
                    </td>
                  </tr>
                ) : (
                  filtered.map((d, i) => {
                    const childCount = (childrenOf.get(d.id) ?? []).length;
                    const drillable = canHaveChildren(d.kind);
                    return (
                      <tr
                        key={d.id}
                        className={drillable ? 'cursor-pointer hover:bg-muted-bg/50' : 'hover:bg-muted-bg/30'}
                        onClick={() => drillIn(d)}
                      >
                        <td className="px-4 py-3 text-muted">{i + 1}.</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">{d.name}</span>
                            <Badge tone={KIND_TONES[d.kind] ?? 'neutral'}>
                              {t(KIND_KEYS[d.kind] ?? 'kindDepartament')}
                            </Badge>
                          </div>
                          {d.note && <div className="mt-0.5 max-w-md truncate text-xs text-muted">{d.note}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {drillable ? (
                            <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-muted-bg px-2 py-0.5 text-xs font-semibold">
                              {childCount}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{d.employeeCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{d.teacherCount}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {drillable && (
                              <button
                                className="rounded-lg border border-border bg-muted-bg/50 p-1.5 text-muted transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                                onClick={() => drillIn(d)}
                                title="Daxil ol"
                                aria-label="Daxil ol"
                              >
                                <FolderOpen className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canManage && (
                              <>
                                <button
                                  className="rounded-lg border border-border bg-muted-bg/50 p-1.5 text-muted transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                                  onClick={() => openEdit(d)}
                                  title={tc('edit')}
                                  aria-label={tc('edit')}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="rounded-lg border border-danger/25 bg-danger/10 p-1.5 text-danger transition-colors duration-150 hover:bg-danger/20"
                                  onClick={() => {
                                    deleteMutation.reset();
                                    setDeleting(d);
                                  }}
                                  title={tc('delete')}
                                  aria-label={tc('delete')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('editUnit') : newLabel}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={!form.name.trim()}
              onClick={() => saveMutation.mutate(form)}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>
          )}
          {!editing && chain.length > 0 && (
            <div className="rounded-lg bg-muted-bg px-3 py-2 text-xs text-muted">
              {chain.map((d) => d.name).join(' - ')}
            </div>
          )}
          <div>
            <Label>{t('unitName')} *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className={editing ? 'grid grid-cols-2 gap-3' : ''}>
            <div>
              <Label>{t('kindLabel')}</Label>
              <Select
                options={Object.entries(KIND_KEYS).map(([value, key]) => ({ value, label: t(key) }))}
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              />
            </div>
            {editing && (
              <div>
                <Label>{t('parentUnit')}</Label>
                <Select
                  placeholder={t('noParent')}
                  options={parentOptions.map((d) => ({ value: d.id, label: d.name }))}
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                />
              </div>
            )}
          </div>
          <div>
            <Label>{t('noteLabel')}</Label>
            <Input
              maxLength={500}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title={t('confirmDeleteUnit')}
        description={
          deleteMutation.isError
            ? (deleteMutation.error as Error).message
            : t('confirmDeleteUnitDesc')
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
