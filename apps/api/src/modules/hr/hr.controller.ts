import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class CreateEmployeeDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;

  @IsOptional()
  @IsIn(['full_time', 'part_time', 'contract'])
  contractType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryQepik?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;
}

class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;

  @IsOptional()
  @IsIn(['full_time', 'part_time', 'contract'])
  contractType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryQepik?: number;

  @IsOptional()
  @IsDateString()
  firedAt?: string;
}

class LeaveRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsIn(['vacation', 'sick', 'unpaid', 'other'])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags('hr')
@ApiBearerAuth()
@Controller()
export class HrController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- employees ----------

  @Get('employees')
  @RequirePermissions('hr.employees.read')
  async employees() {
    const employees = await this.prisma.scoped.employee.findMany({
      where: { firedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: employees.map((e) => e.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));
    return employees.map((e) => ({ ...e, user: uMap.get(e.userId) ?? null }));
  }

  @Post('employees')
  @RequirePermissions('hr.employees.manage')
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    const user = await this.prisma.scoped.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    const existing = await this.prisma.scoped.employee.findFirst({ where: { userId: dto.userId } });
    if (existing) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'User is already an employee' });
    }
    return this.prisma.scoped.employee.create({
      data: {
        tenantId: requireTenantId(),
        userId: dto.userId,
        position: dto.position,
        contractType: dto.contractType,
        salaryQepik: dto.salaryQepik ?? 0,
        branchId: dto.branchId,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : new Date(),
      },
    });
  }

  @Patch('employees/:id')
  @RequirePermissions('hr.employees.manage')
  async updateEmployee(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    const emp = await this.prisma.scoped.employee.findFirst({ where: { id } });
    if (!emp) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    return this.prisma.scoped.employee.update({
      where: { id },
      data: {
        position: dto.position ?? undefined,
        contractType: dto.contractType ?? undefined,
        salaryQepik: dto.salaryQepik ?? undefined,
        firedAt: dto.firedAt ? new Date(dto.firedAt) : undefined,
      },
    });
  }

  // ---------- leave ----------

  @Get('leave-requests')
  @RequirePermissions('hr.leave.read')
  async leaveRequests(@Query('status') status?: string) {
    const requests = await this.prisma.scoped.leaveRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const empIds = requests.map((r) => r.employeeId);
    const employees = await this.prisma.scoped.employee.findMany({
      where: { id: { in: empIds } },
    });
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: employees.map((e) => e.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));
    const eMap = new Map(employees.map((e) => [e.id, uMap.get(e.userId)]));
    return requests.map((r) => {
      const u = eMap.get(r.employeeId);
      return { ...r, employeeName: u ? `${u.firstName} ${u.lastName}` : '—' };
    });
  }

  @Post('leave-requests')
  @RequirePermissions('hr.leave.read')
  createLeave(@Body() dto: LeaveRequestDto) {
    return this.prisma.scoped.leaveRequest.create({
      data: {
        tenantId: requireTenantId(),
        employeeId: dto.employeeId,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        type: dto.type,
        reason: dto.reason,
      },
    });
  }

  @Post('leave-requests/:id/approve')
  @RequirePermissions('hr.leave.approve')
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.decide(id, 'approved', user.userId);
  }

  @Post('leave-requests/:id/reject')
  @RequirePermissions('hr.leave.approve')
  async reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.decide(id, 'rejected', user.userId);
  }

  private async decide(id: string, status: string, approverId: string) {
    const req = await this.prisma.scoped.leaveRequest.findFirst({ where: { id } });
    if (!req) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found' });
    if (req.status !== 'pending') {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Already decided' });
    }
    return this.prisma.scoped.leaveRequest.update({
      where: { id },
      data: { status, approverId, decidedAt: new Date() },
    });
  }
}
