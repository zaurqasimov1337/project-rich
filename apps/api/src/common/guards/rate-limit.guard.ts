import { CanActivate, ExecutionContext, HttpException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import Redis from 'ioredis';
import { REDIS } from '../../core/redis/redis.module';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const RATE_LIMIT_KEY = 'rateLimit';
/** Per-route override: requests allowed per window (seconds). */
export const RateLimit = (limit: number, windowSec: number) =>
  Reflect.metadata(RATE_LIMIT_KEY, { limit, windowSec });

/**
 * Global sliding-window rate limiter (Redis INCR + EXPIRE).
 * Keyed by userId when authenticated, else IP. Auth routes get a tighter
 * default. Returns 429 with Retry-After.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();
    const override = this.reflector.get<{ limit: number; windowSec: number }>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isAuthRoute = req.path.includes('/auth/');

    // Health checks and other unauthenticated infra routes shouldn't pay a
    // network round-trip to Redis on every hit — only meter auth routes (the
    // brute-force surface) among public endpoints.
    if (isPublic && !isAuthRoute) return true;

    const limit = override?.limit ?? (isAuthRoute ? 20 : 300);
    const windowSec = override?.windowSec ?? 60;

    const id = req.user?.userId ?? req.ip ?? 'anon';
    const key = `rl:${req.method}:${req.path.split('/').slice(0, 6).join('/')}:${id}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, windowSec);
      if (count > limit) {
        const ttl = await this.redis.ttl(key);
        throw new HttpException(
          { code: 'RATE_LIMITED', message: 'Too many requests', details: { retryAfter: ttl } },
          429,
        );
      }
    } catch (e) {
      // Fail open: a slow or unreachable Redis must not stall or block requests.
      // Re-throw only our own 429 so genuine rate limits still apply.
      if (e instanceof HttpException) throw e;
    }
    return true;
  }
}
