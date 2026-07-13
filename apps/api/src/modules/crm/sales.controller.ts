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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SalesService } from './sales.service';
import { CrmService } from './crm.service';
import { LEAD_SOURCES, LEAD_STATUSES, PIPELINE_COLUMNS } from './sales.constants';
import {
  AddLeadActivityDto,
  BulkAssignDto,
  CreateFollowupDto,
  CreateSalesLeadDto,
  MoveLeadColumnDto,
  UpdateFollowupDto,
  UpdateSalesLeadDto,
} from './dto/sales.dto';

@ApiTags('sales-crm')
@ApiBearerAuth()
@Controller()
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly crm: CrmService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- static/helper routes first ----
  @Get('sales/meta')
  @RequirePermissions('leads.read')
  async meta() {
    const [trainings, managers] = await Promise.all([
      this.prisma.scoped.course.findMany({
        where: { deletedAt: null, status: 'active' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.scoped.user.findMany({
        where: { status: 'active' },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: 'asc' },
      }),
    ]);
    return {
      statuses: LEAD_STATUSES,
      sources: LEAD_SOURCES,
      columns: PIPELINE_COLUMNS.map((c) => ({ key: c.key, label: c.label })),
      trainings,
      managers: managers.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`.trim() })),
    };
  }

  @Get('crm/summary')
  @RequirePermissions('leads.read')
  summary(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('assigned_to') assignedTo?: string,
  ) {
    return this.sales.dashboardSummary(dateFrom, dateTo, assignedTo);
  }

  @Get('leads/pipeline')
  @RequirePermissions('leads.read')
  pipeline() {
    return this.sales.pipeline();
  }

  @Get('followups')
  @RequirePermissions('leads.read')
  followups(@Query('bucket') bucket?: 'today' | 'overdue' | 'tomorrow' | 'all' | 'done') {
    return this.sales.followups(bucket ?? 'today');
  }

  @Post('followups')
  @RequirePermissions('leads.update')
  createFollowup(@Body() dto: CreateFollowupDto, @CurrentUser() user: AuthUser) {
    return this.sales.createFollowup(dto, user.userId);
  }

  @Patch('followups/:id')
  @RequirePermissions('leads.update')
  updateFollowup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFollowupDto) {
    return this.sales.updateFollowup(id, dto);
  }

  @Post('leads/bulk-assign')
  @RequirePermissions('leads.update')
  bulkAssign(@Body() dto: BulkAssignDto) {
    return this.sales.bulkAssign(dto);
  }

  // ---- leads collection ----
  @Get('leads')
  @RequirePermissions('leads.read')
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('training_id') trainingId?: string,
    @Query('source') source?: string,
    @Query('assigned_to') assignedTo?: string,
    @Query('min_score') minScore?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sales.listLeads({
      q,
      status,
      priority,
      trainingId,
      source,
      assignedTo,
      minScore: minScore ? Number(minScore) : undefined,
      dateFrom,
      dateTo,
      sort,
      order,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('leads')
  @RequirePermissions('leads.create')
  create(@Body() dto: CreateSalesLeadDto, @CurrentUser() user: AuthUser) {
    return this.sales.createLead(dto, user.userId);
  }

  // ---- single lead ----
  @Get('leads/:id/activities')
  @RequirePermissions('leads.read')
  activities(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.listActivities(id);
  }

  @Post('leads/:id/activities')
  @RequirePermissions('leads.update')
  addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddLeadActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.addActivity(id, dto.type, dto.title, dto.body, user.userId);
  }

  @Patch('leads/:id/column')
  @RequirePermissions('leads.update')
  moveColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveLeadColumnDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.moveColumn(id, dto.column, user.userId);
  }

  @Post('leads/:id/convert')
  @RequirePermissions('leads.convert')
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { groupId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.crm.convert(id, { groupId: dto?.groupId }, user.userId);
  }

  @Get('leads/:id')
  @RequirePermissions('leads.read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.getLead(id);
  }

  @Patch('leads/:id')
  @RequirePermissions('leads.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.updateLead(id, dto, user.userId);
  }

  @Delete('leads/:id')
  @RequirePermissions('leads.delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.deleteLead(id);
  }
}
