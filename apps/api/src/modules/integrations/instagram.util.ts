import { PrismaService } from '../../core/prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../../core/crypto/crypto.util';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
// Conversations/messages require an "Instagram Login" token and are only
// reachable through this host — the Facebook Graph API token used for
// profile/media/insights does not work here (returns "(#3) capability" errors).
const IG_LOGIN_BASE = 'https://graph.instagram.com/v21.0';

export interface InstagramProfile {
  username: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramInsights {
  reach: number;
  profileViews: number;
  accountsEngaged: number;
  interactions: number;
}

/** Verifies an Instagram Graph API token by fetching the connected business account's public profile. */
export async function fetchInstagramProfile(
  igUserId: string,
  accessToken: string,
): Promise<InstagramProfile> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(igUserId)}?fields=username,followers_count,media_count,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'Instagram API sorğusu uğursuz oldu');
  }
  return json as InstagramProfile;
}

/** Fetches the most recent media items for the connected Instagram business account. */
export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
): Promise<InstagramMedia[]> {
  const fields =
    'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
  const url = `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media?fields=${fields}&limit=24&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'Instagram media sorğusu uğursuz oldu');
  }
  return (json.data ?? []) as InstagramMedia[];
}

/**
 * 7-day account insights. Requires `instagram_manage_insights` scope — many
 * basic tokens won't have it, so callers should treat a null return as "unavailable"
 * rather than an error.
 *
 * `metric_type=total_value` is mandatory since v22: without it Graph rejects the
 * whole request with "(#100) ... should be specified with parameter metric_type",
 * which is why the per-day `values` shape is gone and totals arrive pre-summed.
 */
export async function fetchInstagramInsights(
  igUserId: string,
  accessToken: string,
): Promise<InstagramInsights | null> {
  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    metric: 'reach,profile_views,accounts_engaged,total_interactions',
    period: 'day',
    metric_type: 'total_value',
    since: String(Math.floor(since.getTime() / 1000)),
    until: String(Math.floor(until.getTime() / 1000)),
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(igUserId)}/insights?${params}`);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error || !Array.isArray(json?.data)) return null;
  const total = (metric: string) =>
    json.data.find((m: any) => m.name === metric)?.total_value?.value ?? 0;
  return {
    reach: total('reach'),
    profileViews: total('profile_views'),
    accountsEngaged: total('accounts_engaged'),
    interactions: total('total_interactions'),
  };
}

export interface InstagramConversationMessage {
  id: string;
  from: { username?: string; id: string };
  message?: string;
  created_time: string;
}

export interface InstagramConversation {
  id: string;
  participantUsername?: string;
  participantId?: string;
  messages: InstagramConversationMessage[];
}

/**
 * Fetches recent DM conversations (with messages) for the connected Instagram
 * business account. Requires `instagram_manage_messages` — Development Mode
 * apps only see conversations for the connected account's own inbox, which is
 * exactly what we need here (no App Review required).
 */
export async function fetchInstagramConversations(
  igUserId: string,
  dmAccessToken: string,
): Promise<InstagramConversation[]> {
  const url = `${IG_LOGIN_BASE}/${encodeURIComponent(igUserId)}/conversations?platform=instagram&fields=participants,messages.limit(100){id,from,message,created_time}&limit=50&access_token=${encodeURIComponent(dmAccessToken)}`;
  const res = await fetch(url);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'Instagram DM sorğusu uğursuz oldu');
  }
  return ((json.data ?? []) as any[]).map((c) => {
    const other = (c.participants?.data ?? []).find((p: any) => p.id !== igUserId);
    return {
      id: c.id,
      participantUsername: other?.username,
      participantId: other?.id,
      messages: (c.messages?.data ?? []) as InstagramConversationMessage[],
    };
  });
}

/** Extracts the first plausible phone number (9-13 digits) from free text, or null. */
export function extractPhoneNumber(text: string): string | null {
  const matches = text.match(/(\+?\d[\d\s\-()]{7,14}\d)/g);
  if (!matches) return null;
  for (const m of matches) {
    const digits = m.replace(/[^\d+]/g, '');
    const bare = digits.replace(/^\+/, '');
    if (bare.length >= 9 && bare.length <= 13) return digits;
  }
  return null;
}

/** First e-mail address in the text, or null. */
export function extractEmail(text: string): string | null {
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

/**
 * Az/Ru/En keyword sets for reading buying intent out of a DM. Matched against a
 * fold-cased, diacritic-stripped copy of the text so "İSTƏYİRƏM", "isteyirem" and
 * "istəyirəm" all hit. Deliberately broad — a false positive just means an extra
 * lead card to glance at, a false negative means a real prospect slips away.
 */
const ENROLL_KEYWORDS = [
  'yazilmaq', 'yazila bil', 'yazilmak', 'qeydiyyat', 'qeyd olmaq', 'qosulmaq',
  'qosula bil', 'qebul', 'muraciet', 'istirak', 'baslamaq iste', 'ders almaq',
  'oxumaq iste', 'kursa yazil', 'kursa gel', 'nece yazil', 'nece qosul',
  'nece qeydiyyat', 'ne etmeli', 'nece basla',
  'enroll', 'sign up', 'signup', 'register', 'join the', 'how do i join',
  'how to join', 'apply',
  // Russian (Cyrillic — folding leaves these untouched)
  'записаться', 'запис', 'поступить', 'хочу учиться', 'как записаться',
];
const PRICE_KEYWORDS = [
  'qiymet', 'neceye', 'necedir', 'ne qeder', 'nə qədər', 'odenis', 'odenilir',
  'aylig ne', 'ayliq ne', 'endirim', 'guzest', 'manat', 'azn', 'tarif',
  'price', 'cost', 'how much', 'fee', 'payment',
  // Russian
  'сколько', 'цена', 'стоит', 'стоимость', 'оплата',
];
const COURSE_KEYWORDS = [
  'kurs', 'kursu', 'kursa', 'kurslar', 'telim', 'təlim', 'ders', 'dərs',
  'course', 'training', 'kurs haqq', 'melumat', 'məlumat', 'info', 'detal',
];

/** Diacritic-folded, lower-cased text so keyword matching is accent-insensitive. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ö/g, 'o').replace(/ü/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface MessageSignals {
  phone: string | null;
  email: string | null;
  wantsEnroll: boolean;
  asksPrice: boolean;
  mentionsCourse: boolean;
}

/** Reads every buying-intent signal we can out of one message. */
export function analyzeMessage(text: string): MessageSignals {
  const folded = fold(text);
  const has = (kws: string[]) => kws.some((k) => folded.includes(fold(k)));
  return {
    phone: extractPhoneNumber(text),
    email: extractEmail(text),
    wantsEnroll: has(ENROLL_KEYWORDS),
    asksPrice: has(PRICE_KEYWORDS),
    mentionsCourse: has(COURSE_KEYWORDS),
  };
}

export interface InstagramComment {
  id: string;
  text: string;
  username?: string;
  userId?: string;
  timestamp?: string;
}

/** Recent comments on one media item. Requires `instagram_manage_comments`. */
export async function fetchMediaComments(
  mediaId: string,
  accessToken: string,
): Promise<InstagramComment[]> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(mediaId)}/comments?fields=id,text,username,timestamp,from&limit=50&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'Instagram şərh sorğusu uğursuz oldu');
  }
  return ((json.data ?? []) as any[]).map((c) => ({
    id: c.id,
    text: c.text ?? '',
    username: c.username ?? c.from?.username,
    userId: c.from?.id,
    timestamp: c.timestamp,
  }));
}

/**
 * Posts a public reply under a comment. Uses the Facebook Graph token (the same
 * one that reads media/insights) with `instagram_manage_comments`.
 */
export async function replyToComment(
  commentId: string,
  accessToken: string,
  message: string,
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(commentId)}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, access_token: accessToken }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'Şərhə cavab göndərilə bilmədi');
  }
}

/**
 * Sends a private reply (DM) to the author of a comment. This is the sanctioned
 * comment→DM path and works within 7 days of the comment; it needs the Instagram
 * Login token (`instagram_manage_messages`) and goes through graph.instagram.com.
 */
export async function sendCommentPrivateReply(
  igUserId: string,
  dmAccessToken: string,
  commentId: string,
  message: string,
): Promise<void> {
  const res = await fetch(`${IG_LOGIN_BASE}/${encodeURIComponent(igUserId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
      access_token: dmAccessToken,
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? 'DM göndərilə bilmədi');
  }
}

/** Looks up the tenant's connected Instagram credentials, or null if not connected. */
export async function getInstagramCredentials(
  prisma: PrismaService,
): Promise<{ igUserId: string; token: string } | null> {
  const conn = await prisma.scoped.tenantIntegration.findFirst({ where: { catalogKey: 'instagram' } });
  if (!conn || !conn.credentialsEnc) return null;
  const config = (conn.config ?? {}) as { igUserId?: string };
  if (!config.igUserId) return null;
  return { igUserId: config.igUserId, token: decryptSecret(conn.credentialsEnc) };
}

/**
 * The Instagram Login token (used for /conversations) is stored separately from
 * the main Facebook Graph API token, encrypted inside `config.dmTokenEnc` since
 * TenantIntegration only has one `credentialsEnc` column.
 */
export async function saveInstagramDmToken(prisma: PrismaService, dmToken: string): Promise<void> {
  const conn = await prisma.scoped.tenantIntegration.findFirst({ where: { catalogKey: 'instagram' } });
  if (!conn) throw new Error('Instagram inteqrasiyası qoşulmayıb');
  const config = { ...(conn.config as object), dmTokenEnc: encryptSecret(dmToken) };
  await prisma.scoped.tenantIntegration.update({ where: { id: conn.id }, data: { config } });
}

export async function getInstagramDmCredentials(
  prisma: PrismaService,
): Promise<{ igUserId: string; dmToken: string } | null> {
  const conn = await prisma.scoped.tenantIntegration.findFirst({ where: { catalogKey: 'instagram' } });
  if (!conn) return null;
  const config = (conn.config ?? {}) as { igUserId?: string; dmTokenEnc?: string };
  if (!config.igUserId || !config.dmTokenEnc) return null;
  return { igUserId: config.igUserId, dmToken: decryptSecret(config.dmTokenEnc) };
}
