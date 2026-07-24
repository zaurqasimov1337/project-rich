import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { PlanService } from '../../core/plan/plan.service';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import type { BrandedColumn } from '../../common/export/branded-export';
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
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                  course: { select: { price: true, pricingModel: true } },
                },
              },
            },
          },
        },
        orderBy: q.orderBy('createdAt', ['createdAt', 'firstName', 'lastName', 'code']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.student.count({ where }),
    ]);

    // Payment overview per student: invoiced total vs collected, + monthly fee
    // from active enrollments' monthly-priced courses.
    const ids = data.map((s) => s.id);
    const [invoiceAgg, paymentAgg] = await Promise.all([
      ids.length
        ? this.prisma.scoped.invoice.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids }, status: { not: 'void' } },
            _sum: { total: true },
          })
        : [],
      ids.length
        ? this.prisma.scoped.payment.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids } },
            _sum: { amount: true },
          })
        : [],
    ]);
    const dueMap = new Map(invoiceAgg.map((i) => [i.studentId, i._sum.total ?? 0]));
    const paidMap = new Map(paymentAgg.map((p) => [p.studentId, p._sum.amount ?? 0]));

    // CRM-side payments of converted leads also count (student.leadId link).
    const leadIds = data.map((s) => s.leadId).filter(Boolean) as string[];
    const leadPayAgg = leadIds.length
      ? await this.prisma.scoped.leadPayment.groupBy({
          by: ['leadId'],
          where: { leadId: { in: leadIds }, status: { not: 'legv_edilib' } },
          _sum: { amountPaid: true, amountDue: true },
        })
      : [];
    const leadPayMap = new Map(leadPayAgg.map((p) => [p.leadId, p._sum]));

    return paginated(
      data.map((s) => {
        const lp = s.leadId ? leadPayMap.get(s.leadId) : undefined;
        return {
          ...s,
          groups: s.enrollments.map((e) => ({ id: e.group.id, name: e.group.name })),
          monthlyFee: s.enrollments.reduce(
            (acc, e) => acc + (e.group.course?.pricingModel === 'monthly' ? e.group.course.price : 0),
            0,
          ),
          totalDue: (dueMap.get(s.id) ?? 0) + (lp?.amountDue ?? 0),
          totalPaid: (paidMap.get(s.id) ?? 0) + (lp?.amountPaid ?? 0),
          enrollments: undefined,
        };
      }),
      total,
      q,
    );
  }

  /** Dataset for the CSV/XLSX/PDF export routes (same aggregation as list()). */
  async exportData(): Promise<{ columns: BrandedColumn[]; rows: Record<string, unknown>[] }> {
    const students = await this.prisma.scoped.student.findMany({
      where: { deletedAt: null },
      include: {
        enrollments: {
          where: { status: 'active' },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                course: { select: { price: true, pricingModel: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const ids = students.map((s) => s.id);
    const [invoiceAgg, paymentAgg] = await Promise.all([
      ids.length
        ? this.prisma.scoped.invoice.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids }, status: { not: 'void' } },
            _sum: { total: true },
          })
        : [],
      ids.length
        ? this.prisma.scoped.payment.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids } },
            _sum: { amount: true },
          })
        : [],
    ]);
    const dueMap = new Map(invoiceAgg.map((i) => [i.studentId, i._sum.total ?? 0]));
    const paidMap = new Map(paymentAgg.map((p) => [p.studentId, p._sum.amount ?? 0]));
    const exLeadIds = students.map((s) => s.leadId).filter(Boolean) as string[];
    const exLeadPayAgg = exLeadIds.length
      ? await this.prisma.scoped.leadPayment.groupBy({
          by: ['leadId'],
          where: { leadId: { in: exLeadIds }, status: { not: 'legv_edilib' } },
          _sum: { amountPaid: true, amountDue: true },
        })
      : [];
    const exLeadPayMap = new Map(exLeadPayAgg.map((p) => [p.leadId, p._sum]));

    const columns: BrandedColumn[] = [
      { key: 'code', header: 'Kod' },
      { key: 'name', header: 'Ad Soyad' },
      { key: 'phone', header: 'Telefon' },
      { key: 'groups', header: 'Qruplar' },
      { key: 'monthlyFee', header: 'Aylıq ödəniş', type: 'money' },
      { key: 'totalPaid', header: 'Ödənilib', type: 'money' },
      { key: 'totalDue', header: 'Hesablanıb', type: 'money' },
    ];
    const rows = students.map((s) => {
      const lp = s.leadId ? exLeadPayMap.get(s.leadId) : undefined;
      return {
        code: s.code,
        name: `${s.firstName} ${s.lastName}`.trim(),
        phone: s.phone ?? '',
        groups: s.enrollments.map((e) => e.group.name).join(', '),
        monthlyFee: s.enrollments.reduce(
          (acc, e) => acc + (e.group.course?.pricingModel === 'monthly' ? e.group.course.price : 0),
          0,
        ),
        totalPaid: (paidMap.get(s.id) ?? 0) + (lp?.amountPaid ?? 0),
        totalDue: (dueMap.get(s.id) ?? 0) + (lp?.amountDue ?? 0),
      };
    });
    return { columns, rows };
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
