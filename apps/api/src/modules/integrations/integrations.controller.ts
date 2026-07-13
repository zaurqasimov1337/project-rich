import {
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

/** Built-in provider catalog surfaced to every tenant. */
const CATALOG = [
  { key: 'openai', category: 'ai', name: 'OpenAI', comingSoon: false },
  { key: 'anthropic', category: 'ai', name: 'Claude (Anthropic)', comingSoon: false },
  { key: 'gemini', category: 'ai', name: 'Google Gemini', comingSoon: true },
  { key: 'deepseek', category: 'ai', name: 'DeepSeek', comingSoon: true },
  { key: 'facebook', category: 'social', name: 'Facebook', comingSoon: true },
  { key: 'instagram', category: 'social', name: 'Instagram', comingSoon: true },
  { key: 'tiktok', category: 'social', name: 'TikTok', comingSoon: true },
  { key: 'meta_ads', category: 'ads', name: 'Meta Ads', comingSoon: true },
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
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('integrations.read')
  async list() {
    const connected = await this.prisma.scoped.tenantIntegration.findMany();
    const cMap = new Map(connected.map((c) => [c.catalogKey, c]));
    return {
      categories: INTEGRATION_CATEGORIES,
      providers: CATALOG.map((p) => {
        const conn = cMap.get(p.key);
        return {
          ...p,
          status: conn?.status ?? 'available',
          connected: !!conn,
          config: conn?.config ?? {},
          hasSecret: !!conn?.credentialsEnc,
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
    const credentialsEnc = dto.secret ? encryptSecret(dto.secret) : undefined;
    await this.prisma.tenantIntegration.upsert({
      where: { tenantId_catalogKey: { tenantId, catalogKey: key } },
      update: {
        status: 'connected',
        config: (dto.config ?? {}) as object,
        ...(credentialsEnc ? { credentialsEnc } : {}),
        connectedById: user.userId,
      },
      create: {
        tenantId,
        catalogKey: key,
        config: (dto.config ?? {}) as object,
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
}
