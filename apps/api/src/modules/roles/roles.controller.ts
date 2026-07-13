import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsString, MaxLength, IsOptional } from 'class-validator';
import { ALL_PERMISSIONS } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class CreateRoleDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: string[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions?: string[];
}

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('permissions')
  @RequirePermissions('roles.manage')
  permissionCatalog() {
    return ALL_PERMISSIONS;
  }

  @Get()
  @RequirePermissions('users.read')
  async list() {
    const roles = await this.prisma.scoped.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission),
    }));
  }

  @Post()
  @RequirePermissions('roles.manage')
  async create(@Body() dto: CreateRoleDto) {
    const key = `custom:${dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
    const existing = await this.prisma.scoped.role.findFirst({ where: { key } });
    if (existing) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Role name already exists' });
    }
    const role = await this.prisma.scoped.role.create({
      data: {
        tenantId: requireTenantId(),
        key,
        name: dto.name,
        isSystem: false,
        permissions: { create: dto.permissions.map((permission) => ({ permission })) },
      },
    });
    return { id: role.id };
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.prisma.scoped.role.findFirst({ where: { id } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    if (role.isSystem && dto.permissions) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'System role permissions cannot be changed',
      });
    }
    await this.prisma.scoped.role.update({
      where: { id },
      data: { name: dto.name ?? undefined },
    });
    if (dto.permissions) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: dto.permissions.map((permission) => ({ roleId: id, permission })),
      });
    }
    return { ok: true };
  }

  @Delete(':id')
  @RequirePermissions('roles.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.prisma.scoped.role.findFirst({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    if (role.isSystem) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'System role cannot be deleted' });
    }
    if (role._count.users > 0) {
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'Role is assigned to users',
      });
    }
    await this.prisma.scoped.role.delete({ where: { id } });
    return { ok: true };
  }
}
