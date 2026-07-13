import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { FinanceService } from './finance.service';

class CreateRunDto {
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;
}

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  @Get('runs')
  @RequirePermissions('finance.payroll.read')
  runs() {
    return this.prisma.scoped.payrollRun.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { period: 'desc' },
    });
  }

  @Get('runs/:id')
  @RequirePermissions('finance.payroll.read')
  async run(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.prisma.scoped.payrollRun.findFirst({
      where: { id },
      include: { items: true },
    });
    if (!run) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Run not found' });
    const teacherIds = run.items.map((i) => i.teacherId).filter((t): t is string => !!t);
    const teachers = await this.prisma.scoped.teacher.findMany({
      where: { id: { in: teacherIds } },
    });
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: teachers.map((t) => t.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));
    const tMap = new Map(teachers.map((t) => [t.id, uMap.get(t.userId)]));
    return {
      ...run,
      items: run.items.map((i) => ({
        ...i,
        teacherName: i.teacherId
          ? `${tMap.get(i.teacherId)?.firstName ?? ''} ${tMap.get(i.teacherId)?.lastName ?? ''}`.trim()
          : null,
      })),
    };
  }

  /**
   * Computes a payroll run for a period from teacher rates × done lessons.
   * per_lesson: rate × lessons; per_student: rate × attendance-present;
   * fixed_monthly: flat; revenue_pct → Phase 6 (needs revenue attribution).
   */
  @Post('runs')
  @RequirePermissions('finance.payroll.manage')
  async createRun(@Body() dto: CreateRunDto) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.scoped.payrollRun.findFirst({
      where: { period: dto.period },
    });
    if (existing) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Run already exists for period' });
    }
    const [yearS, monthS] = dto.period.split('-');
    const from = new Date(Date.UTC(Number(yearS), Number(monthS) - 1, 1));
    const to = new Date(Date.UTC(Number(yearS), Number(monthS), 1));

    const teachers = await this.prisma.scoped.teacher.findMany({
      where: { deletedAt: null },
      include: { rates: true },
    });

    const run = await this.prisma.scoped.payrollRun.create({
      data: { tenantId, period: dto.period },
    });

    let grandTotal = 0;
    for (const teacher of teachers) {
      const lessons = await this.prisma.scoped.lesson.findMany({
        where: {
          teacherId: teacher.id,
          startAt: { gte: from, lt: to },
          status: 'done',
        },
        include: { attendance: { where: { status: { in: ['present', 'late'] } } }, group: true },
      });
      if (lessons.length === 0 && teacher.rates.length === 0) continue;

      let lessonPay = 0;
      let base = 0;
      const detail: Record<string, unknown> = { lessons: lessons.length };

      for (const rate of teacher.rates) {
        const applicable = rate.courseId
          ? lessons.filter((l) => l.group.courseId === rate.courseId)
          : lessons;
        switch (rate.type) {
          case 'per_lesson':
            lessonPay += rate.amount * applicable.length;
            break;
          case 'per_student':
            lessonPay += rate.amount * applicable.reduce((s, l) => s + l.attendance.length, 0);
            break;
          case 'fixed_monthly':
            base += rate.amount;
            break;
        }
      }
      const total = base + lessonPay;
      if (total === 0) continue;
      grandTotal += total;
      await this.prisma.scoped.payrollItem.create({
        data: {
          tenantId,
          runId: run.id,
          teacherId: teacher.id,
          userId: teacher.userId,
          base,
          lessonPay,
          total,
          detail,
        },
      });
    }
    await this.prisma.scoped.payrollRun.update({
      where: { id: run.id },
      data: { total: grandTotal },
    });
    return { id: run.id, total: grandTotal };
  }

  @Post('runs/:id/approve')
  @RequirePermissions('finance.payroll.manage')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.payrollRun.updateMany({
      where: { id, status: 'draft' },
      data: { status: 'approved' },
    });
    return { ok: true };
  }

  @Post('runs/:id/pay')
  @RequirePermissions('finance.payroll.manage')
  async pay(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.prisma.scoped.payrollRun.findFirst({ where: { id } });
    if (!run) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Run not found' });
    if (run.status !== 'approved') {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Run must be approved first' });
    }
    const tenantId = requireTenantId();
    const cashAccountId = await this.finance.ensureDefaultAccount();
    await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          tenantId,
          cashAccountId,
          type: 'payroll',
          amount: run.total,
          category: 'payroll',
          entityType: 'payroll_run',
          entityId: run.id,
        },
      }),
      this.prisma.payrollRun.update({ where: { id }, data: { status: 'paid' } }),
    ]);
    return { ok: true };
  }
}
