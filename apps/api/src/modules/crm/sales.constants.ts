// ===== Sales CRM domain constants =====

export const LEAD_STATUSES = [
  'yeni_lead',
  'ilk_yazisma',
  'demo_gozleyir',
  'demo_verildi',
  'zeng_edildi',
  'follow_up',
  'hot_lead',
  'qerarsiz',
  'qiymet_problemi',
  'odenis_gozleyir',
  'qeydiyyat_oldu',
  'satis_baglandi',
  'imtina',
  'gelecek_potensial',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  'instagram_dm',
  'whatsapp',
  'telefon',
  'referans',
  'website',
  'event',
  'organic',
  'paid_ads',
  'tiktok',
] as const;

export const LEAD_GENDERS = ['kisi', 'qadin', 'diger'] as const;

export const DEMO_STATUSES = ['teyin_edilmedi', 'teyin_olundu', 'verildi', 'imtina'] as const;

export const PAYMENT_STATUSES = [
  'gozleyir',
  'depozit_odedi',
  'qismen_odenib',
  'odenib',
  'gecikib',
  'legv_edilib',
] as const;
export type LeadPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  'nagd',
  'kart',
  'bank_kocurmesi',
  'birkart',
  'tamkart',
  'bolkart',
  'hisseli',
] as const;

export const PAYMENT_PLANS = ['aylik', 'tam'] as const;

export const WON_STATUSES: LeadStatus[] = ['qeydiyyat_oldu', 'satis_baglandi'];
export const LOST_STATUSES: LeadStatus[] = ['imtina'];

// Pipeline: 7 columns, each grouping several statuses. `primary` is the status a
// card takes when dropped into the column.
export const PIPELINE_COLUMNS: { key: string; label: string; primary: LeadStatus; statuses: LeadStatus[] }[] = [
  { key: 'yeni', label: 'Yeni Lead', primary: 'yeni_lead', statuses: ['yeni_lead'] },
  { key: 'elaqe', label: 'Əlaqə quruldu', primary: 'ilk_yazisma', statuses: ['ilk_yazisma', 'zeng_edildi'] },
  { key: 'demo', label: 'Demo', primary: 'demo_gozleyir', statuses: ['demo_gozleyir', 'demo_verildi'] },
  {
    key: 'followup',
    label: 'Follow-up',
    primary: 'follow_up',
    statuses: ['follow_up', 'qerarsiz', 'qiymet_problemi', 'hot_lead'],
  },
  { key: 'odenis', label: 'Ödəniş gözləyir', primary: 'odenis_gozleyir', statuses: ['odenis_gozleyir'] },
  {
    key: 'qeydiyyat',
    label: 'Qeydiyyat oldu',
    primary: 'qeydiyyat_oldu',
    statuses: ['qeydiyyat_oldu', 'satis_baglandi'],
  },
  { key: 'itirilmis', label: 'İtirilmiş lead', primary: 'imtina', statuses: ['imtina', 'gelecek_potensial'] },
];

// ===== Scoring =====
export const SCORE_WEIGHTS = {
  askedDemo: 25,
  askedPrice: 20,
  callAnswered: 15,
  parentInvolved: 20,
  budgetOk: 20,
  notResponding: -15,
  passive7d: -20,
} as const;

export type ScoreFlags = Record<keyof typeof SCORE_WEIGHTS, boolean>;

export function computeScore(flags: Partial<ScoreFlags>): number {
  let s = 0;
  for (const [k, w] of Object.entries(SCORE_WEIGHTS)) {
    if (flags[k as keyof ScoreFlags]) s += w;
  }
  return Math.max(0, Math.min(100, s));
}

export function computePriority(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

/** Which stage bucket a status maps to, so legacy stageId stays meaningful for reports. */
export function stageBucketForStatus(status: string): 'won' | 'lost' | 'open' {
  if (WON_STATUSES.includes(status as LeadStatus)) return 'won';
  if (LOST_STATUSES.includes(status as LeadStatus)) return 'lost';
  return 'open';
}
