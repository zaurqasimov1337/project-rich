'use client';

import { ChevronDown, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAccessToken } from '@/lib/api';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
];

interface ExportMenuProps {
  /** Builds the (authorized) URL to fetch for a given format. */
  urlFor: (format: ExportFormat) => string;
  /** File name (with extension) used for the browser download. */
  filenameFor: (format: ExportFormat) => string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Small CSV | Excel | PDF export dropdown. Fetches with the Bearer token and
 * triggers a blob download (export endpoints bypass the JSON envelope).
 */
export function ExportMenu({ urlFor, filenameFor, label = 'Export', size = 'md', className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const download = async (format: ExportFormat) => {
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(urlFor(format), {
        credentials: 'include',
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFor(format);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <Button variant="outline" size={size} loading={busy} onClick={() => setOpen((o) => !o)}>
        {!busy && <Download className="h-4 w-4" />} {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="animate-scale-in absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
          {FORMATS.map((f) => (
            <button
              key={f.format}
              type="button"
              className="w-full rounded-md px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted-bg"
              onClick={() => void download(f.format)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
