import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { PlanService } from '../../core/plan/plan.service';

class BranchDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, { from: string; to: string }>;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, { from: string; to: string }>;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly plan: PlanService,
  ) {}

  @Get()
  @RequirePermissions('branches.read')
  async list() {
    const branches = await this.prisma.scoped.branch.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { rooms: { where: { deletedAt: null } } } } },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    });
    return branches.map((b) => ({ ...b, roomCount: b._count.rooms, _count: undefined }));
  }

  @Post()
  @RequirePermissions('branches.manage')
  async create(@Body() dto: BranchDto) {
    const count = await this.prisma.scoped.branch.count({ where: { deletedAt: null } });
    await this.plan.assertLimit('branches', count);
    const branch = await this.prisma.scoped.branch.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        workingHours: dto.workingHours ?? {},
        isMain: dto.isMain ?? false,
      },
    });
    this.audit.log({ action: 'create', entityType: 'branch', entityId: branch.id, after: branch });
    return branch;
  }

  @Patch(':id')
  @RequirePermissions('branches.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    const before = await this.prisma.scoped.branch.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Branch not found' });
    const branch = await this.prisma.scoped.branch.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        address: dto.address ?? undefined,
        phone: dto.phone ?? undefined,
        workingHours: dto.workingHours ?? undefined,
        isMain: dto.isMain ?? undefined,
      },
    });
    this.audit.log({ action: 'update', entityType: 'branch', entityId: id, before, after: branch });
    return branch;
  }

  @Delete(':id')
  @RequirePermissions('branches.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const branch = await this.prisma.scoped.branch.findFirst({ where: { id, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Branch not found' });
    if (branch.isMain) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Main branch cannot be deleted' });
    }
    const groups = await this.prisma.scoped.group.count({
      where: { branchId: id, deletedAt: null, status: { in: ['planned', 'active'] } },
    });
    if (groups > 0) {
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'Branch has active groups',
      });
    }
    await this.prisma.scoped.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    this.audit.log({ action: 'delete', entityType: 'branch', entityId: id, before: branch });
    return { ok: true };
  }
}
