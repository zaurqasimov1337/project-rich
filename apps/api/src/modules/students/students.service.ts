import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { PlanService } from '../../core/plan/plan.service';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import type { CreateStudentDto, UpdateStudentDto } from './dto/students.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly plan: PlanService,
  ) {}

  private async nextCode(): Promise<string> {
    const count = await this.prisma.scoped.student.count();
    return `ST${String(count + 1).padStart(5, '0')}`;
  }

  async list(q: ListQueryDto, filters: { groupId?: string; courseId?: string }) {
    const where = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' as const } },
              { lastName: { contains: q.search, mode: 'insensitive' as const } },
              { phone: { contains: q.search } },
              { code: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.branchId?.length ? { branchId: { in: q.branchId } } : {}),
      ...(filters.groupId
        ? { enrollments: { some: { groupId: filters.groupId, status: 'active' } } }
        : {}),
      ...(filters.courseId
        ? { enrollments: { some: { group: { courseId: filters.courseId }, status: 'active' } } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.student.findMany({
        where,
        include: {
          enrollments: {
            where: { status: 'active' },
            include: { group: { select: { id: true, name: true } } },
          },
        },
        orderBy: q.orderBy('createdAt', ['createdAt', 'firstName', 'lastName', 'code']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.student.count({ where }),
    ]);
    return paginated(
      data.map((s) => ({
        ...s,
        groups: s.enrollments.map((e) => e.group),
        enrollments: undefined,
      })),
      total,
      q,
    );
  }

  async detail(id: string) {
    const student = await this.prisma.scoped.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        enrollments: {
          include: {
            group: {
              select: { id: true, name: true, status: true, course: { select: { name: true } } },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found' });
    return student;
  }

  async attendanceSummary(id: string) {
    const rows = await this.prisma.scoped.attendance.groupBy({
      by: ['status'],
      where: { studentId: id },
      _count: true,
    });
    const recent = await this.prisma.scoped.attendance.findMany({
      where: { studentId: id },
      include: {
        lesson: {
          select: { date: true, startAt: true, group: { select: { name: true } }, topic: true },
        },
      },
      orderBy: { markedAt: 'desc' },
      take: 30,
    });
    return {
      summary: Object.fromEntries(rows.map((r) => [r.status, r._count])),
      recent,
    };
  }

  async grades(id: string) {
    return this.prisma.scoped.examResult.findMany({
      where: { studentId: id },
      include: {
        exam: {
          select: {
            name: true,
            type: true,
            date: true,
            maxScore: true,
            group: { select: { name: true } },
          },
        },
      },
      orderBy: { exam: { date: 'desc' } },
    });
  }

  async create(dto: CreateStudentDto) {
    const activeCount = await this.prisma.scoped.student.count({ where: { deletedAt: null } });
    await this.plan.assertLimit('students', activeCount);
    const student = await this.prisma.scoped.student.create({
      data: {
        tenantId: requireTenantId(),
        code: await this.nextCode(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        address: dto.address,
        parentName: dto.parentName,
        parentPhone: dto.parentPhone,
        branchId: dto.branchId,
        notes: dto.notes,
      },
    });
    this.audit.log({ action: 'create', entityType: 'student', entityId: student.id, after: student });
    return student;
  }

  async update(id: string, dto: UpdateStudentDto) {
    const before = await this.prisma.scoped.student.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found' });
    const student = await this.prisma.scoped.student.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
        phone: dto.phone ?? undefined,
        email: dto.email ?? undefined,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender ?? undefined,
        address: dto.address ?? undefined,
        parentName: dto.parentName ?? undefined,
        parentPhone: dto.parentPhone ?? undefined,
        branchId: dto.branchId ?? undefined,
        status: dto.status ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });
    this.audit.log({ action: 'update', entityType: 'student', entityId: id, before, after: student });
    return student;
  }

  async remove(id: string) {
    const student = await this.prisma.scoped.student.findFirst({ where: { id, deletedAt: null } });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found' });
    await this.prisma.scoped.student.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'archived' },
    });
    await this.prisma.scoped.groupStudent.updateMany({
      where: { studentId: id, status: 'active' },
      data: { status: 'dropped', leftAt: new Date() },
    });
    this.audit.log({ action: 'delete', entityType: 'student', entityId: id, before: student });
    return { ok: true };
  }
}
