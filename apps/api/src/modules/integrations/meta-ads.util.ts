import { PrismaService } from '../../core/prisma/prisma.service';
import { decryptSecret } from '../../core/crypto/crypto.util';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/** Ad account ids are passed around bare; the Graph API wants the `act_` prefix. */
function actId(adAccountId: string): string {
  const id = adAccountId.trim();
  return id.startsWith('act_') ? id : `act_${id}`;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Meta returns money as a decimal string in the account currency; we store qəpik/cents. */
function toMinorUnits(spend: unknown): number {
  const n = Number.parseFloat(String(spend ?? '0'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

async function graph(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${GRAPH_BASE}/${path}?${new URLSearchParams(params)}`);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'Meta Ads sorğusu uğursuz oldu');
  }
  return json;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  /** 1 = active; anything else means delivery is stopped. */
  accountStatus: number;
}

/** Verifies an ads token by reading the account itself — cheap and needs only `ads_read`. */
export async function fetchMetaAdAccount(
  adAccountId: string,
  accessToken: string,
): Promise<MetaAdAccount> {
  const json = await graph(actId(adAccountId), {
    fields: 'id,name,currency,account_status',
    access_token: accessToken,
  });
  return {
    id: json.id,
    name: json.name,
    currency: json.currency,
    accountStatus: json.account_status,
  };
}

export interface MetaAdsSpend {
  /** Total across every placement, in minor units of the account currency. */
  total: number;
  /** The Instagram slice only — what the marketing page highlights. */
  instagram: number;
  facebook: number;
  other: number;
  impressions: number;
  clicks: number;
  byCampaign: { name: string; spend: number }[];
}

/**
 * Spend for a date range, split by placement. `publisher_platform` is the
 * breakdown that separates Instagram from Facebook/Audience Network — without it
 * a single blended number comes back and "Instagram ad spend" is unanswerable.
 */
export async function fetchMetaAdsSpend(
  adAccountId: string,
  accessToken: string,
  since: Date,
  until: Date,
): Promise<MetaAdsSpend> {
  // Meta Ads Insights rejects a start date more than 37 months back; an
  // "all time" query would otherwise error. Clamp to the earliest it accepts.
  const floor = new Date();
  floor.setMonth(floor.getMonth() - 37);
  const from = since < floor ? floor : since;
  const timeRange = JSON.stringify({ since: ymd(from), until: ymd(until) });
  const account = actId(adAccountId);

  const [byPlatform, byCampaign] = await Promise.all([
    graph(`${account}/insights`, {
      fields: 'spend,impressions,clicks',
      breakdowns: 'publisher_platform',
      level: 'account',
      time_range: timeRange,
      access_token: accessToken,
    }),
    // A campaign with no delivery in the window is simply absent from the response.
    graph(`${account}/insights`, {
      fields: 'campaign_name,spend',
      level: 'campaign',
      time_range: timeRange,
      limit: '100',
      access_token: accessToken,
    }).catch(() => ({ data: [] })),
  ]);

  const rows = (byPlatform.data ?? []) as any[];
  const sumWhere = (pred: (p: string) => boolean) =>
    rows.filter((r) => pred(r.publisher_platform ?? '')).reduce((s, r) => s + toMinorUnits(r.spend), 0);

  return {
    total: rows.reduce((s, r) => s + toMinorUnits(r.spend), 0),
    instagram: sumWhere((p) => p === 'instagram'),
    facebook: sumWhere((p) => p === 'facebook'),
    other: sumWhere((p) => p !== 'instagram' && p !== 'facebook'),
    impressions: rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
    clicks: rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
    byCampaign: ((byCampaign.data ?? []) as any[])
      .map((r) => ({ name: r.campaign_name as string, spend: toMinorUnits(r.spend) }))
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend),
  };
}

export async function getMetaAdsCredentials(
  prisma: PrismaService,
): Promise<{ adAccountId: string; token: string; currency?: string } | null> {
  const conn = await prisma.scoped.tenantIntegration.findFirst({
    where: { catalogKey: 'meta_ads' },
  });
  if (!conn?.credentialsEnc) return null;
  const config = (conn.config ?? {}) as { adAccountId?: string; account?: { currency?: string } };
  if (!config.adAccountId) return null;
  return {
    adAccountId: config.adAccountId,
    token: decryptSecret(conn.credentialsEnc),
    currency: config.account?.currency,
  };
}
