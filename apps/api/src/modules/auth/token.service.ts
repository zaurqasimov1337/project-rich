import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ACCESS_TOKEN_TTL_SEC,
  JWT_AUDIENCE_PLATFORM,
  JWT_AUDIENCE_TENANT,
  REFRESH_TOKEN_TTL_SEC,
} from '@edusphere/shared';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface AccessPayload {
  sub: string; // user id
  tid?: string; // tenant id
  aud: string;
  email: string;
  role?: string; // platform role
  imp?: string; // impersonating platform user id
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccess(payload: Omit<AccessPayload, 'aud'>, realm: 'tenant' | 'platform'): string {
    const aud = realm === 'platform' ? JWT_AUDIENCE_PLATFORM : JWT_AUDIENCE_TENANT;
    return this.jwt.sign(
      { ...payload, aud },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL_SEC,
      },
    );
  }

  verifyAccess(token: string): AccessPayload {
    try {
      return this.jwt.verify<AccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid token' });
    }
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Issues a new refresh token (new family unless familyId passed). Returns raw token. */
  async issueRefresh(
    userId: string,
    realm: 'tenant' | 'platform',
    meta: { ip?: string; userAgent?: string },
    familyId?: string,
  ): Promise<string> {
    const raw = `${randomUUID()}.${randomBytes(32).toString('hex')}`;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        realm,
        familyId: familyId ?? randomUUID(),
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
      },
    });
    return raw;
  }

  /**
   * Rotates a refresh token. Reuse of a revoked token revokes the whole family
   * (stolen-token detection). Returns {userId, realm, newRaw}.
   */
  async rotateRefresh(
    raw: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ userId: string; realm: 'tenant' | 'platform'; newRaw: string }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Session expired' });
    }
    if (record.revokedAt) {
      // Token reuse — revoke entire family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Session revoked' });
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const newRaw = await this.issueRefresh(
      record.userId,
      record.realm as 'tenant' | 'platform',
      meta,
      record.familyId,
    );
    return { userId: record.userId, realm: record.realm as 'tenant' | 'platform', newRaw };
  }

  async revokeByRaw(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
