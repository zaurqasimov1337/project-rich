import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IMPERSONATION_TTL_SEC } from '@edusphere/shared';
import { PlatformOnly } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

class UpdateTenantDto {
  @IsOptional()
  @IsIn(['trial', 'active', 'past_due', 'suspended', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  trialEndsAt?: string;
}

class PlanDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(0)
  priceMonthly!: number;

  @IsInt()
  @Min(0)
  priceYearly!: number;

  @IsObject()
  limits!: Record<string, number>;

  @IsObject()
  features!: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearly?: number;

  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- analytics ----------

  @Get('analytics')
  async analytics() {
    const [byStatus, plans, tenants, recentTenants] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.tenant.findMany({
        where: { deletedAt: null, status: { in: ['active', 'trial', 'past_due'] } },
        include: { plan: true, subscriptions: { where: { status: { in: ['active', 'trialing'] } } } },
      }),
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { plan: { select: { name: true } } },
      }),
    ]);

    // MRR = sum of active subscriptions normalized to monthly
    let mrr = 0;
    for (const t of tenants) {
      const sub = t.subscriptions[0];
      if (!sub || sub.status !== 'active' || !t.plan) continue;
      mrr += sub.period === 'yearly' ? Math.round(t.plan.priceYearly / 12) : t.plan.priceMonthly;
    }

    return {
      tenantsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      totalTenants: byStatus.reduce((s, r) => s + r._count, 0),
      mrr,
      arr: mrr * 12,
      planCount: plans.length,
      recentTenants: recentTenants.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        plan: t.plan?.name ?? null,
        createdAt: t.createdAt,
      })),
    };
  }

  // ---------- tenants ----------

  @Get('tenants')
  async tenants(@Query() q: ListQueryDto) {
    const where = {
      deletedAt: null,
      ...(q.status?.length ? { status: { in: q.status as never[] } } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { slug: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: { plan: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);
    // usage counts
    const ids = data.map((t) => t.id);
    const [students, users] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: ids }, deletedAt: null },
        _count: true,
      }),
      this.prisma.user.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: ids }, deletedAt: null },
        _count: true,
      }),
    ]);
    const sMap = new Map(students.map((s) => [s.tenantId, s._count]));
    const uMap = new Map(users.map((u) => [u.tenantId, u._count]));
    return paginated(
      data.map((t) => ({
        ...t,
        studentCount: sMap.get(t.id) ?? 0,
        userCount: uMap.get(t.id) ?? 0,
      })),
      total,
      q,
    );
  }

  @Get('tenants/:id')
  async tenant(@Param('id', ParseUUIDPipe) id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        plan: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, include: { invoices: true } },
      },
    });
    if (!tenant) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tenant not found' });
    const [users, students, groups] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.student.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.group.count({ where: { tenantId: id, deletedAt: null } }),
    ]);
    return { ...tenant, usage: { users, students, groups } };
  }

  @Patch('tenants/:id')
  @PlatformOnly('super_admin', 'support')
  async updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!tenant) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tenant not found' });
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: (dto.status as never) ?? undefined,
        planId: dto.planId ?? undefined,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
      },
    });
    await this.prisma.platformAudit.create({
      data: {
        actorId: actor.userId,
        action: 'tenant.update',
        targetType: 'tenant',
        targetId: id,
        diff: { before: { status: tenant.status, planId: tenant.planId }, after: dto } as object,
      },
    });
    return updated;
  }

  /** Mints a 30-min tenant token for the tenant's owner — fully audited. */
  @Post('tenants/:id/impersonate')
  @PlatformOnly('super_admin')
  async impersonate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    const owner = await this.prisma.user.findFirst({
      where: { tenantId: id, deletedAt: null, roles: { some: { role: { key: 'owner' } } } },
    });
    if (!owner) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tenant owner not found' });
    const accessToken = this.jwt.sign(
      { sub: owner.id, tid: id, email: owner.email, aud: 'tenant', imp: actor.userId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: IMPERSONATION_TTL_SEC,
      },
    );
    await this.prisma.platformAudit.create({
      data: {
        actorId: actor.userId,
        action: 'tenant.impersonate',
        targetType: 'tenant',
        targetId: id,
      },
    });
    return { accessToken, expiresIn: IMPERSONATION_TTL_SEC };
  }

  // ---------- plans ----------

  @Get('plans')
  plans() {
    return this.prisma.plan.findMany({
      include: { _count: { select: { tenants: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post('plans')
  @PlatformOnly('super_admin')
  async createPlan(@Body() dto: PlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException({ code: 'CONFLICT', message: 'Plan code exists' });
    return this.prisma.plan.create({ data: { ...dto, isCustom: dto.code.startsWith('custom') } });
  }

  @Patch('plans/:id')
  @PlatformOnly('super_admin')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        priceMonthly: dto.priceMonthly ?? undefined,
        priceYearly: dto.priceYearly ?? undefined,
        limits: dto.limits ?? undefined,
        features: dto.features ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  // ---------- audit ----------

  @Get('audit')
  @PlatformOnly('super_admin', 'support')
  async audit(@Query() q: ListQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.platformAudit.findMany({
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.platformAudit.count(),
    ]);
    return paginated(data, total, q);
  }
}
