'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { HR_STATUS_LABELS } from '@/lib/hr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  note: string | null;
}

interface AttendanceRow {
  employeeId: string;
  employeeName: string;
  position: string | null;
  hrStatus: string;
  record: AttendanceRecord | null;
}

interface AttendanceDay {
  date: string;
  rows: AttendanceRow[];
}

interface StatsRow {
  employeeId: string;
  employeeName: string;
  position: string | null;
  daysPresent: number;
  totalLateMinutes: number;
}

interface AttendanceStats {
  month: string;
  rows: StatsRow[];
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** Server stores HH:mm combined with the date as UTC — read it back verbatim. */
const timeOf = (iso: string | null) => (iso ? iso.slice(11, 16) : '');

export default function HrAttendancePage() {
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canManage = can('hr.employees.manage');

  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  // Uncommitted per-row edits (time / note inputs) keyed by employeeId.
  const [edits, setEdits] = useState<Record<string, { checkIn?: string; checkOut?: string; note?: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['hr-attendance', date],
    queryFn: () => api.get<AttendanceDay>(`/hr/attendance?date=${date}`),
  });
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-attendance-stats', month],
    queryFn: () => api.get<AttendanceStats>(`/hr/attendance/stats?month=${month}`),
  });

  const checkMutation = useMutation({
    mutationFn: (body: { employeeId: string; date: string; checkIn?: string; checkOut?: string; note?: string }) =>
      api.post('/hr/attendance/check', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hr-attendance', date] });
      void qc.invalidateQueries({ queryKey: ['hr-attendance-stats'] });
    },
  });

  const setEdit = (employeeId: string, patch: { checkIn?: string; checkOut?: string; note?: string }) =>
    setEdits((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }));

  const commit = (employeeId: string, field: 'checkIn' | 'checkOut' | 'note') => {
    const value = edits[employeeId]?.[field];
    if (value === undefined || value === '') return;
    checkMutation.mutate({ employeeId, date, [field]: value });
    setEdits((prev) => {
      const next = { ...prev[employeeId] };
      delete next[field];
      return { ...prev, [employeeId]: next };
    });
  };

  const markNow = (employeeId: string, field: 'checkIn' | 'checkOut') =>
    checkMutation.mutate({ employeeId, date, [field]: nowTime() });

  return (
    <div className="space-y-5">
      <PageHeader title="Davamiyyət" description="İşçilərin gündəlik giriş-çıxış qeydləri." />

      {checkMutation.isError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {(checkMutation.error as Error).message}
        </div>
      )}

      {/* daily table */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4 text-primary" /> Günlük davamiyyət
          </h3>
          <div className="flex items-center gap-2">
            <Label className="mb-0">Tarix</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} className="w-44" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted-bg" />
            ))}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">İşçi tapılmadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2">İşçi</th>
                  <th className="px-3 py-2">Giriş</th>
                  <th className="px-3 py-2">Çıxış</th>
                  <th className="px-3 py-2">Gecikmə (dəq)</th>
                  <th className="px-3 py-2">Qeyd</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const st = HR_STATUS_LABELS[row.hrStatus] ?? { label: row.hrStatus, tone: 'neutral' as const };
                  const edit = edits[row.employeeId] ?? {};
                  const checkIn = edit.checkIn ?? timeOf(row.record?.checkIn ?? null);
                  const checkOut = edit.checkOut ?? timeOf(row.record?.checkOut ?? null);
                  const note = edit.note ?? row.record?.note ?? '';
                  const late = row.record?.lateMinutes ?? 0;
                  return (
                    <tr key={row.employeeId} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.employeeName}</span>
                          <Badge tone={st.tone} dot>{st.label}</Badge>
                        </div>
                        {row.position && <div className="text-xs text-muted">{row.position}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={checkIn}
                              className="w-28"
                              onChange={(e) => setEdit(row.employeeId, { checkIn: e.target.value })}
                              onBlur={() => commit(row.employeeId, 'checkIn')}
                            />
                            {!row.record?.checkIn && (
                              <Button size="sm" variant="outline" onClick={() => markNow(row.employeeId, 'checkIn')}>
                                Qeyd et
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="tabular-nums">{timeOf(row.record?.checkIn ?? null) || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={checkOut}
                              className="w-28"
                              onChange={(e) => setEdit(row.employeeId, { checkOut: e.target.value })}
                              onBlur={() => commit(row.employeeId, 'checkOut')}
                            />
                            {!row.record?.checkOut && (
                              <Button size="sm" variant="outline" onClick={() => markNow(row.employeeId, 'checkOut')}>
                                Qeyd et
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="tabular-nums">{timeOf(row.record?.checkOut ?? null) || '—'}</span>
                        )}
                      </td>
                      <td className={cn('px-3 py-2 tabular-nums', late > 0 ? 'font-semibold text-danger' : 'text-muted')}>
                        {row.record?.checkIn ? late : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {canManage ? (
                          <Input
                            value={note}
                            maxLength={500}
                            placeholder="Qeyd"
                            className="w-44"
                            onChange={(e) => setEdit(row.employeeId, { note: e.target.value })}
                            onBlur={() => commit(row.employeeId, 'note')}
                          />
                        ) : (
                          <span className="text-muted">{row.record?.note ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* monthly stats */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <CalendarDays className="h-4 w-4 text-primary" /> Aylıq statistika
          </h3>
          <div className="flex items-center gap-2">
            <Label className="mb-0">Ay</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || todayStr().slice(0, 7))}
              className="w-44"
            />
          </div>
        </div>

        {statsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted-bg" />
            ))}
          </div>
        ) : !stats || stats.rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Məlumat yoxdur.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2">İşçi</th>
                  <th className="px-3 py-2 text-right">Gün</th>
                  <th className="px-3 py-2 text-right">Gecikmə cəmi (dəq)</th>
                </tr>
              </thead>
              <tbody>
                {stats.rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.employeeName}</span>
                      {row.position && <span className="ml-2 text-xs text-muted">{row.position}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.daysPresent}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        row.totalLateMinutes > 0 ? 'font-semibold text-danger' : 'text-muted',
                      )}
                    >
                      {row.totalLateMinutes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
