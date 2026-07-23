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

/**
 * Exchanges a short-lived user token for a long-lived one (~60 days). Needs the
 * Facebook app id + secret in the environment; without them we can't call the
 * exchange endpoint, so the original token is returned unchanged (callers should
 * then rely on a non-expiring System User token instead).
 */
export async function extendToLongLivedToken(shortToken: string): Promise<string> {
  const appId = process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return shortToken;
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const json: any = await res.json().catch(() => ({}));
  // Best-effort: a failed exchange must not block connecting with the token we have.
  return typeof json?.access_token === 'string' ? json.access_token : shortToken;
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
  /** Unique accounts reached (not additive across placements, read at account level). */
  reach: number;
  /** Avg times each account saw an ad = impressions / reach. */
  frequency: number;
  /** All money fields are minor units (qəpik/cents) so the client formats them uniformly. */
  cpm: number; // cost per 1000 impressions
  cpc: number; // cost per click
  ctr: number; // click-through rate, percent
  instagram_impressions: number;
  instagram_clicks: number;
  instagram_cpm: number;
  instagram_cpc: number;
  instagram_ctr: number;
  byCampaign: { name: string; spend: number }[];
}

/** CPM/CPC/CTR from raw counts. Spend is already minor units, so results are too. */
function derive(spendMinor: number, impressions: number, clicks: number) {
  return {
    cpm: impressions > 0 ? Math.round((spendMinor / impressions) * 1000) : 0,
    cpc: clicks > 0 ? Math.round(spendMinor / clicks) : 0,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
  };
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

  const [byPlatform, account_totals, byCampaign] = await Promise.all([
    graph(`${account}/insights`, {
      fields: 'spend,impressions,clicks',
      breakdowns: 'publisher_platform',
      level: 'account',
      time_range: timeRange,
      access_token: accessToken,
    }),
    // Reach is unique-per-account, so it can't be summed from the placement rows —
    // it must be read once at the account level for the same window.
    graph(`${account}/insights`, {
      fields: 'reach',
      level: 'account',
      time_range: timeRange,
      access_token: accessToken,
    }).catch(() => ({ data: [] })),
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
  const igRows = rows.filter((r) => (r.publisher_platform ?? '') === 'instagram');
  const spendWhere = (pred: (p: string) => boolean) =>
    rows.filter((r) => pred(r.publisher_platform ?? '')).reduce((s, r) => s + toMinorUnits(r.spend), 0);
  const countWhere = (rs: any[], field: string) => rs.reduce((s, r) => s + Number(r[field] ?? 0), 0);

  const total = rows.reduce((s, r) => s + toMinorUnits(r.spend), 0);
  const impressions = countWhere(rows, 'impressions');
  const clicks = countWhere(rows, 'clicks');
  const reach = Number((account_totals.data?.[0]?.reach as string) ?? 0);
  const overall = derive(total, impressions, clicks);

  const igSpend = spendWhere((p) => p === 'instagram');
  const igImpr = countWhere(igRows, 'impressions');
  const igClicks = countWhere(igRows, 'clicks');
  const ig = derive(igSpend, igImpr, igClicks);

  return {
    total,
    instagram: igSpend,
    facebook: spendWhere((p) => p === 'facebook'),
    other: spendWhere((p) => p !== 'instagram' && p !== 'facebook'),
    impressions,
    clicks,
    reach,
    frequency: reach > 0 ? Math.round((impressions / reach) * 100) / 100 : 0,
    cpm: overall.cpm,
    cpc: overall.cpc,
    ctr: overall.ctr,
    instagram_impressions: igImpr,
    instagram_clicks: igClicks,
    instagram_cpm: ig.cpm,
    instagram_cpc: ig.cpc,
    instagram_ctr: ig.ctr,
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
