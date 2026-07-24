'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string; // text-* token class for the icon
  className?: string;
}

/** Returns the numeric value when `value` is a plain number / numeric string, else null. */
function parseNumeric(value: React.ReactNode): { target: number; text: string } | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { target: value, text: String(value) };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { target: Number(trimmed), text: trimmed };
  }
  return null;
}

/** Soft ~900ms ease-out count-up for numeric KPI values (transform-free, rAF-based). */
function CountUp({ target, text }: { target: number; text: string }) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(text);
      return;
    }
    const decimals = (text.split('.')[1] ?? '').length;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setDisplay((target * eased).toFixed(decimals));
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, text]);

  return <>{display}</>;
}

/** KPI tile: uppercase label, large numeral (count-up when numeric), optional subtitle and icon. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'text-primary', className }: StatCardProps) {
  const numeric = parseNumeric(value);
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        {Icon && <Icon className={cn('h-4.5 w-4.5', tone)} />}
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums">
        {numeric ? <CountUp target={numeric.target} text={numeric.text} /> : value}
      </div>
      {sub && <div className="mt-2 text-sm text-muted">{sub}</div>}
    </div>
  );
}
