import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { CrmService } from './crm.service';
import {
  ActivityDto,
  ConvertLeadDto,
  CreateLeadDto,
  MoveStageDto,
  StageDto,
  UpdateLeadDto,
} from './dto/crm.dto';

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

  // ----- stages & sources -----

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

  // ----- leads -----

  @Get('leads')
  @RequirePermissions('leads.read')
  list(
    @Query() q: ListQueryDto,
    @Query('stageId') stageId?: string,
    @Query('sourceId') sourceId?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.crm.listLeads(q, { stageId, sourceId, ownerId });
  }

  @Get('leads/board')
  @RequirePermissions('leads.read')
  async board() {
    await this.crm.ensureDefaults();
    return this.crm.board();
  }

  @Get('leads/funnel')
  @RequirePermissions('leads.read')
  funnel(@Query() q: ListQueryDto) {
    return this.crm.funnel(q);
  }

  @Get('leads/:id')
  @RequirePermissions('leads.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const lead = await this.prisma.scoped.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        stage: true,
        source: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    return lead;
  }

  @Post('leads')
  @RequirePermissions('leads.create')
  async create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthUser) {
    await this.crm.ensureDefaults();
    return this.crm.createLead(dto, user.userId);
  }

  @Patch('leads/:id')
  @RequirePermissions('leads.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.crm.updateLead(id, dto);
  }

  @Patch('leads/:id/stage')
  @RequirePermissions('leads.update')
  moveStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crm.moveStage(id, dto.stageId, user.userId, dto.lostReason);
  }

  @Post('leads/:id/convert')
  @RequirePermissions('leads.convert')
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crm.convert(id, dto, user.userId);
  }

  @Post('leads/:id/activities')
  @RequirePermissions('leads.update')
  addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prisma.scoped.leadActivity.create({
      data: {
        tenantId: requireTenantId(),
        leadId: id,
        type: dto.type,
        body: dto.body,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        doneAt: dto.dueAt ? undefined : new Date(),
        userId: user.userId,
      },
    });
  }

  @Delete('leads/:id')
  @RequirePermissions('leads.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.lead.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }
}
