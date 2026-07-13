'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LANGS = [
  { code: 'az', label: 'Azərbaycanca', short: 'AZ' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'tr', label: 'Türkçe', short: 'TR' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('topbar');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function choose(code: string) {
    if (code === locale) {
      setOpen(false);
      return;
    }
    document.cookie = `locale=${code}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0];

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('language')}
        onClick={() => setOpen((o) => !o)}
        className="gap-1.5"
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs font-semibold">{current.short}</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-44 rounded-lg border border-border bg-surface p-1 shadow-lg">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted-bg"
            >
              <span>{l.label}</span>
              {l.code === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
