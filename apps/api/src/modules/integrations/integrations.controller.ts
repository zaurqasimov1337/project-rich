import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { INTEGRATION_CATEGORIES } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { encryptSecret } from '../../core/crypto/crypto.util';
import { SalesService } from '../crm/sales.service';
import type { CreateSalesLeadDto } from '../crm/dto/sales.dto';
import {
  analyzeMessage,
  fetchInstagramConversations,
  fetchInstagramInsights,
  fetchInstagramMedia,
  fetchInstagramProfile,
  getInstagramCredentials,
  getInstagramDmCredentials,
  saveInstagramDmToken,
} from './instagram.util';
import { fetchMetaAdAccount } from './meta-ads.util';

class ConnectDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Secret credential (API key / token) — stored AES-256-GCM encrypted. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  secret?: string;
}

class DmTokenDto {
  @IsString()
  @MaxLength(2000)
  token!: string;
}

/** Built-in provider catalog surfaced to every tenant. */
const CATALOG = [
  { key: 'openai', category: 'ai', name: 'OpenAI', comingSoon: false },
  { key: 'anthropic', category: 'ai', name: 'Claude (Anthropic)', comingSoon: false },
  { key: 'gemini', category: 'ai', name: 'Google Gemini', comingSoon: true },
  { key: 'deepseek', category: 'ai', name: 'DeepSeek', comingSoon: true },
  { key: 'facebook', category: 'social', name: 'Facebook', comingSoon: true },
  { key: 'instagram', category: 'social', name: 'Instagram', comingSoon: false },
  { key: 'tiktok', category: 'social', name: 'TikTok', comingSoon: true },
  { key: 'meta_ads', category: 'ads', name: 'Meta Ads', comingSoon: false },
  { key: 'google_ads', category: 'ads', name: 'Google Ads', comingSoon: true },
  { key: 'stripe', category: 'payment', name: 'Stripe', comingSoon: true },
  { key: 'paypal', category: 'payment', name: 'PayPal', comingSoon: true },
  { key: 'google_calendar', category: 'calendar', name: 'Google Calendar', comingSoon: false },
  { key: 'outlook', category: 'calendar', name: 'Outlook Calendar', comingSoon: true },
  { key: 'zoom', category: 'meeting', name: 'Zoom', comingSoon: true },
  { key: 'google_meet', category: 'meeting', name: 'Google Meet', comingSoon: true },
  { key: 'google_drive', category: 'storage', name: 'Google Drive', comingSoon: true },
  { key: 'telegram', category: 'communication', name: 'Telegram', comingSoon: true },
  { key: 'whatsapp', category: 'communication', name: 'WhatsApp', comingSoon: true },
  { key: 'slack', category: 'communication', name: 'Slack', comingSoon: true },
  { key: 'smtp', category: 'communication', name: 'SMTP e-poçt', comingSoon: false },
  { key: 'twilio', category: 'sms', name: 'Twilio SMS', comingSoon: true },
  { key: 'webhook', category: 'automation', name: 'Webhook', comingSoon: false },
  { key: 'zapier', category: 'automation', name: 'Zapier', comingSoon: true },
  { key: 'n8n', category: 'automation', name: 'n8n', comingSoon: true },
];

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
  ) {}

  @Get()
  @RequirePermissions('integrations.read')
  async list() {
    // Serves the stored snapshot only — no blocking external API calls, so this
    // page stays fast. Live follower/reach numbers come from the dedicated
    // /instagram/insights endpoint, which the UI can call separately.
    const connected = await this.prisma.scoped.tenantIntegration.findMany();
    const cMap = new Map(connected.map((c) => [c.catalogKey, c]));

    return {
      categories: INTEGRATION_CATEGORIES,
      providers: CATALOG.map((p) => {
        const conn = cMap.get(p.key);
        const rawConfig = (conn?.config ?? {}) as Record<string, unknown> & { dmTokenEnc?: string };
        // Never leak credential material to the client. `hasDmToken` is enough for the UI.
        const { dmTokenEnc, ...safeConfig } = rawConfig;
        return {
          ...p,
          status: conn?.status ?? 'available',
          connected: !!conn,
          config: safeConfig,
          hasSecret: !!conn?.credentialsEnc,
          hasDmToken: !!dmTokenEnc,
        };
      }),
    };
  }

  @Post(':key/connect')
  @RequirePermissions('integrations.manage')
  async connect(@Param('key') key: string, @Body() dto: ConnectDto, @CurrentUser() user: AuthUser) {
    const provider = CATALOG.find((p) => p.key === key);
    if (!provider || provider.comingSoon) {
      return { ok: false, message: 'Bu inteqrasiya hələ mövcud deyil' };
    }
    const tenantId = requireTenantId();
    let config = (dto.config ?? {}) as Record<string, unknown>;

    if (key === 'instagram') {
      const igUserId = typeof config.igUserId === 'string' ? config.igUserId.trim() : '';
      if (!igUserId || !dto.secret) {
        throw new BadRequestException(
          'Instagram Business Account ID və Access Token tələb olunur',
        );
      }
      try {
        const profile = await fetchInstagramProfile(igUserId, dto.secret);
        config = { igUserId, profile };
      } catch (e) {
        throw new BadRequestException(
          `Instagram bağlantısı uğursuz oldu: ${e instanceof Error ? e.message : 'naməlum xəta'}`,
        );
      }
    }

    if (key === 'meta_ads') {
      const adAccountId = typeof config.adAccountId === 'string' ? config.adAccountId.trim() : '';
      if (!adAccountId || !dto.secret) {
        throw new BadRequestException('Reklam hesabı ID-si və Access Token tələb olunur');
      }
      try {
        const account = await fetchMetaAdAccount(adAccountId, dto.secret);
        config = { adAccountId, account };
      } catch (e) {
        throw new BadRequestException(
          `Meta Ads bağlantısı uğursuz oldu: ${e instanceof Error ? e.message : 'naməlum xəta'}. Token-də "ads_read" icazəsi olmalıdır.`,
        );
      }
    }

    const credentialsEnc = dto.secret ? encryptSecret(dto.secret) : undefined;
    await this.prisma.tenantIntegration.upsert({
      where: { tenantId_catalogKey: { tenantId, catalogKey: key } },
      update: {
        status: 'connected',
        config: config as object,
        ...(credentialsEnc ? { credentialsEnc } : {}),
        connectedById: user.userId,
      },
      create: {
        tenantId,
        catalogKey: key,
        config: config as object,
        credentialsEnc,
        connectedById: user.userId,
      },
    });
    return { ok: true };
  }

  @Delete(':key/disconnect')
  @RequirePermissions('integrations.manage')
  async disconnect(@Param('key') key: string) {
    await this.prisma.scoped.tenantIntegration.deleteMany({ where: { catalogKey: key } });
    return { ok: true };
  }

  @Get('instagram/media')
  @RequirePermissions('integrations.read')
  async instagramMedia() {
    const creds = await getInstagramCredentials(this.prisma);
    if (!creds) throw new BadRequestException('Instagram inteqrasiyası qoşulmayıb');
    try {
      const media = await fetchInstagramMedia(creds.igUserId, creds.token);
      return { media };
    } catch (e) {
      throw new BadRequestException(
        `Instagram media çəkilə bilmədi: ${e instanceof Error ? e.message : 'naməlum xəta'}`,
      );
    }
  }

  @Get('instagram/insights')
  @RequirePermissions('integrations.read')
  async instagramInsights() {
    const creds = await getInstagramCredentials(this.prisma);
    if (!creds) throw new BadRequestException('Instagram inteqrasiyası qoşulmayıb');
    const [profile, insights] = await Promise.all([
      fetchInstagramProfile(creds.igUserId, creds.token).catch(() => null),
      fetchInstagramInsights(creds.igUserId, creds.token),
    ]);
    return { profile, insights };
  }

  /**
   * Stores the separate "Instagram Login" access token needed for the DM/messaging
   * endpoints — the main Facebook Graph API token (used for profile/media/insights)
   * doesn't have access to conversations.
   */
  @Post('instagram/dm-token')
  @RequirePermissions('integrations.manage')
  async saveDmToken(@Body() dto: DmTokenDto) {
    const creds = await getInstagramCredentials(this.prisma);
    if (!creds) throw new BadRequestException('Əvvəlcə Instagram inteqrasiyasını qoşun');

    const token = dto.token.trim();
    // Verify before storing — otherwise a wrong token looks saved and only
    // fails later, when the user clicks "sync DM leads".
    try {
      await fetchInstagramConversations(creds.igUserId, token);
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'naməlum xəta';
      throw new BadRequestException(
        `Token yoxlanıla bilmədi: ${detail}. Bu, Facebook Page token-i deyil, "Instagram login" token-i olmalıdır (instagram_business_manage_messages icazəsi ilə).`,
      );
    }

    try {
      await saveInstagramDmToken(this.prisma, token);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'naməlum xəta');
    }
    return { ok: true };
  }

  /**
   * Scans recent Instagram DMs for buying intent — a phone number, a request to
   * enroll ("kursa yazılmaq istəyirəm"), or a price question — and turns each
   * unique interested sender into a CRM lead (source: instagram_dm). Safe to call
   * repeatedly: senders already matched by phone or Instagram handle are skipped.
   */
  @Post('instagram/sync-dm-leads')
  @RequirePermissions('integrations.manage')
  async syncInstagramDmLeads(@CurrentUser() user: AuthUser) {
    const creds = await getInstagramDmCredentials(this.prisma);
    if (!creds) {
      throw new BadRequestException(
        'Instagram DM token-i əlavə edilməyib. Əvvəlcə Instagram Login token-i saxlayın.',
      );
    }

    let conversations;
    try {
      conversations = await fetchInstagramConversations(creds.igUserId, creds.dmToken);
    } catch (e) {
      throw new BadRequestException(
        `Instagram DM-ləri çəkilə bilmədi: ${e instanceof Error ? e.message : 'naməlum xəta'}`,
      );
    }

    let created = 0;
    let skipped = 0;
    const results: {
      username?: string;
      phone?: string;
      reason: string;
      status: 'created' | 'skipped';
    }[] = [];

    for (const conv of conversations) {
      const incoming = conv.messages.filter((m) => m.from.id !== creds.igUserId && m.message);
      if (incoming.length === 0) continue;

      // Fold every message in the thread into one intent picture. The quote we
      // keep is the message that first proved intent — the phone, else the
      // enrolment/price ask — so the sales rep sees why the lead was captured.
      let phone: string | null = null;
      let email: string | null = null;
      let wantsEnroll = false;
      let asksPrice = false;
      let mentionsCourse = false;
      let quote: string | undefined;
      for (const m of incoming) {
        const s = analyzeMessage(m.message!);
        if (!phone && s.phone) {
          phone = s.phone;
          quote ??= m.message!;
        }
        if (!email && s.email) email = s.email;
        if (s.wantsEnroll && !wantsEnroll) {
          wantsEnroll = true;
          quote ??= m.message!;
        }
        if (s.asksPrice && !asksPrice) {
          asksPrice = true;
          quote ??= m.message!;
        }
        mentionsCourse ||= s.mentionsCourse;
      }

      const interested = !!phone || wantsEnroll || asksPrice;
      if (!interested) continue;

      const existing = await this.prisma.scoped.lead.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(phone ? [{ phone }] : []),
            ...(conv.participantUsername ? [{ instagram: conv.participantUsername }] : []),
          ],
        },
      });

      const reasons = [
        phone ? 'telefon' : null,
        wantsEnroll ? 'qeydiyyat istəyi' : null,
        asksPrice ? 'qiymət soruşdu' : null,
        !phone && !wantsEnroll && !asksPrice && mentionsCourse ? 'kursla maraqlandı' : null,
      ].filter(Boolean) as string[];
      const reason = reasons.join(', ');

      if (existing) {
        skipped++;
        results.push({ username: conv.participantUsername, phone: phone ?? undefined, reason, status: 'skipped' });
        continue;
      }

      const leadDto: CreateSalesLeadDto = {
        fullName: conv.participantUsername ?? `Instagram istifadəçisi ${conv.participantId ?? ''}`.trim(),
        phone: phone ?? undefined,
        email: email ?? undefined,
        instagram: conv.participantUsername,
        source: 'instagram_dm',
        // Enrolment intent is treated as a demo-grade signal and a price question
        // as a price ask, so lead scoring/priority reflect real buying intent.
        askedDemo: wantsEnroll,
        askedPrice: asksPrice,
        // `interested` guarantees at least one signal fired, so `quote` is set.
        notes: `Instagram DM (${reason}): "${quote ?? ''}"`,
      };
      await this.sales.createLead(leadDto, user.userId);
      created++;
      results.push({ username: conv.participantUsername, phone: phone ?? undefined, reason, status: 'created' });
    }

    return { created, skipped, results };
  }
}
