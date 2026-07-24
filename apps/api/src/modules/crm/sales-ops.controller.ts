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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { sendBrandedPdf, sendBrandedXlsx } from '../../common/export/branded-export';
import { SalesOpsService } from './sales-ops.service';
import {
  AddTeamMemberDto,
  CreateLeadPaymentDto,
  UpdateLeadPaymentDto,
  UpdateTeamMemberDto,
} from './dto/sales.dto';

@ApiTags('sales-crm')
@ApiBearerAuth()
@Controller()
export class SalesOpsController {
  constructor(private readonly ops: SalesOpsService) {}

  // ===== Lead payments =====
  @Get('lead-payments')
  @RequirePermissions('leads.read')
  listPayments(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.listPayments({
      status,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('lead-payments')
  @RequirePermissions('leads.settings')
  createPayment(@Body() dto: CreateLeadPaymentDto, @CurrentUser() user: AuthUser) {
    return this.ops.createPayment(dto, user.userId);
  }

  @Patch('lead-payments/:id')
  @RequirePermissions('leads.settings')
  updatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.updatePayment(id, dto, user.userId);
  }

  @Delete('lead-payments/:id')
  @RequirePermissions('leads.settings')
  deletePayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.deletePayment(id);
  }

  // ===== Sales team =====
  @Get('sales/team')
  @RequirePermissions('leads.read')
  team() {
    return this.ops.team();
  }

  @Post('sales/team')
  @RequirePermissions('leads.settings')
  addTeamMember(@Body() dto: AddTeamMemberDto) {
    return this.ops.addTeamMember(dto);
  }

  // ===== Trainings (sales view of the course catalog) =====
  @Get('sales/trainings')
  @RequirePermissions('leads.read')
  trainings() {
    return this.ops.trainings();
  }

  @Patch('sales/team/:userId')
  @RequirePermissions('leads.settings')
  updateTeamMember(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateTeamMemberDto) {
    return this.ops.updateTeamMember(userId, dto.bonusRate);
  }

  // ===== Notifications (live counts) =====
  @Get('sales/notifications')
  @RequirePermissions('leads.read')
  notifications() {
    return this.ops.notifications();
  }

  // ===== Reports =====
  @Get('sales/reports')
  @RequirePermissions('leads.read')
  reports(@Query('date_from') dateFrom?: string, @Query('date_to') dateTo?: string) {
    return this.ops.reportsOverview(dateFrom, dateTo);
  }

  @Get('sales/reports/export.csv')
  @RequirePermissions('leads.settings')
  async exportReports(
    @Res() res: Response,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const csv = await this.ops.exportReportsCsv(dateFrom, dateTo);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
    res.send(csv);
  }

  @Get('sales/reports/export.xlsx')
  @RequirePermissions('leads.settings')
  async exportReportsXlsx(
    @Res() res: Response,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const { columns, rows } = await this.ops.exportReportsData(dateFrom, dateTo);
    await sendBrandedXlsx(res, { filename: 'sales-report', reportName: 'Satış hesabatı', columns, rows });
  }

  @Get('sales/reports/export.pdf')
  @RequirePermissions('leads.settings')
  async exportReportsPdf(
    @Res() res: Response,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const { columns, rows } = await this.ops.exportReportsData(dateFrom, dateTo);
    sendBrandedPdf(res, { filename: 'sales-report', reportName: 'Satış hesabatı', columns, rows });
  }

  @Get('sales/leads/export.csv')
  @RequirePermissions('leads.settings')
  async exportLeads(@Res() res: Response) {
    const csv = await this.ops.exportLeadsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  }

  @Get('sales/leads/export.xlsx')
  @RequirePermissions('leads.settings')
  async exportLeadsXlsx(@Res() res: Response) {
    const { columns, rows } = await this.ops.exportLeadsData();
    await sendBrandedXlsx(res, { filename: 'leads', reportName: 'Leadlər', columns, rows });
  }

  @Get('sales/leads/export.pdf')
  @RequirePermissions('leads.settings')
  async exportLeadsPdf(@Res() res: Response) {
    const { columns, rows } = await this.ops.exportLeadsData();
    sendBrandedPdf(res, { filename: 'leads', reportName: 'Leadlər', columns, rows });
  }
}
