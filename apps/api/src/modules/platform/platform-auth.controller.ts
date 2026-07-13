import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import type { Request, Response } from 'express';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { REFRESH_TOKEN_TTL_SEC } from '@edusphere/shared';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformOnly } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TokenService } from '../auth/token.service';

const COOKIE = 'prt';

class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

@ApiTags('platform')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: PlatformLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.prisma.platformUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    const valid = user && user.status === 'active' && (await argon2.verify(user.passwordHash, dto.password));
    if (!valid) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const accessToken = this.tokens.signAccess(
      { sub: user.id, email: user.email, role: user.role },
      'platform',
    );
    const refresh = await this.tokens.issueRefresh(user.id, 'platform', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.cookie(COOKIE, refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/platform/auth',
      maxAge: REFRESH_TOKEN_TTL_SEC * 1000,
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string>)[COOKIE] ?? '';
    const { userId, realm, newRaw } = await this.tokens.rotateRefresh(raw, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (realm !== 'platform') {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid session' });
    }
    const user = await this.prisma.platformUser.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = this.tokens.signAccess(
      { sub: user.id, email: user.email, role: user.role },
      'platform',
    );
    res.cookie(COOKIE, newRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/platform/auth',
      maxAge: REFRESH_TOKEN_TTL_SEC * 1000,
    });
    return { accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string>)[COOKIE];
    if (raw) await this.tokens.revokeByRaw(raw);
    res.clearCookie(COOKIE, { path: '/api/v1/platform/auth' });
    return { ok: true };
  }

  @ApiBearerAuth()
  @PlatformOnly()
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const pu = await this.prisma.platformUser.findUniqueOrThrow({ where: { id: user.userId } });
    return { id: pu.id, email: pu.email, firstName: pu.firstName, lastName: pu.lastName, role: pu.role };
  }
}
