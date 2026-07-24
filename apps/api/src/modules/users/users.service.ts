import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { MailService } from '../../core/mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { PlanService } from '../../core/plan/plan.service';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import type { InviteUserDto, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly plan: PlanService,
  ) {}

  async list(q: ListQueryDto) {
    const where = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' as const } },
              { lastName: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(q.status?.length ? { status: { in: q.status } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.user.findMany({
        where,
        include: { roles: { include: { role: { select: { key: true, name: true } } } } },
        orderBy: q.orderBy('createdAt', ['createdAt', 'firstName', 'lastName', 'email']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.user.count({ where }),
    ]);
    return paginated(
      data.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        roles: u.roles.map((r) => ({ key: r.role.key, name: r.role.name, branchId: r.branchId })),
      })),
      total,
      q,
    );
  }

  async invite(dto: InviteUserDto, invitedBy: string) {
    const userCount = await this.prisma.scoped.user.count({ where: { deletedAt: null } });
    await this.plan.assertLimit('users', userCount);
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Email already registered' });
    }
    const role = await this.prisma.scoped.role.findFirst({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    const raw = randomBytes(32).toString('hex');
    await this.prisma.scoped.invitation.create({
      data: {
        tenantId: requireTenantId(),
        email,
        roleId: dto.roleId,
        branchId: dto.branchId,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        invitedBy,
      },
    });
    const url = `${this.config.get('APP_URL_WEB')}/invite/${raw}`;
    await this.mail.send(
      email,
      'Mactab dəvəti',
      `Sizi komandaya dəvət edirlər. Qeydiyyat üçün keçid (7 gün etibarlıdır): ${url}`,
    );
    return { ok: true };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.scoped.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

    if (dto.roleIds) {
      const roles = await this.prisma.scoped.role.findMany({ where: { id: { in: dto.roleIds } } });
      if (roles.length !== dto.roleIds.length) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Unknown role' });
      }
      const hasOwner = await this.prisma.userRole.findFirst({
        where: { userId: id, role: { key: 'owner' } },
      });
      const keepsOwner = roles.some((r) => r.key === 'owner');
      if (hasOwner && !keepsOwner) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Owner role cannot be removed' });
      }
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId, branchId: dto.branchId ?? null })),
      });
      await this.auth.invalidatePermissionCache(id);
    }

    const updated = await this.prisma.scoped.user.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
        phone: dto.phone ?? undefined,
        status: dto.status ?? undefined,
        locale: dto.locale ?? undefined,
      },
    });
    return { id: updated.id };
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot delete yourself' });
    }
    const isOwner = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { key: 'owner' } },
    });
    if (isOwner) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Owner cannot be deleted' });
    }
    await this.prisma.scoped.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'disabled' },
    });
    await this.auth.invalidatePermissionCache(id);
    return { ok: true };
  }
}
