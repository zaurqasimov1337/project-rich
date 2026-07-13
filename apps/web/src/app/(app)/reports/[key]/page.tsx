'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface Column {
  key: string;
  header: string;
  type?: 'money' | 'number' | 'date' | 'string';
}
interface ReportResult {
  columns: Column[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
  chart?: { label: string; value: number }[];
}

const RANGES = [
  { value: 'today', label: 'Bu gün' },
  { value: 'this_week', label: 'Bu həftə' },
  { value: 'this_month', label: 'Bu ay' },
  { value: 'last_month', label: 'Keçən ay' },
  { value: 'this_quarter', label: 'Bu rüb' },
  { value: 'this_year', label: 'Bu il' },
];

const NAMES: Record<string, string> = {
  revenue: 'Gəlir hesabatı',
  debts: 'Borclar',
  attendance: 'Davamiyyət',
  'group-fill': 'Qrup doluluğu',
  'teacher-load': 'Müəllim yükü',
  'course-roi': 'Kurs gəlirliliyi',
  'lead-funnel': 'Müraciət konversiyası',
};

function formatCell(value: unknown, type?: Column['type']): string {
  if (value == null || value === '') return '—';
  if (type === 'money') return formatMoney(Number(value));
  if (type === 'date') return new Date(value as string).toLocaleDateString('az-Latn-AZ');
  return String(value);
}

export default function ReportDetailPage() {
  const { key } = useParams<{ key: string }>();
  const can = useAuth((s) => s.can);
  const [range, setRange] = useState('this_month');

  const { data, isLoading } = useQuery({
    queryKey: ['report', key, range],
    queryFn: () => api.get<ReportResult>(`/reports/${key}?range=${range}`),
  });
  const colCount = data?.columns.length ?? 4;

  const exportUrl = (format: 'xlsx' | 'csv') =>
    `${process.env.NEXT_PUBLIC_API_URL ?? '/api/v1'}/reports/${key}/export?range=${range}&format=${format}`;

  const download = async (format: 'xlsx' | 'csv') => {
    // fetch with auth then trigger a blob download (export endpoint needs Bearer)
    const { getAccessToken } = await import('@/lib/api');
    const res = await fetch(exportUrl(format), {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}-${range}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Hesabatlar
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{NAMES[key] ?? key}</h1>
        <div className="flex items-center gap-2 print:hidden">
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            options={RANGES}
            className="w-40"
          />
          {can('reports.export') && (
            <>
              <Button variant="outline" size="sm" onClick={() => download('xlsx')}>
                <Download className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => download('csv')}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Çap
          </Button>
        </div>
      </div>

      {/* Totals */}
      {data?.totals && (
        <div className="flex flex-wrap gap-4">
          {Object.entries(data.totals).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-surface px-4 py-2 shadow-sm">
              <span className="text-xs text-muted">{k}</span>
              <div className="font-bold tabular-nums">
                {['income', 'expense', 'profit', 'totalDebt'].includes(k)
                  ? formatMoney(v)
                  : v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {data?.chart && data.chart.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="#4F46E5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted-bg/50 text-left text-muted">
              {data?.columns.map((c) => (
                <th key={c.key} className="px-4 py-2.5 font-semibold whitespace-nowrap">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={colCount} className="px-4 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-muted-bg" />
                  </td>
                </tr>
              ))
            ) : data?.rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="px-4 py-10 text-center text-muted">
                  Bu dövr üçün məlumat yoxdur
                </td>
              </tr>
            ) : (
              data?.rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {data.columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-2.5',
                        (c.type === 'money' || c.type === 'number') && 'tabular-nums',
                      )}
                    >
                      {formatCell(row[c.key], c.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
