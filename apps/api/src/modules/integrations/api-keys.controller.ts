import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsString, MaxLength } from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

const SCOPES = ['read', 'write'] as const;

class CreateApiKeyDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SCOPES as unknown as string[], { each: true })
  scopes!: string[];
}

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('apikeys.manage')
  async list() {
    const keys = await this.prisma.scoped.apiKey.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }

  @Post()
  @RequirePermissions('apikeys.manage')
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthUser) {
    const raw = `edu_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 12);
    await this.prisma.scoped.apiKey.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        prefix,
        keyHash: createHash('sha256').update(raw).digest('hex'),
        scopes: dto.scopes,
        createdBy: user.userId,
      },
    });
    // Full key returned exactly once.
    return { key: raw, prefix };
  }

  @Delete(':id')
  @RequirePermissions('apikeys.manage')
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
