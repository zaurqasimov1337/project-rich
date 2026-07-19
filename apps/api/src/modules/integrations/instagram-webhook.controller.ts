import { Controller, Get, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SalesService } from '../crm/sales.service';
import type { CreateSalesLeadDto } from '../crm/dto/sales.dto';
import { extractPhoneNumber } from './instagram.util';

/**
 * Public receiver for Meta's Instagram Messaging webhooks. Unauthenticated by
 * design (Meta calls it directly, not through our JWT). Two guards replace JWT:
 *  - GET handshake is gated by the verify token.
 *  - POST payloads are authenticated by the X-Hub-Signature-256 HMAC, so nobody
 *    who merely discovers the URL can inject fake leads.
 */
@ApiExcludeController()
@Controller('webhooks/instagram')
export class InstagramWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
  ) {}

  @Public()
  @Get()
  verify(@Query() query: Record<string, string>, @Res() res: Response) {
    const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    if (expected && query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === expected) {
      res.status(200).send(query['hub.challenge']);
      return;
    }
    res.status(403).send('Forbidden');
  }

  @Public()
  @Post()
  async receive(@Req() req: RawBodyRequest<Request>) {
    this.assertValidSignature(req);
    const body = req.body as { entry?: any[] };
    for (const entry of body?.entry ?? []) {
      const igUserId: string | undefined = entry.id;
      if (!igUserId) continue;
      for (const messaging of entry.messaging ?? []) {
        const senderId: string | undefined = messaging.sender?.id;
        const text: string | undefined = messaging.message?.text;
        if (!text || !senderId || senderId === igUserId) continue;
        const phone = extractPhoneNumber(text);
        if (!phone) continue;
        await this.createLeadForPhone(igUserId, senderId, phone, text);
      }
    }
    return { received: true };
  }

  /**
   * Verifies Meta's HMAC-SHA256 signature over the raw request body. Rejects the
   * request if the app secret isn't configured, so an unsigned deployment can
   * never silently accept forged payloads.
   */
  private assertValidSignature(req: RawBodyRequest<Request>): void {
    const secret = process.env.INSTAGRAM_APP_SECRET;
    if (!secret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Webhook signature verification is not configured',
      });
    }
    const header = req.headers['x-hub-signature-256'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided?.startsWith('sha256=') || !req.rawBody) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing signature' });
    }
    const expected = 'sha256=' + createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid signature' });
    }
  }

  /** Looks up which tenant owns this Instagram business account and creates the lead there. */
  private async createLeadForPhone(igUserId: string, senderId: string, phone: string, message: string) {
    const conns = await this.prisma.tenantIntegration.findMany({ where: { catalogKey: 'instagram' } });
    const conn = conns.find((c) => (c.config as { igUserId?: string })?.igUserId === igUserId);
    if (!conn) return;

    await this.prisma.forTenant(conn.tenantId, async () => {
      const existing = await this.prisma.scoped.lead.findFirst({ where: { deletedAt: null, phone } });
      if (existing) return;
      const leadDto: CreateSalesLeadDto = {
        fullName: `Instagram istifadəçisi ${senderId}`,
        phone,
        source: 'instagram_dm',
        notes: `Instagram DM (real-time): "${message}"`,
      };
      await this.sales.createLead(leadDto, conn.connectedById ?? senderId);
    });
  }
}
