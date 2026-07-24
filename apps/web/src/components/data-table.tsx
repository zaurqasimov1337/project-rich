'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  total?: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  total = 0,
  page,
  limit,
  onPageChange,
  search,
  onSearchChange,
  onRowClick,
  emptyTitle,
  emptyDescription,
  toolbar,
}: DataTableProps<T>) {
  const t = useTranslations('common');
  const [localSearch, setLocalSearch] = useState(search ?? '');
  const pages = Math.max(1, Math.ceil(total / limit));
  const emptyLabel = emptyTitle ?? t('noData');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {onSearchChange && (
          <div className="relative w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                onSearchChange(e.target.value);
              }}
              placeholder={t('search')}
              className="pl-9"
            />
          </div>
        )}
        <div className="flex-1" />
        {toolbar}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted-bg/80 backdrop-blur-sm">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-left font-semibold text-muted whitespace-nowrap',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-24 animate-shimmer rounded bg-muted-bg" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="font-medium text-foreground">{emptyLabel}</div>
                  {emptyDescription && (
                    <div className="mt-1 text-sm text-muted">{emptyDescription}</div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  style={{ '--row-i': Math.min(i, 15) } as React.CSSProperties}
                  className={cn(
                    'animate-row-in border-b border-border transition-colors duration-150 last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-muted-bg/50',
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 tabular-nums">
              {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_CLS: Record<string, string> = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted-bg text-muted',
  planned: 'bg-info/10 text-info',
  finished: 'bg-muted-bg text-muted',
  archived: 'bg-muted-bg text-muted',
  graduated: 'bg-info/10 text-info',
  frozen: 'bg-warning/10 text-warning',
  dropped: 'bg-danger/10 text-danger',
  scheduled: 'bg-info/10 text-info',
  done: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  trial: 'bg-warning/10 text-warning',
  invited: 'bg-info/10 text-info',
  disabled: 'bg-danger/10 text-danger',
  maintenance: 'bg-warning/10 text-warning',
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  paid: 'bg-success/10 text-success',
  unpaid: 'bg-danger/10 text-danger',
  overdue: 'bg-danger/10 text-danger',
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('statuses');
  const cls = STATUS_CLS[status] ?? 'bg-muted-bg text-muted';
  let label = status;
  try {
    label = t(status);
  } catch {
    label = status;
  }
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}
