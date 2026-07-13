import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { CrmService } from './crm.service';
import { StageDto } from './dto/crm.dto';

class SourceDto {
  @IsString()
  @MaxLength(60)
  name!: string;
}

@ApiTags('crm')
@ApiBearerAuth()
@Controller()
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly prisma: PrismaService,
  ) {}

  // ----- pipeline stages & lead sources (legacy config, still used by reports) -----

  @Get('lead-stages')
  @RequirePermissions('leads.read')
  async stages() {
    await this.crm.ensureDefaults();
    return this.prisma.scoped.leadStage.findMany({ orderBy: { order: 'asc' } });
  }

  @Post('lead-stages')
  @RequirePermissions('leads.settings')
  async createStage(@Body() dto: StageDto) {
    const max = await this.prisma.scoped.leadStage.aggregate({ _max: { order: true } });
    return this.prisma.scoped.leadStage.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        color: dto.color ?? '#4F46E5',
        order: dto.order ?? (max._max.order ?? 0) + 1,
      },
    });
  }

  @Get('lead-sources')
  @RequirePermissions('leads.read')
  async sources() {
    await this.crm.ensureDefaults();
    return this.prisma.scoped.leadSource.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('lead-sources')
  @RequirePermissions('leads.settings')
  createSource(@Body() dto: SourceDto) {
    return this.prisma.scoped.leadSource.create({
      data: { tenantId: requireTenantId(), name: dto.name },
    });
  }
}
