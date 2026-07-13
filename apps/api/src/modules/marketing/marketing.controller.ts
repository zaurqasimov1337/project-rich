import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, paginated, resolveDateRange } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

const CHANNELS = ['meta', 'google', 'tiktok', 'instagram', 'offline', 'other'];

class CampaignDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(CHANNELS)
  channel!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;
}

class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'finished'])
  status?: string;
}

class AdSpendDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsIn(CHANNELS)
  channel!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

@ApiTags('marketing')
@ApiBearerAuth()
@Controller()
export class MarketingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('campaigns')
  @RequirePermissions('marketing.read')
  async campaigns(@Query() q: ListQueryDto) {
    const where = {
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.campaign.findMany({
        where,
        include: { adSpends: { select: { amount: true } } },
        orderBy: { startAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.campaign.count({ where }),
    ]);
    return paginated(
      data.map((c) => ({
        ...c,
        spent: c.adSpends.reduce((s, a) => s + a.amount, 0),
        adSpends: undefined,
      })),
      total,
      q,
    );
  }

  @Post('campaigns')
  @RequirePermissions('marketing.manage')
  createCampaign(@Body() dto: CampaignDto) {
    return this.prisma.scoped.campaign.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        channel: dto.channel,
        budget: dto.budget ?? 0,
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        utmCampaign: dto.utmCampaign,
      },
    });
  }

  @Patch('campaigns/:id')
  @RequirePermissions('marketing.manage')
  updateCampaign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto) {
    return this.prisma.scoped.campaign.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        budget: dto.budget ?? undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  @Post('ad-spends')
  @RequirePermissions('marketing.manage')
  addSpend(@Body() dto: AdSpendDto) {
    return this.prisma.scoped.adSpend.create({
      data: {
        tenantId: requireTenantId(),
        campaignId: dto.campaignId,
        channel: dto.channel,
        amount: dto.amount,
        date: new Date(dto.date),
        note: dto.note,
      },
    });
  }

  @Get('ad-spends')
  @RequirePermissions('marketing.read')
  async spends(@Query() q: ListQueryDto) {
    const range = resolveDateRange(q);
    const where = { ...(range ? { date: range } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.scoped.adSpend.findMany({
        where,
        include: { campaign: { select: { name: true } } },
        orderBy: { date: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.adSpend.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  /** CPL / CAC / ROAS per source & campaign for a period. */
  @Get('marketing/metrics')
  @RequirePermissions('marketing.read')
  async metrics(@Query() q: ListQueryDto) {
    const range = resolveDateRange(q) ?? {
      gte: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      lt: new Date(),
    };
    const [spendByChannel, leadsBySource, wonLeads, tuitionIncome] = await Promise.all([
      this.prisma.scoped.adSpend.groupBy({
        by: ['channel'],
        where: { date: { gte: range.gte, lt: range.lt } },
        _sum: { amount: true },
      }),
      this.prisma.scoped.lead.groupBy({
        by: ['sourceId'],
        where: { deletedAt: null, createdAt: range },
        _count: true,
      }),
      this.prisma.scoped.lead.count({
        where: { deletedAt: null, createdAt: range, convertedStudentId: { not: null } },
      }),
      this.prisma.scoped.transaction.aggregate({
        where: { type: 'income', date: { gte: range.gte, lt: range.lt } },
        _sum: { amount: true },
      }),
    ]);
    const sources = await this.prisma.scoped.leadSource.findMany();
    const sourceMap = new Map(sources.map((s) => [s.id, s.name]));
    const totalSpend = spendByChannel.reduce((s, c) => s + (c._sum.amount ?? 0), 0);
    const totalLeads = leadsBySource.reduce((s, l) => s + l._count, 0);
    const income = tuitionIncome._sum.amount ?? 0;
    return {
      totalSpend,
      totalLeads,
      wonLeads,
      income,
      cpl: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
      cac: wonLeads > 0 ? Math.round(totalSpend / wonLeads) : 0,
      roas: totalSpend > 0 ? Math.round((income / totalSpend) * 100) / 100 : null,
      byChannel: spendByChannel.map((c) => ({ channel: c.channel, spend: c._sum.amount ?? 0 })),
      bySource: leadsBySource.map((l) => ({
        source: l.sourceId ? (sourceMap.get(l.sourceId) ?? '—') : 'Mənbəsiz',
        leads: l._count,
      })),
    };
  }
}
