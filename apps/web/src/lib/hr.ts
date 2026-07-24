/** HR domain constants shared between the employees list, profile and dashboard pages. */

export type HrTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'accent' | 'primary';

export const HR_STATUS_LABELS: Record<string, { label: string; tone: HrTone }> = {
  aktiv: { label: 'Aktiv', tone: 'success' },
  sinaq: { label: 'Sınaq müddəti', tone: 'warning' },
  mezuniyyetde: { label: 'Məzuniyyətdə', tone: 'info' },
  xestelik: { label: 'Xəstəlik', tone: 'danger' },
  ezamiyyetde: { label: 'Ezamiyyətdə', tone: 'accent' },
  cixib: { label: 'Çıxıb', tone: 'neutral' },
};

export const WORK_TYPE_LABELS: Record<string, string> = {
  tam_stat: 'Tam ştat',
  yarim_stat: 'Yarım ştat',
  saatliq: 'Saatlıq',
  muqavileli: 'Müqaviləli',
  freelancer: 'Freelancer',
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  emek: 'Əmək müqaviləsi',
  nda: 'NDA',
  daxili_qaydalar: 'Daxili qaydalar',
  remote: 'Remote Policy',
  diger: 'Digər',
};

export const CONTRACT_STATUS_LABELS: Record<string, { label: string; tone: HrTone }> = {
  aktiv: { label: 'Aktiv', tone: 'success' },
  imzalanib: { label: 'İmzalanıb', tone: 'info' },
  bitib: { label: 'Bitib', tone: 'neutral' },
  legv: { label: 'Ləğv', tone: 'danger' },
};

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  subay: 'Subay',
  evli: 'Evli',
  bosanmis: 'Boşanmış',
  dul: 'Dul',
};

export const SECTOR_LABELS: Record<string, string> = {
  private_nonoil: 'Özəl qeyri-neft',
  state_oil: 'Dövlət və neft-qaz',
};

export const ASSET_CATEGORY_LABELS: Record<string, { label: string; tone: HrTone }> = {
  texnika: { label: 'Texnika', tone: 'info' },
  kart: { label: 'Kart', tone: 'accent' },
  acar: { label: 'Açar', tone: 'warning' },
  sim: { label: 'SIM', tone: 'primary' },
  diger: { label: 'Digər', tone: 'neutral' },
};

export const DOCUMENT_TYPE_LABELS: Record<string, { label: string; tone: HrTone }> = {
  sexsiyyet: { label: 'Şəxsiyyət', tone: 'info' },
  cv: { label: 'CV', tone: 'accent' },
  diplom: { label: 'Diplom', tone: 'primary' },
  sertifikat: { label: 'Sertifikat', tone: 'success' },
  muqavile: { label: 'Müqavilə', tone: 'warning' },
  siyaset: { label: 'Siyasət', tone: 'neutral' },
  diger: { label: 'Digər', tone: 'neutral' },
};

export const DOCUMENT_STATUS_LABELS: Record<string, { label: string; tone: HrTone }> = {
  yuklenib: { label: 'Yüklənib', tone: 'info' },
  imzalanib: { label: 'İmzalanıb', tone: 'primary' },
  qebul_edilib: { label: 'Qəbul edilib', tone: 'success' },
  bitib: { label: 'Bitib', tone: 'neutral' },
};

export const REVIEW_TYPE_LABELS: Record<string, { label: string; tone: HrTone }> = {
  kpi: { label: 'KPI', tone: 'info' },
  okr: { label: 'OKR', tone: 'accent' },
  manager: { label: 'Rəhbər rəyi', tone: 'primary' },
  p360: { label: '360°', tone: 'success' },
};

export const GOAL_STATUS_LABELS: Record<string, { label: string; tone: HrTone }> = {
  davam_edir: { label: 'Davam edir', tone: 'info' },
  catdi: { label: 'Çatdı', tone: 'success' },
  catmadi: { label: 'Çatmadı', tone: 'danger' },
};
