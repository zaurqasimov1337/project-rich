import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SalesService } from '../crm/sales.service';
import type { CreateSalesLeadDto } from '../crm/dto/sales.dto';
import { extractPhoneNumber } from './instagram.util';

/**
 * Public receiver for Meta's Instagram Messaging webhooks. Unauthenticated by
 * design (Meta calls it directly, not through our JWT) — the verify token is
 * the only guard, matching Meta's documented handshake.
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
  async receive(@Body() body: { entry?: any[] }) {
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
