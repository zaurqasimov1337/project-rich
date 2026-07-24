import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@edusphere/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { REDIS } from '../../core/redis/redis.module';
import { MailService } from '../../core/mail/mail.service';
import { TokenService } from './token.service';
import type {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterTenantDto,
  ResetPasswordDto,
} from './dto/auth.dto';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_BASE_SEC = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // ---------- login ----------

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();
    await this.assertNotLocked(email);

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, status: { not: 'disabled' } },
    });

    const valid = user && (await argon2.verify(user.passwordHash, dto.password));
    if (!valid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }
    await this.redis.del(`login:fail:${email}`);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant || tenant.status === 'cancelled') {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Account unavailable' });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.tokens.signAccess(
      { sub: user.id, tid: user.tenantId, email: user.email },
      'tenant',
    );
    const refreshToken = await this.tokens.issueRefresh(user.id, 'tenant', meta);
    return { accessToken, refreshToken, user: await this.buildMe(user.id) };
  }

  private async assertNotLocked(email: string): Promise<void> {
    const locked = await this.redis.ttl(`login:lock:${email}`);
    if (locked > 0) {
      throw new UnauthorizedException({
        code: 'RATE_LIMITED',
        message: `Too many attempts. Try again in ${locked}s`,
      });
    }
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const key = `login:fail:${email}`;
    const fails = await this.redis.incr(key);
    await this.redis.expire(key, 15 * 60);
    if (fails >= LOGIN_MAX_ATTEMPTS) {
      const lockSec = LOGIN_LOCK_BASE_SEC * 2 ** Math.min(fails - LOGIN_MAX_ATTEMPTS, 5);
      await this.redis.set(`login:lock:${email}`, '1', 'EX', lockSec);
    }
  }

  // ---------- refresh / logout ----------

  async refresh(raw: string, meta: { ip?: string; userAgent?: string }) {
    const { userId, realm, newRaw } = await this.tokens.rotateRefresh(raw, meta);
    if (realm === 'platform') {
      const pu = await this.prisma.platformUser.findUniqueOrThrow({ where: { id: userId } });
      const accessToken = this.tokens.signAccess(
        { sub: pu.id, email: pu.email, role: pu.role },
        'platform',
      );
      return { accessToken, refreshToken: newRaw };
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = this.tokens.signAccess(
      { sub: user.id, tid: user.tenantId, email: user.email },
      'tenant',
    );
    return { accessToken, refreshToken: newRaw };
  }

  async logout(raw: string | undefined): Promise<void> {
    if (raw) await this.tokens.revokeByRaw(raw);
  }

  // ---------- register tenant ----------

  async registerTenant(dto: RegisterTenantDto, meta: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();
    const slugBase = dto.centerName
      .toLowerCase()
      .replace(/[əƏ]/g, 'e')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[ıİi̇]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[çÇ]/g, 'c')
      .replace(/[üÜ]/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'center';

    const starter = await this.prisma.plan.findUnique({ where: { code: 'starter' } });
    // Hash outside the transaction: argon2 is deliberately slow and would burn
    // a large slice of the transaction budget while holding row locks.
    const passwordHash = await argon2.hash(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      let slug = slugBase;
      for (let i = 0; await tx.tenant.findUnique({ where: { slug } }); i++) {
        slug = `${slugBase}-${randomBytes(2).toString('hex')}`;
        if (i > 5) throw new BadRequestException({ code: 'CONFLICT', message: 'Slug conflict' });
      }

      const tenant = await tx.tenant.create({
        data: {
          name: dto.centerName,
          slug,
          status: 'trial',
          planId: starter?.id,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        },
      });

      // Seed system roles
      const roleIds: Record<string, string> = {};
      for (const [key, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            key,
            name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            isSystem: true,
            permissions: {
              create: (perms === '*' ? ALL_PERMISSIONS : perms).map((permission) => ({
                permission,
              })),
            },
          },
        });
        roleIds[key] = role.id;
      }

      // Emails are globally unique across tenants (login resolves user by email alone).
      const existing = await tx.user.findFirst({ where: { email } });
      if (existing) {
        throw new BadRequestException({ code: 'CONFLICT', message: 'Email already registered' });
      }

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          roles: { create: { roleId: roleIds['owner']! } },
        },
      });

      await tx.branch.create({
        data: { tenantId: tenant.id, name: 'Əsas filial', isMain: true },
      });

      return { tenant, user };
    },
    // Seeding every system role is a dozen sequential round-trips; against a
    // serverless Postgres that overruns the 5s default.
    { timeout: 30_000, maxWait: 10_000 });

    const accessToken = this.tokens.signAccess(
      { sub: result.user.id, tid: result.tenant.id, email },
      'tenant',
    );
    const refreshToken = await this.tokens.issueRefresh(result.user.id, 'tenant', meta);

    this.mail
      .send(email, 'Mactab-ə xoş gəldiniz', `Hesabınız yaradıldı: ${result.tenant.name}`)
      .catch(() => undefined);

    return { accessToken, refreshToken, user: await this.buildMe(result.user.id) };
  }

  // ---------- forgot / reset password ----------

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();
    const count = await this.redis.incr(`pwreset:count:${email}`);
    await this.redis.expire(`pwreset:count:${email}`, 3600);
    if (count > 3) return; // silent rate limit

    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) return; // no user enumeration

    const raw = randomBytes(32).toString('hex');
    await this.redis.set(
      `pwreset:token:${createHash('sha256').update(raw).digest('hex')}`,
      user.id,
      'EX',
      30 * 60,
    );
    const url = `${process.env.APP_URL_WEB}/reset-password?token=${raw}`;
    await this.mail.send(
      email,
      'Şifrə yeniləmə',
      `Şifrənizi yeniləmək üçün keçid (30 dəq etibarlıdır): ${url}`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const key = `pwreset:token:${createHash('sha256').update(dto.token).digest('hex')}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
    await this.redis.del(key);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (await argon2.verify(user.passwordHash, dto.password)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Yeni şifrə köhnə şifrə ilə eyni ola bilməz',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.password) },
    });
    // A reset means the old credentials may be compromised — drop every session.
    await this.tokens.revokeAllForUser(userId);
    await this.redis.del(`login:fail:${user.email}`, `login:lock:${user.email}`);
  }

  /**
   * Self-service password change. Requires the current password, refuses a
   * no-op change, and revokes all other sessions so a stolen refresh token
   * cannot outlive the rotation.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: { ip?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Cari şifrə yanlışdır',
      });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Yeni şifrə cari şifrə ilə eyni ola bilməz',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
    });
    await this.tokens.revokeAllForUser(userId);

    // Issue a fresh pair so the caller stays logged in on this device only.
    const accessToken = this.tokens.signAccess(
      { sub: user.id, tid: user.tenantId, email: user.email },
      'tenant',
    );
    const refreshToken = await this.tokens.issueRefresh(user.id, 'tenant', meta);
    return { accessToken, refreshToken };
  }

  // ---------- invitations ----------

  async acceptInvitation(dto: AcceptInvitationDto, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired invitation',
      });
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          passwordHash: await argon2.hash(dto.password),
          firstName: dto.firstName,
          lastName: dto.lastName,
          roles: { create: { roleId: invitation.roleId, branchId: invitation.branchId } },
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });

    const accessToken = this.tokens.signAccess(
      { sub: user.id, tid: user.tenantId, email: user.email },
      'tenant',
    );
    const refreshToken = await this.tokens.issueRefresh(user.id, 'tenant', meta);
    return { accessToken, refreshToken, user: await this.buildMe(user.id) };
  }

  // ---------- me ----------

  async buildMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
      },
    });
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      include: { plan: true },
    });

    const permissions = [
      ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((p) => p.permission))),
    ];
    const branchIds = [
      ...new Set(user.roles.map((ur) => ur.branchId).filter((b): b is string => !!b)),
    ];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      roles: user.roles.map((ur) => ({ key: ur.role.key, name: ur.role.name })),
      permissions,
      branchIds,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt,
        plan: tenant.plan
          ? {
              code: tenant.plan.code,
              name: tenant.plan.name,
              limits: tenant.plan.limits,
              features: tenant.plan.features,
            }
          : null,
      },
    };
  }

  /** Cached permission set for guards. Invalidated on role/user changes. */
  async getPermissionSet(userId: string): Promise<Set<string>> {
    const cacheKey = `perms:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return new Set(JSON.parse(cached) as string[]);

    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: true } } },
    });
    const perms = [
      ...new Set(roles.flatMap((ur) => ur.role.permissions.map((p) => p.permission))),
    ];
    await this.redis.set(cacheKey, JSON.stringify(perms), 'EX', 300);
    return new Set(perms);
  }

  async invalidatePermissionCache(userId: string): Promise<void> {
    await this.redis.del(`perms:${userId}`);
  }

  async getBranchScope(userId: string): Promise<string[]> {
    const roles = await this.prisma.userRole.findMany({ where: { userId } });
    return [...new Set(roles.map((r) => r.branchId).filter((b): b is string => !!b))];
  }
}
