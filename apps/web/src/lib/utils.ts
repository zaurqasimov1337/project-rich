import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(minor: number, currency = 'AZN'): string {
  const value = (minor / 100).toLocaleString('az-AZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'AZN' ? `${value} ₼` : `${value} ${currency}`;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}
