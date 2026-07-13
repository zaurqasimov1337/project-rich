import { HttpException, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { PlanMetric } from '@edusphere/shared';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { requireTenantId } from '../context/request-context';

/**
 * Enforces plan limits (402 PLAN_LIMIT_REACHED) and feature gates
 * (403 FEATURE_NOT_AVAILABLE). Plan config cached in Redis for 60s.
 */
@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async getPlan(): Promise<{
    limits: Record<string, number>;
    features: Record<string, boolean>;
  } | null> {
    const tenantId = requireTenantId();
    const cacheKey = `plan:${tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant?.plan) return null;
    const result = {
      limits: tenant.plan.limits as Record<string, number>,
      features: tenant.plan.features as Record<string, boolean>,
    };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
    return result;
  }

  /** Throws 402 when creating one more of `metric` would exceed the plan limit. */
  async assertLimit(metric: PlanMetric, currentCount: number): Promise<void> {
    const plan = await this.getPlan();
    const limit = plan?.limits?.[metric];
    if (limit == null || limit === -1) return; // unlimited / no plan
    if (currentCount >= limit) {
      throw new HttpException(
        {
          code: 'PLAN_LIMIT_REACHED',
          message: `Plan limitinə çatdınız (${metric}: ${limit}). Planı yüksəldin.`,
        },
        402,
      );
    }
  }

  async assertFeature(feature: string): Promise<void> {
    const plan = await this.getPlan();
    if (plan && plan.features?.[feature] === false) {
      throw new HttpException(
        {
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Bu funksiya planınıza daxil deyil (${feature}). Planı yüksəldin.`,
        },
        403,
      );
    }
  }

  /** Monthly AI request counter (Redis, expires end of month). */
  async consumeAiRequest(): Promise<void> {
    const tenantId = requireTenantId();
    const now = new Date();
    const key = `ai:count:${tenantId}:${now.getFullYear()}-${now.getMonth() + 1}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 32 * 24 * 3600);

    const plan = await this.getPlan();
    const limit = plan?.limits?.aiRequests;
    if (limit != null && limit !== -1 && count > limit) {
      throw new HttpException(
        {
          code: 'PLAN_LIMIT_REACHED',
          message: `Aylıq AI sorğu limitiniz bitdi (${limit}). Planı yüksəldin.`,
        },
        402,
      );
    }
  }
}
