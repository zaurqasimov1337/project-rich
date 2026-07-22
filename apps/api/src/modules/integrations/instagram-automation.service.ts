import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { decryptSecret } from '../../core/crypto/crypto.util';
import {
  fetchMediaComments,
  fetchInstagramMedia,
  replyToComment,
  sendCommentPrivateReply,
  type InstagramComment,
} from './instagram.util';

interface AutomationRule {
  id: string;
  mediaId: string | null;
  keywords: string[];
  publicReply: string | null;
  dmMessage: string | null;
  enabled: boolean;
}

/** The account tokens a tenant has stored, resolved once per run. */
interface TenantIgTokens {
  igUserId: string;
  /** Facebook Graph token — reads comments, posts public replies. */
  graphToken: string | null;
  /** Instagram Login token — sends the comment→DM private reply. */
  dmToken: string | null;
}

/**
 * Runs the comment-automation rules: for a given comment, find the best matching
 * enabled rule, and (once only) post the public reply and/or DM the author.
 *
 * Two entry points share the same core: the webhook (real-time, one comment) and
 * the manual "process recent comments" poll (catch-up, many comments). Both must
 * be safe to call repeatedly — the unique (tenantId, commentId) row is the guard.
 */
@Injectable()
export class InstagramAutomationService {
  private readonly logger = new Logger(InstagramAutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Diacritic-folded, lower-cased so keyword matching is accent-insensitive. */
  private fold(text: string): string {
    return text
      .toLowerCase()
      .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/İ/g, 'i')
      .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c')
      .replace(/ö/g, 'o').replace(/ü/g, 'u');
  }

  /**
   * Picks the rule that should fire for a comment. Post-specific rules win over
   * global ones; a keyword rule wins over an "any comment" rule. Within a tier,
   * the first enabled rule (most recently updated first, per the caller's order).
   */
  private pickRule(rules: AutomationRule[], mediaId: string | undefined, text: string): AutomationRule | null {
    const folded = this.fold(text);
    const matches = (r: AutomationRule) =>
      r.enabled &&
      (r.mediaId === null || r.mediaId === mediaId) &&
      (r.keywords.length === 0 || r.keywords.some((k) => folded.includes(this.fold(k))));

    const candidates = rules.filter(matches);
    if (candidates.length === 0) return null;
    // Specificity score: targeted post (+2) and non-empty keywords (+1).
    const score = (r: AutomationRule) => (r.mediaId ? 2 : 0) + (r.keywords.length ? 1 : 0);
    return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  /**
   * Processes one comment inside the given tenant's scope. Returns what happened
   * so the caller (manual poll) can summarise. Idempotent per commentId.
   */
  private async processComment(
    tenantId: string,
    tokens: TenantIgTokens,
    rules: AutomationRule[],
    comment: InstagramComment,
    mediaId: string | undefined,
  ): Promise<'replied' | 'skipped' | 'no_rule' | 'error'> {
    const rule = this.pickRule(rules, mediaId, comment.text);
    if (!rule) return 'no_rule';

    // Idempotency: claim the comment first. A duplicate insert (unique key) means
    // another run already handled it, so we bail before sending anything twice.
    try {
      await this.prisma.scoped.instagramCommentEvent.create({
        data: {
          tenantId,
          commentId: comment.id,
          mediaId: mediaId ?? null,
          automationId: rule.id,
          fromUsername: comment.username ?? null,
          text: comment.text.slice(0, 500),
        },
      });
    } catch {
      return 'skipped';
    }

    let repliedPublic = false;
    let sentDm = false;
    let error: string | null = null;

    if (rule.publicReply && tokens.graphToken) {
      try {
        await replyToComment(comment.id, tokens.graphToken, rule.publicReply);
        repliedPublic = true;
      } catch (e) {
        error = `public: ${e instanceof Error ? e.message : 'xəta'}`;
      }
    }
    if (rule.dmMessage && tokens.dmToken) {
      try {
        await sendCommentPrivateReply(tokens.igUserId, tokens.dmToken, comment.id, rule.dmMessage);
        sentDm = true;
      } catch (e) {
        error = [error, `dm: ${e instanceof Error ? e.message : 'xəta'}`].filter(Boolean).join('; ');
      }
    }

    await this.prisma.scoped.instagramCommentEvent.updateMany({
      where: { commentId: comment.id },
      data: { repliedPublic, sentDm, error },
    });
    if (repliedPublic || sentDm) {
      await this.prisma.scoped.instagramAutomation.update({
        where: { id: rule.id },
        data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() },
      });
    }
    return error && !repliedPublic && !sentDm ? 'error' : 'replied';
  }

  /** Resolves the stored Instagram tokens for a tenant. */
  private async tokensFor(tenantId: string): Promise<TenantIgTokens | null> {
    const conn = await this.prisma.forTenant(tenantId, (db) =>
      db.tenantIntegration.findFirst({ where: { catalogKey: 'instagram' } }),
    );
    const config = (conn?.config ?? {}) as { igUserId?: string; dmTokenEnc?: string };
    if (!conn || !config.igUserId) return null;
    return {
      igUserId: config.igUserId,
      graphToken: conn.credentialsEnc ? decryptSecret(conn.credentialsEnc) : null,
      dmToken: config.dmTokenEnc ? decryptSecret(config.dmTokenEnc) : null,
    };
  }

  private async rulesFor(tenantId: string): Promise<AutomationRule[]> {
    const rows = await this.prisma.forTenant(tenantId, (db) =>
      db.instagramAutomation.findMany({ where: { enabled: true }, orderBy: { updatedAt: 'desc' } }),
    );
    return rows.map((r) => ({
      id: r.id,
      mediaId: r.mediaId,
      keywords: r.keywords,
      publicReply: r.publicReply,
      dmMessage: r.dmMessage,
      enabled: r.enabled,
    }));
  }

  /**
   * Real-time entry point, called from the webhook. Resolves the tenant that owns
   * this Instagram account and processes a single comment in its scope.
   */
  async handleWebhookComment(
    igUserId: string,
    comment: InstagramComment,
    mediaId: string | undefined,
  ): Promise<void> {
    const conns = await this.prisma.tenantIntegration.findMany({ where: { catalogKey: 'instagram' } });
    const conn = conns.find((c) => (c.config as { igUserId?: string })?.igUserId === igUserId);
    if (!conn) return;

    await this.prisma.forTenant(conn.tenantId, async () => {
      const tokens = await this.tokensFor(conn.tenantId);
      if (!tokens) return;
      const rules = await this.rulesFor(conn.tenantId);
      if (rules.length === 0) return;
      await this.processComment(conn.tenantId, tokens, rules, comment, mediaId).catch((e) =>
        this.logger.warn(`comment automation failed: ${e instanceof Error ? e.message : e}`),
      );
    });
  }

  /**
   * Manual catch-up: polls recent media, reads their comments, and runs the rules.
   * Used when real-time webhooks aren't set up yet, or to backfill. Returns a
   * summary of what fired.
   */
  async processRecentComments(
    tenantId: string,
  ): Promise<{ scanned: number; acted: number; skipped: number; errors: number }> {
    const tokens = await this.tokensFor(tenantId);
    if (!tokens || !tokens.graphToken) {
      throw new Error('Instagram inteqrasiyası qoşulmayıb və ya token yoxdur');
    }
    const rules = await this.rulesFor(tenantId);
    if (rules.length === 0) {
      return { scanned: 0, acted: 0, skipped: 0, errors: 0 };
    }

    // Only pull comments for posts a rule could match: the specific ones named by
    // post-scoped rules, plus every recent post if any global rule exists.
    const hasGlobal = rules.some((r) => r.mediaId === null);
    const targeted = new Set(rules.map((r) => r.mediaId).filter((id): id is string => !!id));
    let mediaIds: string[];
    if (hasGlobal) {
      const media = await fetchInstagramMedia(tokens.igUserId, tokens.graphToken);
      mediaIds = [...new Set([...media.map((m) => m.id), ...targeted])];
    } else {
      mediaIds = [...targeted];
    }

    let scanned = 0;
    let acted = 0;
    let skipped = 0;
    let errors = 0;
    for (const mediaId of mediaIds) {
      let comments: InstagramComment[];
      try {
        comments = await fetchMediaComments(mediaId, tokens.graphToken);
      } catch (e) {
        this.logger.warn(`comments fetch failed for ${mediaId}: ${e instanceof Error ? e.message : e}`);
        continue;
      }
      for (const comment of comments) {
        if (!comment.text) continue;
        // Never reply to our own comments/replies.
        if (comment.userId && comment.userId === tokens.igUserId) continue;
        scanned++;
        const outcome = await this.processComment(tenantId, tokens, rules, comment, mediaId);
        if (outcome === 'replied') acted++;
        else if (outcome === 'skipped' || outcome === 'no_rule') skipped++;
        else if (outcome === 'error') errors++;
      }
    }
    return { scanned, acted, skipped, errors };
  }
}
