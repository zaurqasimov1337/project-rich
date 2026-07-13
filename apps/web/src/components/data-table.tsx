'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
  emptyTitle = 'Məlumat yoxdur',
  emptyDescription,
  toolbar,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState(search ?? '');
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                onSearchChange(e.target.value);
              }}
              placeholder="Axtar..."
              className="pl-9"
            />
          </div>
        )}
        <div className="flex-1" />
        {toolbar}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted-bg/50">
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
                      <div className="h-4 w-24 animate-pulse rounded bg-muted-bg" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="font-medium text-foreground">{emptyTitle}</div>
                  {emptyDescription && (
                    <div className="mt-1 text-sm text-muted">{emptyDescription}</div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border last:border-0',
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
            {total} nəticədən {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
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

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Aktiv', cls: 'bg-success/10 text-success' },
    inactive: { label: 'Qeyri-aktiv', cls: 'bg-muted-bg text-muted' },
    planned: { label: 'Planlanıb', cls: 'bg-info/10 text-info' },
    finished: { label: 'Bitib', cls: 'bg-muted-bg text-muted' },
    archived: { label: 'Arxiv', cls: 'bg-muted-bg text-muted' },
    graduated: { label: 'Məzun', cls: 'bg-info/10 text-info' },
    frozen: { label: 'Dondurulub', cls: 'bg-warning/10 text-warning' },
    dropped: { label: 'Ayrılıb', cls: 'bg-danger/10 text-danger' },
    scheduled: { label: 'Planlanıb', cls: 'bg-info/10 text-info' },
    done: { label: 'Keçirilib', cls: 'bg-success/10 text-success' },
    cancelled: { label: 'Ləğv edilib', cls: 'bg-danger/10 text-danger' },
    trial: { label: 'Sınaq', cls: 'bg-warning/10 text-warning' },
    invited: { label: 'Dəvət edilib', cls: 'bg-info/10 text-info' },
    disabled: { label: 'Deaktiv', cls: 'bg-danger/10 text-danger' },
    maintenance: { label: 'Təmir', cls: 'bg-warning/10 text-warning' },
  };
  const item = map[status] ?? { label: status, cls: 'bg-muted-bg text-muted' };
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', item.cls)}>
      {item.label}
    </span>
  );
}
