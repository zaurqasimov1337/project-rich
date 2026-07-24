'use client';

import { useQuery } from '@tanstack/react-query';
import { Network } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { api } from '@/lib/api';
import { initials } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

interface OrgNode {
  id: string;
  name: string;
  position: string | null;
  departmentName: string | null;
  managerId: string | null;
}

interface TreeNode extends OrgNode {
  children: TreeNode[];
}

/** Builds a forest from the flat managerId list. Employees whose manager is
 *  missing from the list are treated as roots so nobody disappears. */
function buildTree(rows: OrgNode[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.managerId ? nodes.get(node.managerId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function NodeCard({ node }: { node: TreeNode }) {
  const [first = '', last = ''] = node.name.split(' ');
  return (
    <div>
      <Link
        href={`/hr/employees/${node.id}`}
        className="inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-[var(--shadow-sm)] transition-colors hover:border-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {initials(first, last)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{node.name}</span>
          <span className="block truncate text-xs text-muted">
            {node.position ?? '—'}
            {node.departmentName ? ` · ${node.departmentName}` : ''}
          </span>
        </span>
      </Link>
      {node.children.length > 0 && (
        <div className="ml-5 mt-2 space-y-2 border-l-2 border-border pl-5">
          {node.children.map((child) => (
            <NodeCard key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['hr-org-chart'],
    queryFn: () => api.get<OrgNode[]>('/hr/org-chart'),
  });

  const roots = useMemo(() => buildTree(rows ?? []), [rows]);

  return (
    <div className="space-y-5">
      <PageHeader title="Org sxem" description="Rəhbərlik iyerarxiyası — işçiyə klik edib profilinə keçin" />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-72 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && roots.length === 0 && (
        <EmptyState
          icon={Network}
          title="İşçi tapılmadı"
          description="Org sxem üçün aktiv işçilər və rəhbər təyinatları lazımdır."
        />
      )}

      {!isLoading && roots.length > 0 && (
        <div className="space-y-4 overflow-x-auto rounded-xl border border-border bg-surface/50 p-5">
          {roots.map((root) => (
            <NodeCard key={root.id} node={root} />
          ))}
        </div>
      )}
    </div>
  );
}
