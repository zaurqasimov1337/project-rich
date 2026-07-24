/* Theme-aware Mactab brand marks (transparent PNGs in /public/brand). */
/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <img src="/brand/logo-on-light.png" alt="Mactab" className="h-full w-auto object-contain dark:hidden" />
      <img src="/brand/logo-on-dark.png" alt="Mactab" className="hidden h-full w-auto object-contain dark:block" />
    </span>
  );
}

export function BrandIcon({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <img src="/brand/icon-on-light.png" alt="Mactab" className="h-full w-auto object-contain dark:hidden" />
      <img src="/brand/icon-on-dark.png" alt="Mactab" className="hidden h-full w-auto object-contain dark:block" />
    </span>
  );
}
