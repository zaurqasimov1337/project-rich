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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { calcAzPayroll } from '@edusphere/shared';
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
  @IsIn(['full_time', 'part_time', 'contract', 'freelance'])
  contractType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryQepik?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusQepik?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

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
  @IsIn(['full_time', 'part_time', 'contract', 'freelance'])
  contractType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryQepik?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusQepik?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  @IsOptional()
  @IsDateString()
  firedAt?: string;

  // ---- HCM Phase 1 fields ----

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  idCardNumber?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergencyContact?: string;

  @IsOptional()
  @IsIn(['tam_stat', 'yarim_stat', 'saatliq', 'muqavileli', 'freelancer'])
  workType?: string;

  @IsOptional()
  @IsIn(['aktiv', 'sinaq', 'mezuniyyetde', 'xestelik', 'ezamiyyetde', 'cixib'])
  hrStatus?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsIn(['private_nonoil', 'state_oil'])
  sector?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  exemptionQepik?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unionPct?: number;

  /** Optional reason recorded in SalaryChange when salaryQepik changes. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  salaryChangeReason?: string;
}

const CONTRACT_TYPES = ['emek', 'nda', 'daxili_qaydalar', 'remote', 'diger'] as const;
const CONTRACT_STATUSES = ['aktiv', 'imzalanib', 'bitib', 'legv'] as const;

class CreateContractDto {
  @IsIn(CONTRACT_TYPES as unknown as string[])
  type!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateContractDto {
  @IsOptional()
  @IsIn(CONTRACT_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

const DEPARTMENT_KINDS = ['departament', 'sobe', 'bolme'] as const;

/** Annual paid vacation allowance (days) — AZ Labour Code baseline. */
const ANNUAL_LEAVE_ALLOWANCE = 21;

class CreateDepartmentDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(DEPARTMENT_KINDS as unknown as string[])
  kind?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(DEPARTMENT_KINDS as unknown as string[])
  kind?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
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

// ---- HCM Phase 2A DTOs ----

/** Workday starts at 09:00 — check-ins after this accrue lateMinutes. */
const WORKDAY_START_MINUTES = 9 * 60;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const ASSET_CATEGORIES = ['texnika', 'kart', 'acar', 'sim', 'diger'] as const;
const DOCUMENT_TYPES = ['sexsiyyet', 'cv', 'diplom', 'sertifikat', 'muqavile', 'siyaset', 'diger'] as const;
const DOCUMENT_STATUSES = ['yuklenib', 'imzalanib', 'qebul_edilib', 'bitib'] as const;

class AttendanceCheckDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  date!: string;

  /** HH:mm (24h) */
  @IsOptional()
  @Matches(TIME_RE)
  checkIn?: string;

  /** HH:mm (24h) */
  @IsOptional()
  @Matches(TIME_RE)
  checkOut?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateAttendanceDto {
  @IsOptional()
  @Matches(TIME_RE)
  checkIn?: string;

  @IsOptional()
  @Matches(TIME_RE)
  checkOut?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateAssetDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(ASSET_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serial?: string;

  @IsOptional()
  @IsDateString()
  givenAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  givenBy?: string;

  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateAssetDto extends CreateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare name: string;
}

class CreateDocumentDto {
  @IsIn(DOCUMENT_TYPES as unknown as string[])
  type!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fileUrl?: string;

  @IsOptional()
  @IsIn(DOCUMENT_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateDocumentDto extends CreateDocumentDto {
  @IsOptional()
  @IsIn(DOCUMENT_TYPES as unknown as string[])
  declare type: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare title: string;
}

// ---- HCM Phase 2B DTOs (performance) ----

const REVIEW_TYPES = ['kpi', 'okr', 'manager', 'p360'] as const;
const GOAL_STATUSES = ['davam_edir', 'catdi', 'catmadi'] as const;

class CreateReviewDto {
  @IsString()
  @MaxLength(20)
  period!: string;

  @IsOptional()
  @IsIn(REVIEW_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;
}

class UpdateReviewDto extends CreateReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  declare period: string;
}

class CreateGoalDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  metric?: string;

  @IsOptional()
  @IsNumber()
  target?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsIn(GOAL_STATUSES as unknown as string[])
  status?: string;
}

class UpdateGoalDto extends CreateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare title: string;
}

/** Combines a YYYY-MM-DD date with HH:mm into a UTC DateTime. */
function combineDateTime(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00.000Z`);
}

function lateMinutesOf(hhmm: string): number {
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(3, 5));
  return Math.max(0, h * 60 + m - WORKDAY_START_MINUTES);
}

@ApiTags('hr')
@ApiBearerAuth()
@Controller()
export class HrController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- departments (org structure) ----------

  @Get('departments')
  @RequirePermissions('hr.employees.read')
  async departments() {
    const departments = await this.prisma.scoped.department.findMany({
      orderBy: [{ createdAt: 'asc' }],
    });
    const ids = departments.map((d) => d.id);
    const [employeeCounts, teacherCounts] = await Promise.all([
      this.prisma.scoped.employee.groupBy({
        by: ['departmentId'],
        where: { departmentId: { in: ids }, firedAt: null },
        _count: { _all: true },
      }),
      this.prisma.scoped.teacher.groupBy({
        by: ['departmentId'],
        where: { departmentId: { in: ids }, deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const eMap = new Map(employeeCounts.map((c) => [c.departmentId, c._count._all]));
    const tMap = new Map(teacherCounts.map((c) => [c.departmentId, c._count._all]));
    return departments.map((d) => ({
      ...d,
      employeeCount: eMap.get(d.id) ?? 0,
      teacherCount: tMap.get(d.id) ?? 0,
    }));
  }

  @Post('departments')
  @RequirePermissions('hr.employees.manage')
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    if (dto.parentId) await this.requireDepartment(dto.parentId, 'Parent department not found');
    return this.prisma.scoped.department.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name.trim(),
        kind: dto.kind ?? 'departament',
        parentId: dto.parentId,
        note: dto.note,
      },
    });
  }

  @Patch('departments/:id')
  @RequirePermissions('hr.employees.manage')
  async updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    await this.requireDepartment(id, 'Department not found');
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException({ code: 'CONFLICT', message: 'Department cannot be its own parent' });
      }
      await this.requireDepartment(dto.parentId, 'Parent department not found');
    }
    return this.prisma.scoped.department.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        kind: dto.kind ?? undefined,
        parentId: dto.parentId ?? undefined,
        note: dto.note ?? undefined,
      },
    });
  }

  @Delete('departments/:id')
  @RequirePermissions('hr.employees.manage')
  async deleteDepartment(@Param('id', ParseUUIDPipe) id: string) {
    await this.requireDepartment(id, 'Department not found');
    const [children, employees, teachers] = await Promise.all([
      this.prisma.scoped.department.count({ where: { parentId: id } }),
      this.prisma.scoped.employee.count({ where: { departmentId: id } }),
      this.prisma.scoped.teacher.count({ where: { departmentId: id, deletedAt: null } }),
    ]);
    if (children > 0 || employees > 0 || teachers > 0) {
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'Bu bölmənin alt bölmələri və ya təyin olunmuş işçiləri var',
      });
    }
    await this.prisma.scoped.department.delete({ where: { id } });
    return { ok: true };
  }

  private async requireDepartment(id: string, message: string) {
    const dep = await this.prisma.scoped.department.findFirst({ where: { id } });
    if (!dep) throw new NotFoundException({ code: 'NOT_FOUND', message });
    return dep;
  }

  // ---------- employees ----------

  @Get('employees')
  @RequirePermissions('hr.employees.read')
  async employees() {
    const employees = await this.prisma.scoped.employee.findMany({
      where: { firedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const depIds = [...new Set(employees.map((e) => e.departmentId).filter((d): d is string => !!d))];
    const [users, departments] = await Promise.all([
      this.prisma.scoped.user.findMany({
        where: { id: { in: employees.map((e) => e.userId) } },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      }),
      depIds.length
        ? this.prisma.scoped.department.findMany({
            where: { id: { in: depIds } },
            select: { id: true, name: true, kind: true },
          })
        : Promise.resolve([]),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const dMap = new Map(departments.map((d) => [d.id, d]));
    return employees.map((e) => ({
      ...e,
      user: uMap.get(e.userId) ?? null,
      department: e.departmentId ? (dMap.get(e.departmentId) ?? null) : null,
    }));
  }

  @Get('employees/:id')
  @RequirePermissions('hr.employees.read')
  async employeeProfile(@Param('id', ParseUUIDPipe) id: string) {
    const emp = await this.prisma.scoped.employee.findFirst({ where: { id } });
    if (!emp) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });

    const year = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [user, department, contracts, salaryChanges, approvedLeaves, manager, assets, documents, reviews, goals] = await Promise.all([
      this.prisma.scoped.user.findFirst({
        where: { id: emp.userId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      }),
      emp.departmentId
        ? this.prisma.scoped.department.findFirst({
            where: { id: emp.departmentId },
            select: { id: true, name: true, kind: true, parentId: true },
          })
        : Promise.resolve(null),
      this.prisma.scoped.employeeContract.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scoped.salaryChange.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scoped.leaveRequest.findMany({
        where: {
          employeeId: id,
          status: 'approved',
          type: 'vacation',
          fromDate: { lt: yearEnd },
          toDate: { gte: yearStart },
        },
      }),
      emp.managerId
        ? this.prisma.scoped.employee.findFirst({ where: { id: emp.managerId } })
        : Promise.resolve(null),
      this.prisma.scoped.employeeAsset.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scoped.employeeDocument.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scoped.performanceReview.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scoped.performanceGoal.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Approved vacation days that fall inside the current year (inclusive).
    const DAY = 24 * 60 * 60 * 1000;
    const used = approvedLeaves.reduce((sum, r) => {
      const from = Math.max(r.fromDate.getTime(), yearStart.getTime());
      const to = Math.min(r.toDate.getTime(), yearEnd.getTime() - DAY);
      return sum + Math.max(0, Math.round((to - from) / DAY) + 1);
    }, 0);

    // Resolve approver names for salary changes + manager name.
    const approverIds = [
      ...new Set(
        [
          ...salaryChanges.map((s) => s.approvedBy),
          ...reviews.map((r) => r.reviewerId),
        ].filter((a): a is string => !!a),
      ),
    ];
    const extraUserIds = [...approverIds, ...(manager ? [manager.userId] : [])];
    const extraUsers = extraUserIds.length
      ? await this.prisma.scoped.user.findMany({
          where: { id: { in: extraUserIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameOf = (uid: string | null | undefined) => {
      if (!uid) return null;
      const u = extraUsers.find((x) => x.id === uid);
      return u ? `${u.firstName} ${u.lastName}` : null;
    };

    const payroll = calcAzPayroll({
      grossQepik: emp.salaryQepik + emp.bonusQepik,
      sector: emp.sector === 'state_oil' ? 'state_oil' : 'private_nonoil',
      exemptionQepik: emp.exemptionQepik,
      unionPct: emp.unionPct,
    });

    return {
      ...emp,
      user,
      department,
      manager: manager ? { id: manager.id, name: nameOf(manager.userId) } : null,
      contracts,
      assets,
      documents,
      salaryChanges: salaryChanges.map((s) => ({ ...s, approvedByName: nameOf(s.approvedBy) })),
      reviews: reviews.map((r) => ({ ...r, reviewerName: nameOf(r.reviewerId) })),
      goals,
      leave: { allowance: ANNUAL_LEAVE_ALLOWANCE, used, remaining: Math.max(0, ANNUAL_LEAVE_ALLOWANCE - used) },
      payroll,
    };
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
    if (dto.departmentId) await this.requireDepartment(dto.departmentId, 'Department not found');
    return this.prisma.scoped.employee.create({
      data: {
        tenantId: requireTenantId(),
        userId: dto.userId,
        position: dto.position,
        contractType: dto.contractType,
        salaryQepik: dto.salaryQepik ?? 0,
        bonusQepik: dto.bonusQepik ?? 0,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        note: dto.note,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : new Date(),
      },
    });
  }

  @Patch('employees/:id')
  @RequirePermissions('hr.employees.manage')
  async updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    const emp = await this.prisma.scoped.employee.findFirst({ where: { id } });
    if (!emp) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    if (dto.departmentId) await this.requireDepartment(dto.departmentId, 'Department not found');
    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException({ code: 'CONFLICT', message: 'Employee cannot be their own manager' });
      }
      const mgr = await this.prisma.scoped.employee.findFirst({ where: { id: dto.managerId } });
      if (!mgr) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Manager not found' });
    }

    const salaryChanged = dto.salaryQepik !== undefined && dto.salaryQepik !== emp.salaryQepik;

    const updated = await this.prisma.scoped.employee.update({
      where: { id },
      data: {
        position: dto.position ?? undefined,
        contractType: dto.contractType ?? undefined,
        salaryQepik: dto.salaryQepik ?? undefined,
        bonusQepik: dto.bonusQepik ?? undefined,
        departmentId: dto.departmentId ?? undefined,
        note: dto.note ?? undefined,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        firedAt: dto.firedAt ? new Date(dto.firedAt) : undefined,
        employeeNo: dto.employeeNo ?? undefined,
        pin: dto.pin ?? undefined,
        idCardNumber: dto.idCardNumber ?? undefined,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        address: dto.address ?? undefined,
        maritalStatus: dto.maritalStatus ?? undefined,
        emergencyContact: dto.emergencyContact ?? undefined,
        workType: dto.workType ?? undefined,
        hrStatus: dto.hrStatus ?? undefined,
        managerId: dto.managerId ?? undefined,
        sector: dto.sector ?? undefined,
        exemptionQepik: dto.exemptionQepik ?? undefined,
        unionPct: dto.unionPct ?? undefined,
      },
    });

    if (salaryChanged) {
      await this.prisma.scoped.salaryChange.create({
        data: {
          tenantId: requireTenantId(),
          employeeId: id,
          oldQepik: emp.salaryQepik,
          newQepik: dto.salaryQepik!,
          reason: dto.salaryChangeReason,
          approvedBy: user.userId,
          effectiveAt: new Date(),
        },
      });
    }

    return updated;
  }

  // ---------- employee contracts ----------

  @Post('employees/:id/contracts')
  @RequirePermissions('hr.employees.manage')
  async createContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    const emp = await this.prisma.scoped.employee.findFirst({ where: { id } });
    if (!emp) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    return this.prisma.scoped.employeeContract.create({
      data: {
        tenantId: requireTenantId(),
        employeeId: id,
        type: dto.type,
        title: dto.title.trim(),
        status: dto.status ?? 'aktiv',
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        approvedBy: user.userId,
        note: dto.note,
      },
    });
  }

  @Patch('employee-contracts/:id')
  @RequirePermissions('hr.employees.manage')
  async updateContract(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    const contract = await this.prisma.scoped.employeeContract.findFirst({ where: { id } });
    if (!contract) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Contract not found' });
    return this.prisma.scoped.employeeContract.update({
      where: { id },
      data: {
        type: dto.type ?? undefined,
        title: dto.title?.trim() ?? undefined,
        status: dto.status ?? undefined,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        note: dto.note ?? undefined,
      },
    });
  }

  @Delete('employee-contracts/:id')
  @RequirePermissions('hr.employees.manage')
  async deleteContract(@Param('id', ParseUUIDPipe) id: string) {
    const contract = await this.prisma.scoped.employeeContract.findFirst({ where: { id } });
    if (!contract) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Contract not found' });
    await this.prisma.scoped.employeeContract.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- attendance (HCM Phase 2A) ----------

  private async requireEmployee(id: string) {
    const emp = await this.prisma.scoped.employee.findFirst({ where: { id } });
    if (!emp) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    return emp;
  }

  @Get('hr/attendance')
  @RequirePermissions('hr.employees.read')
  async attendanceDay(@Query('date') date?: string) {
    const d = date && DATE_RE.test(date) ? date : new Date().toISOString().slice(0, 10);
    const day = new Date(`${d}T00:00:00.000Z`);

    const [employees, records] = await Promise.all([
      this.prisma.scoped.employee.findMany({
        where: { firedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scoped.employeeAttendance.findMany({ where: { date: day } }),
    ]);
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: employees.map((e) => e.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const rMap = new Map(records.map((r) => [r.employeeId, r]));

    return {
      date: d,
      rows: employees.map((e) => ({
        employeeId: e.id,
        employeeName: uMap.get(e.userId) ?? '—',
        position: e.position,
        hrStatus: e.hrStatus,
        record: rMap.get(e.id) ?? null,
      })),
    };
  }

  @Get('hr/attendance/stats')
  @RequirePermissions('hr.employees.read')
  async attendanceStats(@Query('month') month?: string) {
    const m = month && MONTH_RE.test(month) ? month : new Date().toISOString().slice(0, 7);
    const from = new Date(`${m}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));

    const [employees, records] = await Promise.all([
      this.prisma.scoped.employee.findMany({
        where: { firedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scoped.employeeAttendance.findMany({
        where: { date: { gte: from, lt: to } },
      }),
    ]);
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: employees.map((e) => e.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const agg = new Map<string, { daysPresent: number; totalLateMinutes: number }>();
    for (const r of records) {
      const a = agg.get(r.employeeId) ?? { daysPresent: 0, totalLateMinutes: 0 };
      if (r.checkIn) a.daysPresent += 1;
      a.totalLateMinutes += r.lateMinutes;
      agg.set(r.employeeId, a);
    }

    return {
      month: m,
      rows: employees.map((e) => ({
        employeeId: e.id,
        employeeName: uMap.get(e.userId) ?? '—',
        position: e.position,
        daysPresent: agg.get(e.id)?.daysPresent ?? 0,
        totalLateMinutes: agg.get(e.id)?.totalLateMinutes ?? 0,
      })),
    };
  }

  @Post('hr/attendance/check')
  @RequirePermissions('hr.employees.manage')
  async attendanceCheck(@Body() dto: AttendanceCheckDto) {
    if (!dto.checkIn && !dto.checkOut && dto.note === undefined) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'checkIn, checkOut or note required' });
    }
    await this.requireEmployee(dto.employeeId);
    const dateStr = dto.date.slice(0, 10);
    const day = new Date(`${dateStr}T00:00:00.000Z`);
    const checkIn = dto.checkIn ? combineDateTime(dateStr, dto.checkIn) : undefined;
    const checkOut = dto.checkOut ? combineDateTime(dateStr, dto.checkOut) : undefined;
    const lateMinutes = dto.checkIn ? lateMinutesOf(dto.checkIn) : undefined;

    return this.prisma.scoped.employeeAttendance.upsert({
      where: {
        tenantId_employeeId_date: {
          tenantId: requireTenantId(),
          employeeId: dto.employeeId,
          date: day,
        },
      },
      create: {
        tenantId: requireTenantId(),
        employeeId: dto.employeeId,
        date: day,
        checkIn,
        checkOut,
        lateMinutes: lateMinutes ?? 0,
        note: dto.note,
      },
      update: {
        checkIn: checkIn ?? undefined,
        checkOut: checkOut ?? undefined,
        lateMinutes: lateMinutes ?? undefined,
        note: dto.note ?? undefined,
      },
    });
  }

  @Patch('hr/attendance/:id')
  @RequirePermissions('hr.employees.manage')
  async updateAttendance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttendanceDto) {
    const rec = await this.prisma.scoped.employeeAttendance.findFirst({ where: { id } });
    if (!rec) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Attendance record not found' });
    const dateStr = rec.date.toISOString().slice(0, 10);
    return this.prisma.scoped.employeeAttendance.update({
      where: { id },
      data: {
        checkIn: dto.checkIn ? combineDateTime(dateStr, dto.checkIn) : undefined,
        checkOut: dto.checkOut ? combineDateTime(dateStr, dto.checkOut) : undefined,
        lateMinutes: dto.checkIn ? lateMinutesOf(dto.checkIn) : undefined,
        note: dto.note ?? undefined,
      },
    });
  }

  // ---------- employee assets (HCM Phase 2A) ----------

  @Get('employees/:id/assets')
  @RequirePermissions('hr.employees.read')
  async employeeAssets(@Param('id', ParseUUIDPipe) id: string) {
    await this.requireEmployee(id);
    return this.prisma.scoped.employeeAsset.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('employees/:id/assets')
  @RequirePermissions('hr.employees.manage')
  async createAsset(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAssetDto) {
    await this.requireEmployee(id);
    return this.prisma.scoped.employeeAsset.create({
      data: {
        tenantId: requireTenantId(),
        employeeId: id,
        name: dto.name.trim(),
        category: dto.category,
        serial: dto.serial,
        givenAt: dto.givenAt ? new Date(dto.givenAt) : undefined,
        givenBy: dto.givenBy,
        returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : undefined,
        note: dto.note,
      },
    });
  }

  @Patch('employee-assets/:id')
  @RequirePermissions('hr.employees.manage')
  async updateAsset(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto) {
    const asset = await this.prisma.scoped.employeeAsset.findFirst({ where: { id } });
    if (!asset) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Asset not found' });
    return this.prisma.scoped.employeeAsset.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        category: dto.category ?? undefined,
        serial: dto.serial ?? undefined,
        givenAt: dto.givenAt ? new Date(dto.givenAt) : undefined,
        givenBy: dto.givenBy ?? undefined,
        returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : undefined,
        note: dto.note ?? undefined,
      },
    });
  }

  @Delete('employee-assets/:id')
  @RequirePermissions('hr.employees.manage')
  async deleteAsset(@Param('id', ParseUUIDPipe) id: string) {
    const asset = await this.prisma.scoped.employeeAsset.findFirst({ where: { id } });
    if (!asset) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Asset not found' });
    await this.prisma.scoped.employeeAsset.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- employee documents (HCM Phase 2A) ----------

  @Get('employees/:id/documents')
  @RequirePermissions('hr.employees.read')
  async employeeDocuments(@Param('id', ParseUUIDPipe) id: string) {
    await this.requireEmployee(id);
    return this.prisma.scoped.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('employees/:id/documents')
  @RequirePermissions('hr.employees.manage')
  async createDocument(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDocumentDto) {
    await this.requireEmployee(id);
    const status = dto.status ?? 'yuklenib';
    return this.prisma.scoped.employeeDocument.create({
      data: {
        tenantId: requireTenantId(),
        employeeId: id,
        type: dto.type,
        title: dto.title.trim(),
        fileUrl: dto.fileUrl,
        status,
        acceptedAt: status === 'qebul_edilib' ? new Date() : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        note: dto.note,
      },
    });
  }

  @Patch('employee-documents/:id')
  @RequirePermissions('hr.employees.manage')
  async updateDocument(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
    const doc = await this.prisma.scoped.employeeDocument.findFirst({ where: { id } });
    if (!doc) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Document not found' });
    const becomesAccepted =
      dto.status === 'qebul_edilib' && doc.status !== 'qebul_edilib' && !doc.acceptedAt;
    return this.prisma.scoped.employeeDocument.update({
      where: { id },
      data: {
        type: dto.type ?? undefined,
        title: dto.title?.trim() ?? undefined,
        fileUrl: dto.fileUrl ?? undefined,
        status: dto.status ?? undefined,
        acceptedAt: becomesAccepted ? new Date() : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        note: dto.note ?? undefined,
      },
    });
  }

  @Delete('employee-documents/:id')
  @RequirePermissions('hr.employees.manage')
  async deleteDocument(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.prisma.scoped.employeeDocument.findFirst({ where: { id } });
    if (!doc) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Document not found' });
    await this.prisma.scoped.employeeDocument.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- performance reviews (HCM Phase 2B) ----------

  @Get('employees/:id/reviews')
  @RequirePermissions('hr.employees.read')
  async employeeReviews(@Param('id', ParseUUIDPipe) id: string) {
    await this.requireEmployee(id);
    return this.prisma.scoped.performanceReview.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('employees/:id/reviews')
  @RequirePermissions('hr.employees.manage')
  async createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.requireEmployee(id);
    return this.prisma.scoped.performanceReview.create({
      data: {
        tenantId: requireTenantId(),
        employeeId: id,
        period: dto.period.trim(),
        type: dto.type ?? 'manager',
        score: dto.score,
        maxScore: dto.maxScore ?? 100,
        summary: dto.summary,
        reviewerId: dto.reviewerId ?? user.userId,
      },
    });
  }

  @Patch('performance-reviews/:id')
  @RequirePermissions('hr.employees.manage')
  async updateReview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewDto) {
    const review = await this.prisma.scoped.performanceReview.findFirst({ where: { id } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Review not found' });
    return this.prisma.scoped.performanceReview.update({
      where: { id },
      data: {
        period: dto.period?.trim() ?? undefined,
        type: dto.type ?? undefined,
        score: dto.score ?? undefined,
        maxScore: dto.maxScore ?? undefined,
        summary: dto.summary ?? undefined,
        reviewerId: dto.reviewerId ?? undefined,
      },
    });
  }

  @Delete('performance-reviews/:id')
  @RequirePermissions('hr.employees.manage')
  async deleteReview(@Param('id', ParseUUIDPipe) id: string) {
    const review = await this.prisma.scoped.performanceReview.findFirst({ where: { id } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Review not found' });
    await this.prisma.scoped.performanceReview.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- performance goals (HCM Phase 2B) ----------

  @Get('employees/:id/goals')
  @RequirePermissions('hr.employees.read')
  async employeeGoals(@Param('id', ParseUUIDPipe) id: string) {
    await this.requireEmployee(id);
    return this.prisma.scoped.performanceGoal.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('employees/:id/goals')
  @RequirePermissions('hr.employees.manage')
  async createGoal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateGoalDto) {
    await this.requireEmployee(id);
    return this.prisma.scoped.performanceGoal.create({
      data: {
        tenantId: requireTenantId(),
        employeeId: id,
        title: dto.title.trim(),
        metric: dto.metric,
        target: dto.target,
        progress: dto.progress ?? 0,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: dto.status ?? 'davam_edir',
      },
    });
  }

  @Patch('performance-goals/:id')
  @RequirePermissions('hr.employees.manage')
  async updateGoal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoalDto) {
    const goal = await this.prisma.scoped.performanceGoal.findFirst({ where: { id } });
    if (!goal) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Goal not found' });
    return this.prisma.scoped.performanceGoal.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        metric: dto.metric ?? undefined,
        target: dto.target ?? undefined,
        progress: dto.progress ?? undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  @Delete('performance-goals/:id')
  @RequirePermissions('hr.employees.manage')
  async deleteGoal(@Param('id', ParseUUIDPipe) id: string) {
    const goal = await this.prisma.scoped.performanceGoal.findFirst({ where: { id } });
    if (!goal) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Goal not found' });
    await this.prisma.scoped.performanceGoal.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- org chart (HCM Phase 2B) ----------

  @Get('hr/org-chart')
  @RequirePermissions('hr.employees.read')
  async orgChart() {
    const employees = await this.prisma.scoped.employee.findMany({
      where: { firedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const depIds = [...new Set(employees.map((e) => e.departmentId).filter((d): d is string => !!d))];
    const [users, departments] = await Promise.all([
      this.prisma.scoped.user.findMany({
        where: { id: { in: employees.map((e) => e.userId) } },
        select: { id: true, firstName: true, lastName: true },
      }),
      depIds.length
        ? this.prisma.scoped.department.findMany({
            where: { id: { in: depIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const uMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const dMap = new Map(departments.map((d) => [d.id, d.name]));
    return employees.map((e) => ({
      id: e.id,
      name: uMap.get(e.userId) ?? '—',
      position: e.position,
      departmentName: e.departmentId ? (dMap.get(e.departmentId) ?? null) : null,
      managerId: e.managerId,
    }));
  }

  // ---------- HR dashboard ----------

  @Get('hr/dashboard')
  @RequirePermissions('hr.employees.read')
  async hrDashboard() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [employees, expiringContracts, expiringDocuments] = await Promise.all([
      this.prisma.scoped.employee.findMany({}),
      this.prisma.scoped.employeeContract.findMany({
        where: {
          expiresAt: { gte: now, lte: in30d },
          status: { in: ['aktiv', 'imzalanib'] },
        },
        orderBy: { expiresAt: 'asc' },
      }),
      this.prisma.scoped.employeeDocument.findMany({
        where: {
          expiresAt: { gte: now, lte: in30d },
          status: { not: 'bitib' },
        },
        orderBy: { expiresAt: 'asc' },
      }),
    ]);

    const active = employees.filter((e) => !e.firedAt && e.hrStatus !== 'cixib');
    const byStatus: Record<string, number> = {};
    for (const e of active) byStatus[e.hrStatus] = (byStatus[e.hrStatus] ?? 0) + 1;

    const hiredThisMonth = employees.filter(
      (e) => e.hiredAt && e.hiredAt >= monthStart && e.hiredAt < nextMonthStart,
    ).length;
    const leftThisMonth = employees.filter(
      (e) => e.firedAt && e.firedAt >= monthStart && e.firedAt < nextMonthStart,
    ).length;

    const month = now.getUTCMonth();
    const birthdayEmployees = active.filter(
      (e) => e.birthDate && e.birthDate.getUTCMonth() === month,
    );

    const userIds = [
      ...new Set([
        ...expiringContracts.map((c) => c.employeeId),
        ...expiringDocuments.map((d) => d.employeeId),
        ...birthdayEmployees.map((e) => e.id),
      ]),
    ];
    const contractEmployees = userIds.length
      ? await this.prisma.scoped.employee.findMany({ where: { id: { in: userIds } } })
      : [];
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: contractEmployees.map((e) => e.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const empName = (employeeId: string) => {
      const e = contractEmployees.find((x) => x.id === employeeId);
      return e ? (uMap.get(e.userId) ?? '—') : '—';
    };

    return {
      activeCount: active.length,
      hiredThisMonth,
      leftThisMonth,
      onProbation: byStatus['sinaq'] ?? 0,
      onLeave: byStatus['mezuniyyetde'] ?? 0,
      sick: byStatus['xestelik'] ?? 0,
      contractsExpiring30d: {
        count: expiringContracts.length,
        list: expiringContracts.map((c) => ({
          id: c.id,
          employeeId: c.employeeId,
          employeeName: empName(c.employeeId),
          title: c.title,
          expiresAt: c.expiresAt,
        })),
      },
      documentsExpiring30d: {
        count: expiringDocuments.length,
        list: expiringDocuments.map((d) => ({
          id: d.id,
          employeeId: d.employeeId,
          employeeName: empName(d.employeeId),
          title: d.title,
          type: d.type,
          expiresAt: d.expiresAt,
        })),
      },
      birthdaysThisMonth: {
        count: birthdayEmployees.length,
        list: birthdayEmployees.map((e) => ({
          employeeId: e.id,
          employeeName: empName(e.id),
          birthDate: e.birthDate,
        })),
      },
      byStatus,
    };
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
