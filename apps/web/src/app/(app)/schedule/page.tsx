'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LessonEvent {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  type: string;
  topic: string | null;
  group: { id: string; name: string; course: { name: string } };
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00–21:00
const DAY_LABELS = ['B.e', 'Ç.a', 'Çər', 'C.a', 'Cümə', 'Şən', 'Baz'];

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = useMemo(
    () => new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000),
    [weekStart],
  );

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['schedule', weekStart.toISOString()],
    queryFn: () =>
      api.get<LessonEvent[]>(
        `/schedule?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`,
      ),
  });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart.getTime() + i * 24 * 3600 * 1000);
        return { date, key: date.toDateString() };
      }),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, LessonEvent[]>();
    for (const l of lessons ?? []) {
      const key = new Date(l.startAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return map;
  }, [lessons]);

  const today = new Date().toDateString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Cədvəl</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 24 * 3600 * 1000))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Bu həftə
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium text-muted tabular-nums">
            {weekStart.toLocaleDateString('az-Latn-AZ', { day: '2-digit', month: '2-digit' })} —{' '}
            {new Date(weekEnd.getTime() - 1).toLocaleDateString('az-Latn-AZ', {
              day: '2-digit',
              month: '2-digit',
            })}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <div className="grid min-w-[900px] grid-cols-[60px_repeat(7,1fr)]">
          {/* header row */}
          <div className="border-b border-r border-border" />
          {days.map(({ date, key }, i) => (
            <div
              key={key}
              className={cn(
                'border-b border-border px-2 py-2 text-center text-sm font-semibold',
                i < 6 && 'border-r',
                key === today && 'bg-primary/5 text-primary',
              )}
            >
              {DAY_LABELS[i]}{' '}
              <span className="text-muted">{date.getDate()}</span>
            </div>
          ))}

          {/* hour rows */}
          {HOURS.map((h) => (
            <div key={h} className="contents">
              <div className="border-b border-r border-border px-2 py-1 text-right text-[11px] text-muted tabular-nums">
                {String(h).padStart(2, '0')}:00
              </div>
              {days.map(({ key }, i) => {
                const dayLessons = (byDay.get(key) ?? []).filter(
                  (l) => new Date(l.startAt).getHours() === h,
                );
                return (
                  <div
                    key={`${key}-${h}`}
                    className={cn(
                      'relative min-h-[44px] border-b border-border p-0.5',
                      i < 6 && 'border-r',
                      key === today && 'bg-primary/5',
                    )}
                  >
                    {dayLessons.map((l) => {
                      const start = new Date(l.startAt);
                      const end = new Date(l.endAt);
                      const durationMin = (end.getTime() - start.getTime()) / 60000;
                      return (
                        <div
                          key={l.id}
                          title={`${l.group.name} · ${l.group.course.name}`}
                          className={cn(
                            'mb-0.5 rounded-md px-1.5 py-1 text-[11px] leading-tight',
                            l.status === 'cancelled'
                              ? 'bg-danger/10 text-danger line-through'
                              : 'bg-primary/15 text-primary',
                          )}
                          style={{ minHeight: `${Math.max((durationMin / 60) * 40, 24)}px` }}
                        >
                          <div className="font-semibold">{l.group.name}</div>
                          <div className="tabular-nums opacity-80">
                            {start.toTimeString().slice(0, 5)}–{end.toTimeString().slice(0, 5)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted">Yüklənir...</div>}
    </div>
  );
}
