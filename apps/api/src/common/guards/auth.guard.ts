import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JWT_AUDIENCE_PLATFORM } from '@edusphere/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY, PLATFORM_KEY } from '../decorators/require-permissions.decorator';
import { getContext } from '../../core/context/request-context';
import { TokenService } from '../../modules/auth/token.service';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Single global guard: authenticates JWT, resolves realm, populates the
 * AsyncLocalStorage context (tenantId, permissions, branch scope) and enforces
 * @RequirePermissions / @PlatformOnly metadata. Default-deny: any
 * non-@Public route requires a valid token.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing token' });
    }
    const payload = this.tokens.verifyAccess(header.slice(7));
    const realm = payload.aud === JWT_AUDIENCE_PLATFORM ? 'platform' : 'tenant';

    const platformRoles = this.reflector.getAllAndOverride<string[] | undefined>(PLATFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const ctx = getContext();

    if (platformRoles !== undefined) {
      // Platform-realm route
      if (realm !== 'platform') {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Platform access required' });
      }
      if (platformRoles.length > 0 && !platformRoles.includes(payload.role ?? '')) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient role' });
      }
      if (ctx) {
        ctx.realm = 'platform';
        ctx.userId = payload.sub;
      }
      (req as Request & { user: unknown }).user = {
        userId: payload.sub,
        realm,
        email: payload.email,
        role: payload.role,
      };
      return true;
    }

    // Tenant-realm route
    if (realm !== 'tenant' || !payload.tid) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Tenant access required' });
    }

    const permissions = await this.auth.getPermissionSet(payload.sub);
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    for (const p of required) {
      if (!permissions.has(p)) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission: ${p}` });
      }
    }

    if (ctx) {
      ctx.realm = 'tenant';
      ctx.tenantId = payload.tid;
      ctx.userId = payload.sub;
      ctx.permissions = permissions;
      ctx.impersonatedBy = payload.imp;
    }
    (req as Request & { user: unknown }).user = {
      userId: payload.sub,
      tenantId: payload.tid,
      realm,
      email: payload.email,
      impersonatedBy: payload.imp,
    };
    return true;
  }
}
