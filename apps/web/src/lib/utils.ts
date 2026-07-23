import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Symbols for the currencies we actually display; anything else shows its code. */
const CURRENCY_SYMBOLS: Record<string, string> = { AZN: '₼', USD: '$', EUR: '€', GBP: '£', TRY: '₺', RUB: '₽' };

export function formatMoney(minor: number, currency = 'AZN'): string {
  const value = (minor / 100).toLocaleString('az-AZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = CURRENCY_SYMBOLS[currency];
  // $ leads (‎$1,234.00); the manat sign trails, as it's written locally.
  if (currency === 'USD' || currency === 'EUR' || currency === 'GBP') return `${symbol}${value}`;
  return symbol ? `${value} ${symbol}` : `${value} ${currency}`;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}
