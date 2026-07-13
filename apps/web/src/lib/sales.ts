// Sales CRM domain labels, colors and helpers (Azerbaijani).

export const LEAD_STATUS_LABELS: Record<string, string> = {
  yeni_lead: 'Yeni Lead',
  ilk_yazisma: 'İlk yazışma',
  demo_gozleyir: 'Demo gözləyir',
  demo_verildi: 'Demo verildi',
  zeng_edildi: 'Zəng edildi',
  follow_up: 'Follow-up',
  hot_lead: 'Hot lead',
  qerarsiz: 'Qərarsız',
  qiymet_problemi: 'Qiymət problemi',
  odenis_gozleyir: 'Ödəniş gözləyir',
  qeydiyyat_oldu: 'Qeydiyyat oldu',
  satis_baglandi: 'Satış bağlandı',
  imtina: 'İmtina',
  gelecek_potensial: 'Gələcək potensial',
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  yeni_lead: '#64748b',
  ilk_yazisma: '#3b82f6',
  zeng_edildi: '#3b82f6',
  demo_gozleyir: '#06b6d4',
  demo_verildi: '#06b6d4',
  follow_up: '#f59e0b',
  hot_lead: '#f59e0b',
  qerarsiz: '#f59e0b',
  qiymet_problemi: '#f59e0b',
  odenis_gozleyir: '#8b5cf6',
  qeydiyyat_oldu: '#16a34a',
  satis_baglandi: '#16a34a',
  imtina: '#dc2626',
  gelecek_potensial: '#64748b',
};

export const LEAD_STATUS_ORDER = [
  'yeni_lead', 'ilk_yazisma', 'zeng_edildi', 'demo_gozleyir', 'demo_verildi',
  'follow_up', 'hot_lead', 'qerarsiz', 'qiymet_problemi', 'odenis_gozleyir',
  'qeydiyyat_oldu', 'satis_baglandi', 'imtina', 'gelecek_potensial',
];

export const PRIORITY_LABELS: Record<string, string> = { hot: 'HOT', warm: 'WARM', cold: 'COLD' };
export const PRIORITY_COLORS: Record<string, string> = { hot: '#dc2626', warm: '#f59e0b', cold: '#3b82f6' };

export const SOURCE_LABELS: Record<string, string> = {
  instagram_dm: 'Instagram DM',
  whatsapp: 'WhatsApp',
  telefon: 'Telefon',
  referans: 'Referans',
  website: 'Vebsayt',
  event: 'Tədbir',
  organic: 'Organik',
  paid_ads: 'Ödənişli reklam',
  tiktok: 'TikTok',
};
export const SOURCE_KEYS = Object.keys(SOURCE_LABELS);

export const GENDER_LABELS: Record<string, string> = { kisi: 'Kişi', qadin: 'Qadın', diger: 'Digər' };

export const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Lead yaradıldı',
  status_changed: 'Status dəyişdi',
  followup: 'Follow-up',
  call: 'Zəng',
  demo_scheduled: 'Demo planlandı',
  demo_done: 'Demo keçirildi',
  payment: 'Ödəniş',
  registration: 'Qeydiyyat',
  note: 'Qeyd',
};

export const SCORE_FLAG_LABELS: { key: string; label: string }[] = [
  { key: 'askedDemo', label: 'Demo istədi (+25)' },
  { key: 'askedPrice', label: 'Qiymət soruşdu (+20)' },
  { key: 'callAnswered', label: 'Zəngə cavab verdi (+15)' },
  { key: 'parentInvolved', label: 'Valideyn cəlb olunub (+20)' },
  { key: 'budgetOk', label: 'Büdcə uyğundur (+20)' },
  { key: 'notResponding', label: 'Cavab vermir (−15)' },
  { key: 'passive7d', label: '7 gün passiv (−20)' },
];

/** DD.MM.YYYY */
export function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** DD.MM.YYYY HH:mm */
export function fmtDateTime(s: string | Date | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(d)} ${hh}:${mi}`;
}

export function statusBadgeStyle(status: string): { background: string; color: string } {
  const c = LEAD_STATUS_COLORS[status] ?? '#64748b';
  return { background: `${c}1a`, color: c };
}

export function priorityBadgeStyle(priority: string): { background: string; color: string } {
  const c = PRIORITY_COLORS[priority] ?? '#64748b';
  return { background: `${c}1a`, color: c };
}
