'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { PRIORITY_LABELS, priorityBadgeStyle } from '@/lib/sales';

interface PipelineLead {
  id: string;
  leadNo: number | null;
  fullName: string;
  phone: string | null;
  status: string;
  priority: string;
  score: number;
  trainingName: string | null;
}
interface PipelineColumn {
  key: string;
  label: string;
  count: number;
  leads: PipelineLead[];
}

const COLUMN_COLORS = ['#64748b', '#3b82f6', '#06b6d4', '#f59e0b', '#8b5cf6', '#16a34a', '#dc2626'];

export default function PipelinePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canMove = can('leads.update');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: columns, isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => api.get<PipelineColumn[]>('/leads/pipeline'),
  });

  const moveMut = useMutation({
    mutationFn: ({ leadId, column }: { leadId: string; column: string }) =>
      api.patch(`/leads/${leadId}/column`, { column }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pipeline'] }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Satış boru xətti</h1>
        <p className="mt-0.5 text-sm text-muted">
          Kartı sütunlar arasında sürüşdürərək statusu dəyişin.
        </p>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-80 w-[280px] shrink-0 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {(columns ?? []).map((col, idx) => {
            const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
            return (
              <div
                key={col.key}
                className={`flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted-bg/30 transition-colors ${
                  dragOver === col.key ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDragOver={(e) => {
                  if (!canMove) return;
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
                onDrop={() => {
                  if (canMove && dragging) moveMut.mutate({ leadId: dragging, column: col.key });
                  setDragging(null);
                  setDragOver(null);
                }}
              >
                <div
                  className="flex items-center gap-2 rounded-t-xl px-3 py-2.5"
                  style={{ borderTop: `3px solid ${color}` }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span
                    className="ml-auto rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{ background: `${color}1a`, color }}
                  >
                    {col.count}
                  </span>
                </div>

                <div className="flex-1 space-y-2 px-2 pb-2">
                  {col.leads.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
                      Boşdur
                    </div>
                  ) : (
                    col.leads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable={canMove}
                        onDragStart={() => canMove && setDragging(lead.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDragOver(null);
                        }}
                        onClick={() => {
                          if (dragging) return;
                          router.push(`/crm/leads/${lead.id}`);
                        }}
                        className={`group rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md ${
                          canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        } ${dragging === lead.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{lead.fullName}</div>
                            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                              <Phone className="h-3 w-3 shrink-0" />
                              {lead.phone ?? '—'}
                            </div>
                          </div>
                          {canMove && (
                            <GripVertical className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>

                        <div className="mt-2 truncate text-xs text-muted">
                          {lead.trainingName ?? 'Təlim təyin edilməyib'}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                            style={priorityBadgeStyle(lead.priority)}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: priorityBadgeStyle(lead.priority).color }}
                            />
                            {PRIORITY_LABELS[lead.priority] ?? lead.priority}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-muted">
                            Skor: {lead.score}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
