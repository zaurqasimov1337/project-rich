import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { WEBHOOK_EVENTS } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS as unknown as string[], { each: true })
  events!: string[];
}

class UpdateWebhookDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhook-endpoints')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('webhooks.manage')
  async list() {
    const rows = await this.prisma.scoped.webhookEndpoint.findMany({
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Never return the raw secret after creation.
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      events: r.events,
      active: r.active,
      deliveries: r._count.deliveries,
      createdAt: r.createdAt,
    }));
  }

  @Get('events')
  @RequirePermissions('webhooks.manage')
  events() {
    return WEBHOOK_EVENTS;
  }

  @Post()
  @RequirePermissions('webhooks.manage')
  async create(@Body() dto: CreateWebhookDto) {
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const endpoint = await this.prisma.scoped.webhookEndpoint.create({
      data: { tenantId: requireTenantId(), url: dto.url, events: dto.events, secret },
    });
    // Secret is shown exactly once.
    return { id: endpoint.id, secret };
  }

  @Post(':id')
  @RequirePermissions('webhooks.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebhookDto) {
    const ep = await this.prisma.scoped.webhookEndpoint.findFirst({ where: { id } });
    if (!ep) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Endpoint not found' });
    await this.prisma.scoped.webhookEndpoint.update({
      where: { id },
      data: { active: dto.active ?? undefined },
    });
    return { ok: true };
  }

  @Get(':id/deliveries')
  @RequirePermissions('webhooks.manage')
  deliveries(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.scoped.webhookDelivery.findMany({
      where: { endpointId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Delete(':id')
  @RequirePermissions('webhooks.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.webhookEndpoint.deleteMany({ where: { id } });
    return { ok: true };
  }
}
