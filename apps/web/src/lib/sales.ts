// Sales CRM domain labels, colors and helpers (Azerbaijani).

// Professional muted chart palette (financial SaaS style — no rainbow).
// Use these for all bar/pie/line series; add the single secondary accent only
// when categories are hard to tell apart.
export const CHART_PALETTE = ['#4f7fd9', '#5b8db8', '#7187a6', '#8a96a8', '#a3acb9'];
export const CHART_ACCENT = '#6e65c8';
export const CHART_SERIES = [...CHART_PALETTE, CHART_ACCENT];

export const LEAD_STATUS_LABELS: Record<string, string> = {
  yeni_lead: 'Yeni Lead',
  ilk_yazisma: 'İlk Yazışma',
  demo_gozleyir: 'Demo Gözləyir',
  demo_verildi: 'Demo Verildi',
  zeng_edildi: 'Zəng Edildi',
  follow_up: 'Follow-up',
  hot_lead: 'Hot Lead',
  qerarsiz: 'Qərarsız',
  qiymet_problemi: 'Qiymət Problemi',
  odenis_gozleyir: 'Ödəniş Gözləyir',
  qeydiyyat_oldu: 'Qeydiyyat Oldu',
  satis_baglandi: 'Satış Bağlandı',
  imtina: 'İmtina',
  gelecek_potensial: 'Gələcək Potensial',
};

// Mid-tone badge colors — readable on both the light and the dark navy theme
// (used as text over a 10% tint of the same color).
export const LEAD_STATUS_COLORS: Record<string, string> = {
  yeni_lead: '#64748b', // neutral slate
  ilk_yazisma: '#3b82f6', // blue
  zeng_edildi: '#64748b', // slate
  demo_gozleyir: '#0ea5e9', // sky
  demo_verildi: '#22c55e', // green
  follow_up: '#f59e0b', // amber
  hot_lead: '#ef4444', // red
  qerarsiz: '#64748b', // neutral slate
  qiymet_problemi: '#f59e0b', // amber
  odenis_gozleyir: '#6366f1', // indigo
  qeydiyyat_oldu: '#22c55e', // green (won)
  satis_baglandi: '#22c55e', // green (won)
  imtina: '#ef4444', // red (lost)
  gelecek_potensial: '#64748b', // neutral slate
};

export const LEAD_STATUS_ORDER = [
  'yeni_lead', 'ilk_yazisma', 'zeng_edildi', 'demo_gozleyir', 'demo_verildi',
  'follow_up', 'hot_lead', 'qerarsiz', 'qiymet_problemi', 'odenis_gozleyir',
  'qeydiyyat_oldu', 'satis_baglandi', 'imtina', 'gelecek_potensial',
];

export const PRIORITY_LABELS: Record<string, string> = { hot: 'HOT', warm: 'WARM', cold: 'COLD' };
export const PRIORITY_COLORS: Record<string, string> = { hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6' };

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

export const DEMO_STATUS_LABELS: Record<string, string> = {
  teyin_edilmedi: 'Təyin edilməyib',
  teyin_olundu: 'Təyin olundu',
  verildi: 'Verildi',
  imtina: 'İmtina',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  gozleyir: 'Gözləyir',
  depozit_odedi: 'Depozit ödədi',
  qismen_odenib: 'Qismən ödənib',
  odenib: 'Ödənib',
  gecikib: 'Gecikib',
  legv_edilib: 'Ləğv edilib',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  gozleyir: '#f59e0b',
  depozit_odedi: '#06b6d4',
  qismen_odenib: '#3b82f6',
  odenib: '#22c55e',
  gecikib: '#ef4444',
  legv_edilib: '#64748b',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  nagd: 'Nağd',
  kart: 'Kart',
  bank_kocurmesi: 'Bank köçürməsi',
  birkart: 'BirKart',
  tamkart: 'TamKart',
  bolkart: 'BolKart',
  hisseli: 'Hissəli',
};

export const PAYMENT_PLAN_LABELS: Record<string, string> = { aylik: 'Aylıq', tam: 'Tam' };

export function paymentStatusBadgeStyle(status: string): { background: string; color: string } {
  const c = PAYMENT_STATUS_COLORS[status] ?? '#64748b';
  return { background: `${c}1a`, color: c };
}

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
  { key: 'askedDemo', label: 'Demo istəyib (+25)' },
  { key: 'askedPrice', label: 'Qiymət soruşub (+20)' },
  { key: 'callAnswered', label: 'Zəng açıb (+15)' },
  { key: 'parentInvolved', label: 'Valideynlə gələcək (+20)' },
  { key: 'budgetOk', label: 'Büdcə uyğun (+20)' },
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
