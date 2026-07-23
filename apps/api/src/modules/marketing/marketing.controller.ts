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
import {
  fetchInstagramInsights,
  fetchInstagramProfile,
  getInstagramCredentials,
} from '../integrations/instagram.util';
import { fetchMetaAdsSpend, getMetaAdsCredentials } from '../integrations/meta-ads.util';

const CHANNELS = ['meta', 'google', 'tiktok', 'instagram', 'offline', 'other'];

/** Display names for the `sourceKey` values written by the sales module. */
const SOURCE_KEY_LABELS: Record<string, string> = {
  instagram_dm: 'Instagram DM',
  whatsapp: 'WhatsApp',
  telefon: 'Telefon',
  referans: 'Referans',
  website: 'Veb sayt',
  event: 'Tədbir',
  organic: 'Orqanik',
  paid_ads: 'Ödənişli reklam',
  tiktok: 'TikTok',
};

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
    const [spendByChannel, leadsBySource, leadsBySourceKey, wonLeads, tuitionIncome] = await Promise.all([
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
      // Leads created through the sales module carry a free-text `sourceKey`
      // ('instagram_dm', 'paid_ads', ...) and never populate the LeadSource
      // relation, so grouping by sourceId alone reports every one as "Mənbəsiz".
      this.prisma.scoped.lead.groupBy({
        by: ['sourceKey'],
        where: { deletedAt: null, createdAt: range, sourceKey: { not: null } },
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
    const manualSpend = spendByChannel.reduce((s, c) => s + (c._sum.amount ?? 0), 0);
    const totalLeads = leadsBySource.reduce((s, l) => s + l._count, 0);
    const income = tuitionIncome._sum.amount ?? 0;

    // A lead is attributed by either mechanism, never both, so the two groupings
    // are merged by display label — a lead with no source at all lands in "Mənbəsiz".
    const sourceTally = new Map<string, number>();
    const tally = (label: string, n: number) =>
      sourceTally.set(label, (sourceTally.get(label) ?? 0) + n);
    for (const l of leadsBySource) {
      if (l.sourceId) tally(sourceMap.get(l.sourceId) ?? '—', l._count);
    }
    for (const l of leadsBySourceKey) tally(SOURCE_KEY_LABELS[l.sourceKey!] ?? l.sourceKey!, l._count);
    const attributed = [...sourceTally.values()].reduce((s, n) => s + n, 0);
    if (totalLeads > attributed) tally('Mənbəsiz', totalLeads - attributed);
    const bySource = [...sourceTally].map(([source, leads]) => ({ source, leads }));

    // Pulled live from the Meta Ads API when connected, so nobody has to key in
    // yesterday's ad spend by hand. Manually entered spend on the `meta`/`instagram`
    // channels would double-count against it, so those rows are dropped once the
    // API is the source of truth.
    const adsCreds = await getMetaAdsCredentials(this.prisma);
    let metaAds:
      | (Awaited<ReturnType<typeof fetchMetaAdsSpend>> & { currency: string; commissionPct: number })
      | null = null;
    // Surfaced to the UI instead of silently blanking the spend, so an expired
    // token reads as "reconnect", not as "we spent nothing".
    let metaAdsError: string | null = null;
    if (adsCreds) {
      try {
        const spend = await fetchMetaAdsSpend(adsCreds.adAccountId, adsCreds.token, range.gte, range.lt);
        metaAds = { ...spend, currency: adsCreds.currency ?? 'AZN', commissionPct: adsCreds.commissionPct };
      } catch (e) {
        metaAdsError = e instanceof Error ? e.message : 'naməlum xəta';
      }
    }

    const channelSpend = spendByChannel.map((c) => ({
      channel: c.channel,
      spend: c._sum.amount ?? 0,
    }));
    let byChannel = channelSpend;
    let totalSpend = manualSpend;
    if (metaAds) {
      byChannel = [
        ...channelSpend.filter((c) => c.channel !== 'meta' && c.channel !== 'instagram'),
        { channel: 'instagram', spend: metaAds.instagram },
        { channel: 'meta', spend: metaAds.facebook + metaAds.other },
      ].filter((c) => c.spend > 0);
      totalSpend = byChannel.reduce((s, c) => s + c.spend, 0);
    }

    // Best-effort: surface live Instagram reach/followers next to lead-gen ROI so the
    // marketing team can correlate social performance with actual pipeline results.
    let instagram: {
      username?: string;
      followers?: number;
      reach?: number;
      profileViews?: number;
      accountsEngaged?: number;
      interactions?: number;
      leadsFromInstagram: number;
    } | null = null;
    const creds = await getInstagramCredentials(this.prisma);
    if (creds) {
      const [profile, insights] = await Promise.all([
        fetchInstagramProfile(creds.igUserId, creds.token).catch(() => null),
        fetchInstagramInsights(creds.igUserId, creds.token, range.gte, range.lt),
      ]);
      const igSourceIds = sources.filter((s) => /instagram/i.test(s.name)).map((s) => s.id);
      instagram = {
        username: profile?.username,
        followers: profile?.followers_count,
        reach: insights?.reach,
        profileViews: insights?.profileViews,
        accountsEngaged: insights?.accountsEngaged,
        interactions: insights?.interactions,
        leadsFromInstagram:
          leadsBySource
            .filter((l) => l.sourceId && igSourceIds.includes(l.sourceId))
            .reduce((s, l) => s + l._count, 0) +
          leadsBySourceKey
            .filter((l) => /instagram/i.test(l.sourceKey ?? ''))
            .reduce((s, l) => s + l._count, 0),
      };
    }

    return {
      totalSpend,
      totalLeads,
      wonLeads,
      income,
      cpl: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
      cac: wonLeads > 0 ? Math.round(totalSpend / wonLeads) : 0,
      roas: totalSpend > 0 ? Math.round((income / totalSpend) * 100) / 100 : null,
      byChannel,
      manualSpend,
      metaAds,
      metaAdsError,
      bySource: bySource.sort((a, b) => b.leads - a.leads),
      instagram,
    };
  }
}
