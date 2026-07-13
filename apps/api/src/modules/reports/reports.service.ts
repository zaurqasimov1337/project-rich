import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { resolveDateRange, type ListQueryDto } from '../../common/dto/list-query.dto';
import type { ExportColumn } from './export.service';

export interface ReportResult {
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
  chart?: { label: string; value: number }[];
}

const REPORT_KEYS = [
  'revenue',
  'debts',
  'attendance',
  'group-fill',
  'teacher-load',
  'course-roi',
  'lead-funnel',
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  isValidKey(key: string): key is ReportKey {
    return (REPORT_KEYS as readonly string[]).includes(key);
  }

  async run(key: ReportKey, q: ListQueryDto): Promise<ReportResult> {
    const range =
      resolveDateRange(q) ??
      {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        lt: new Date(),
      };
    switch (key) {
      case 'revenue':
        return this.revenue(range);
      case 'debts':
        return this.debts();
      case 'attendance':
        return this.attendance(range);
      case 'group-fill':
        return this.groupFill();
      case 'teacher-load':
        return this.teacherLoad(range);
      case 'course-roi':
        return this.courseRoi(range);
      case 'lead-funnel':
        return this.leadFunnel(range);
      default:
        throw new BadRequestException({ code: 'NOT_FOUND', message: 'Unknown report' });
    }
  }

  private async revenue(range: { gte: Date; lt: Date }): Promise<ReportResult> {
    const txns = await this.prisma.scoped.transaction.findMany({
      where: { date: { gte: range.gte, lt: range.lt } },
      select: { type: true, amount: true, date: true, category: true },
      orderBy: { date: 'asc' },
    });
    const byDay = new Map<string, { income: number; expense: number }>();
    let income = 0;
    let expense = 0;
    for (const t of txns) {
      const day = t.date.toISOString().slice(0, 10);
      const b = byDay.get(day) ?? { income: 0, expense: 0 };
      if (t.type === 'income') {
        b.income += t.amount;
        income += t.amount;
      } else if (['expense', 'payroll'].includes(t.type)) {
        b.expense += t.amount;
        expense += t.amount;
      }
      byDay.set(day, b);
    }
    return {
      columns: [
        { key: 'date', header: 'Tarix' },
        { key: 'income', header: 'Gəlir', type: 'money' },
        { key: 'expense', header: 'Xərc', type: 'money' },
        { key: 'net', header: 'Xalis', type: 'money' },
      ],
      rows: [...byDay.entries()].map(([date, b]) => ({
        date,
        income: b.income,
        expense: b.expense,
        net: b.income - b.expense,
      })),
      totals: { income, expense, profit: income - expense },
      chart: [...byDay.entries()].map(([date, b]) => ({ label: date, value: b.income })),
    };
  }

  private async debts(): Promise<ReportResult> {
    await this.prisma.scoped.invoice.updateMany({
      where: { status: { in: ['open', 'partial'] }, dueAt: { lt: new Date() } },
      data: { status: 'overdue' },
    });
    const invoices = await this.prisma.scoped.invoice.findMany({
      where: { status: { in: ['overdue', 'partial', 'open'] } },
      include: { payments: { select: { amount: true } } },
      orderBy: { dueAt: 'asc' },
    });
    const students = await this.prisma.scoped.student.findMany({
      where: { id: { in: invoices.map((i) => i.studentId) } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s]));
    let totalDebt = 0;
    const rows = invoices.map((i) => {
      const s = sMap.get(i.studentId);
      const paid = i.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = i.total - paid;
      totalDebt += remaining;
      return {
        student: s ? `${s.firstName} ${s.lastName}` : '—',
        phone: s?.phone ?? '',
        number: i.number,
        remaining,
        dueAt: i.dueAt,
        overdueDays: Math.max(0, Math.floor((Date.now() - i.dueAt.getTime()) / 86400000)),
      };
    });
    return {
      columns: [
        { key: 'student', header: 'Tələbə' },
        { key: 'phone', header: 'Telefon' },
        { key: 'number', header: 'Faktura' },
        { key: 'remaining', header: 'Qalıq borc', type: 'money' },
        { key: 'dueAt', header: 'Son tarix', type: 'date' },
        { key: 'overdueDays', header: 'Gecikmə (gün)', type: 'number' },
      ],
      rows,
      totals: { totalDebt, count: rows.length },
    };
  }

  private async attendance(range: { gte: Date; lt: Date }): Promise<ReportResult> {
    const rows = await this.prisma.scoped.attendance.groupBy({
      by: ['status'],
      where: { markedAt: { gte: range.gte, lt: range.lt } },
      _count: true,
    });
    const total = rows.reduce((s, r) => s + r._count, 0);
    const present = rows
      .filter((r) => ['present', 'late'].includes(r.status))
      .reduce((s, r) => s + r._count, 0);
    const labelMap: Record<string, string> = {
      present: 'Gəlib',
      late: 'Gecikib',
      absent: 'Gəlməyib',
      excused: 'Üzrlü',
    };
    return {
      columns: [
        { key: 'status', header: 'Status' },
        { key: 'count', header: 'Say', type: 'number' },
        { key: 'pct', header: 'Faiz (%)', type: 'number' },
      ],
      rows: rows.map((r) => ({
        status: labelMap[r.status] ?? r.status,
        count: r._count,
        pct: total > 0 ? Math.round((r._count / total) * 100) : 0,
      })),
      totals: { total, attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0 },
      chart: rows.map((r) => ({ label: labelMap[r.status] ?? r.status, value: r._count })),
    };
  }

  private async groupFill(): Promise<ReportResult> {
    const groups = await this.prisma.scoped.group.findMany({
      where: { deletedAt: null, status: { in: ['planned', 'active'] } },
      include: {
        course: { select: { name: true } },
        _count: { select: { students: { where: { status: 'active' } } } },
      },
      orderBy: { name: 'asc' },
    });
    return {
      columns: [
        { key: 'name', header: 'Qrup' },
        { key: 'course', header: 'Kurs' },
        { key: 'active', header: 'Aktiv tələbə', type: 'number' },
        { key: 'capacity', header: 'Tutum', type: 'number' },
        { key: 'fillRate', header: 'Doluluq (%)', type: 'number' },
      ],
      rows: groups.map((g) => ({
        name: g.name,
        course: g.course.name,
        active: g._count.students,
        capacity: g.capacity,
        fillRate: g.capacity > 0 ? Math.round((g._count.students / g.capacity) * 100) : 0,
      })),
      totals: { groups: groups.length },
    };
  }

  private async teacherLoad(range: { gte: Date; lt: Date }): Promise<ReportResult> {
    const teachers = await this.prisma.scoped.teacher.findMany({
      where: { deletedAt: null },
      include: { groups: { where: { deletedAt: null, status: 'active' }, select: { id: true } } },
    });
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: teachers.map((t) => t.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));
    const lessons = await this.prisma.scoped.lesson.findMany({
      where: { startAt: { gte: range.gte, lt: range.lt }, status: { not: 'cancelled' } },
      select: { teacherId: true, startAt: true, endAt: true },
    });
    const byTeacher = new Map<string, { count: number; minutes: number }>();
    for (const l of lessons) {
      const b = byTeacher.get(l.teacherId) ?? { count: 0, minutes: 0 };
      b.count += 1;
      b.minutes += (l.endAt.getTime() - l.startAt.getTime()) / 60000;
      byTeacher.set(l.teacherId, b);
    }
    return {
      columns: [
        { key: 'teacher', header: 'Müəllim' },
        { key: 'groups', header: 'Aktiv qrup', type: 'number' },
        { key: 'lessons', header: 'Dərs sayı', type: 'number' },
        { key: 'hours', header: 'Saat', type: 'number' },
      ],
      rows: teachers.map((t) => {
        const u = uMap.get(t.userId);
        const b = byTeacher.get(t.id) ?? { count: 0, minutes: 0 };
        return {
          teacher: u ? `${u.firstName} ${u.lastName}` : '—',
          groups: t.groups.length,
          lessons: b.count,
          hours: Math.round((b.minutes / 60) * 10) / 10,
        };
      }),
    };
  }

  private async courseRoi(range: { gte: Date; lt: Date }): Promise<ReportResult> {
    const courses = await this.prisma.scoped.course.findMany({
      where: { deletedAt: null },
      include: {
        groups: {
          where: { deletedAt: null },
          include: { _count: { select: { students: { where: { status: 'active' } } } } },
        },
      },
    });
    const invoices = await this.prisma.scoped.invoice.findMany({
      where: { createdAt: { gte: range.gte, lt: range.lt }, status: { in: ['paid', 'partial'] } },
      include: { payments: { select: { amount: true } } },
    });
    const groupToCourse = new Map<string, string>();
    for (const c of courses) for (const g of c.groups) groupToCourse.set(g.id, c.id);
    const revByCourse = new Map<string, number>();
    for (const inv of invoices) {
      if (!inv.groupId) continue;
      const courseId = groupToCourse.get(inv.groupId);
      if (!courseId) continue;
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      revByCourse.set(courseId, (revByCourse.get(courseId) ?? 0) + paid);
    }
    return {
      columns: [
        { key: 'course', header: 'Kurs' },
        { key: 'students', header: 'Aktiv tələbə', type: 'number' },
        { key: 'groups', header: 'Aktiv qrup', type: 'number' },
        { key: 'revenue', header: 'Gəlir', type: 'money' },
      ],
      rows: courses
        .map((c) => ({
          course: c.name,
          students: c.groups.reduce((s, g) => s + g._count.students, 0),
          groups: c.groups.filter((g) => g.status === 'active').length,
          revenue: revByCourse.get(c.id) ?? 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  private async leadFunnel(range: { gte: Date; lt: Date }): Promise<ReportResult> {
    const [stages, counts] = await Promise.all([
      this.prisma.scoped.leadStage.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.scoped.lead.groupBy({
        by: ['stageId'],
        where: { deletedAt: null, createdAt: { gte: range.gte, lt: range.lt } },
        _count: true,
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.stageId, c._count]));
    const total = counts.reduce((s, c) => s + c._count, 0);
    return {
      columns: [
        { key: 'stage', header: 'Mərhələ' },
        { key: 'count', header: 'Say', type: 'number' },
        { key: 'pct', header: 'Faiz (%)', type: 'number' },
      ],
      rows: stages.map((s) => ({
        stage: s.name,
        count: countMap.get(s.id) ?? 0,
        pct: total > 0 ? Math.round(((countMap.get(s.id) ?? 0) / total) * 100) : 0,
      })),
      totals: { total },
      chart: stages.map((s) => ({ label: s.name, value: countMap.get(s.id) ?? 0 })),
    };
  }
}
