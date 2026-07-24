import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PlanService } from '../../core/plan/plan.service';
import { requireTenantId } from '../../core/context/request-context';
import { ListQueryDto, resolveDateRange } from '../../common/dto/list-query.dto';

const SYSTEM_PROMPT = `Sən Mactab təhsil idarəetmə platformasının AI köməkçisisən.
Tədris mərkəzinin rəhbərliyinə analitik suallarda kömək edirsən.
Yalnız verilmiş alətlərdən istifadə edərək mərkəzin öz məlumatlarına əsaslan.
Pul dəyərləri qəpiklə saxlanılır — cavabda manata çevir (100 qəpik = 1 ₼).
Cavabları Azərbaycan dilində, qısa və konkret ver. Rəqəmləri dəqiq göstər.
Məlumat yoxdursa, bunu açıq de — heç vaxt rəqəm uydurma.
HR sualları üçün (işçi, müqavilə, məzuniyyət, gecikmə, maaş) get_hr_overview alətindən istifadə et.`;

/** Read-only, tenant-scoped analytics tools exposed to the model. */
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_kpis',
    description:
      'Mərkəzin əsas göstəricilərini qaytarır: aktiv tələbə sayı, aktiv qrup sayı, bu ay gəlir (qəpik), bu ay xərc (qəpik), ümumi borc (qəpik), bu ay yeni tələbələr.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
  {
    name: 'get_revenue_by_month',
    description: 'Son 12 ayın aylıq gəlir və xərclərini qaytarır (qəpiklə).',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
  {
    name: 'get_debtors',
    description:
      'Ödənişi gecikən tələbələrin siyahısını qaytarır: ad, telefon, qalıq borc (qəpik), gecikmə günləri. Ən çox gecikənlər əvvəldə.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Maksimum nəticə sayı (default 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_course_performance',
    description:
      'Kurslar üzrə performans: hər kurs üçün aktiv tələbə sayı, aktiv qrup sayı, bu ay gəlir (qəpik). Ən gəlirli kurslar əvvəldə.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
  {
    name: 'get_teacher_load',
    description:
      'Müəllimlər üzrə yük: hər müəllim üçün bu ay keçirilmiş dərs sayı və aktiv qrup sayı.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
  {
    name: 'get_attendance_stats',
    description:
      'Son 30 günün davamiyyət statistikası: status üzrə saylar (present/late/absent/excused) və davamiyyət faizi. Həmçinin davamiyyəti 60%-dən aşağı olan risk qrupundakı tələbələr.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
  {
    name: 'get_hr_overview',
    description:
      'HR icmalı: aktiv işçilər (ad, vəzifə, HR status, maaş qəpiklə), 60 gün ərzində bitəcək müqavilələr, son 6 ayın maaş dəyişiklikləri, məzuniyyət balansları (illik 21 gün) və bu ayın gecikmə statistikası. İşçi, müqavilə, məzuniyyət, gecikmə və maaş suallarında istifadə et.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
  {
    name: 'get_lead_funnel',
    description:
      'Son 30 günün CRM göstəriciləri: mərhələlər üzrə müraciət sayları, konversiya faizi, reklam xərci (qəpik), CPL, CAC.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
  },
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = config.get<string>('AI_MODEL') ?? 'claude-opus-4-8';
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  // ---------- tool implementations (all tenant-scoped, read-only) ----------

  private async runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'get_kpis':
        return this.getKpis();
      case 'get_revenue_by_month':
        return this.getRevenueByMonth();
      case 'get_debtors':
        return this.getDebtors(Math.min(Number(input.limit ?? 20), 50));
      case 'get_course_performance':
        return this.getCoursePerformance();
      case 'get_teacher_load':
        return this.getTeacherLoad();
      case 'get_attendance_stats':
        return this.getAttendanceStats();
      case 'get_lead_funnel':
        return this.getLeadFunnel();
      case 'get_hr_overview':
        return this.getHrOverview();
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async getKpis() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [students, groups, income, expense, debt, newStudents] = await Promise.all([
      this.prisma.scoped.student.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.scoped.group.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.scoped.transaction.aggregate({
        where: { type: 'income', date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.scoped.transaction.aggregate({
        where: { type: { in: ['expense', 'payroll'] }, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.scoped.invoice.aggregate({
        where: { status: { in: ['overdue', 'partial', 'open'] } },
        _sum: { total: true },
      }),
      this.prisma.scoped.student.count({
        where: { deletedAt: null, createdAt: { gte: monthStart } },
      }),
    ]);
    return {
      activeStudents: students,
      activeGroups: groups,
      monthIncomeQepik: income._sum.amount ?? 0,
      monthExpenseQepik: expense._sum.amount ?? 0,
      outstandingDebtQepik: debt._sum.total ?? 0,
      newStudentsThisMonth: newStudents,
    };
  }

  private async getRevenueByMonth() {
    const from = new Date();
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    const txns = await this.prisma.scoped.transaction.findMany({
      where: { date: { gte: from } },
      select: { type: true, amount: true, date: true },
    });
    const buckets: Record<string, { incomeQepik: number; expenseQepik: number }> = {};
    for (const t of txns) {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] ??= { incomeQepik: 0, expenseQepik: 0 };
      if (t.type === 'income') buckets[key].incomeQepik += t.amount;
      else if (['expense', 'payroll'].includes(t.type)) buckets[key].expenseQepik += t.amount;
    }
    return buckets;
  }

  private async getDebtors(limit: number) {
    const invoices = await this.prisma.scoped.invoice.findMany({
      where: { status: { in: ['overdue', 'partial'] } },
      include: { payments: { select: { amount: true } } },
      orderBy: { dueAt: 'asc' },
      take: limit,
    });
    const students = await this.prisma.scoped.student.findMany({
      where: { id: { in: invoices.map((i) => i.studentId) } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s]));
    return invoices.map((i) => {
      const s = sMap.get(i.studentId);
      const paid = i.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        student: s ? `${s.firstName} ${s.lastName}` : '—',
        phone: s?.phone ?? null,
        remainingQepik: i.total - paid,
        overdueDays: Math.max(0, Math.floor((Date.now() - i.dueAt.getTime()) / 86400000)),
      };
    });
  }

  private async getCoursePerformance() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const courses = await this.prisma.scoped.course.findMany({
      where: { deletedAt: null },
      include: {
        groups: {
          where: { deletedAt: null, status: 'active' },
          include: { _count: { select: { students: { where: { status: 'active' } } } } },
        },
      },
    });
    // Revenue per course via invoices linked to its groups this month
    const invoices = await this.prisma.scoped.invoice.findMany({
      where: { createdAt: { gte: monthStart }, status: { in: ['paid', 'partial'] } },
      include: { payments: { select: { amount: true } } },
    });
    const groupToCourse = new Map<string, string>();
    for (const c of courses) for (const g of c.groups) groupToCourse.set(g.id, c.id);
    const revenueByCourse = new Map<string, number>();
    for (const inv of invoices) {
      if (!inv.groupId) continue;
      const courseId = groupToCourse.get(inv.groupId);
      if (!courseId) continue;
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      revenueByCourse.set(courseId, (revenueByCourse.get(courseId) ?? 0) + paid);
    }
    return courses
      .map((c) => ({
        course: c.name,
        activeGroups: c.groups.length,
        activeStudents: c.groups.reduce((s, g) => s + g._count.students, 0),
        monthRevenueQepik: revenueByCourse.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.monthRevenueQepik - a.monthRevenueQepik);
  }

  private async getTeacherLoad() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const teachers = await this.prisma.scoped.teacher.findMany({
      where: { deletedAt: null },
      include: {
        groups: { where: { deletedAt: null, status: 'active' }, select: { id: true } },
      },
    });
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: teachers.map((t) => t.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));
    const lessons = await this.prisma.scoped.lesson.groupBy({
      by: ['teacherId'],
      where: { startAt: { gte: monthStart }, status: { in: ['done', 'scheduled'] } },
      _count: true,
    });
    const lMap = new Map(lessons.map((l) => [l.teacherId, l._count]));
    return teachers.map((t) => {
      const u = uMap.get(t.userId);
      return {
        teacher: u ? `${u.firstName} ${u.lastName}` : '—',
        activeGroups: t.groups.length,
        monthLessons: lMap.get(t.id) ?? 0,
      };
    });
  }

  private async getAttendanceStats() {
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const byStatus = await this.prisma.scoped.attendance.groupBy({
      by: ['status'],
      where: { markedAt: { gte: from } },
      _count: true,
    });
    const total = byStatus.reduce((s, r) => s + r._count, 0);
    const present = byStatus
      .filter((r) => ['present', 'late'].includes(r.status))
      .reduce((s, r) => s + r._count, 0);

    // Risk students: attendance < 60% over the window
    const perStudent = await this.prisma.scoped.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { markedAt: { gte: from } },
      _count: true,
    });
    const studentAgg = new Map<string, { present: number; total: number }>();
    for (const r of perStudent) {
      const agg = studentAgg.get(r.studentId) ?? { present: 0, total: 0 };
      agg.total += r._count;
      if (['present', 'late'].includes(r.status)) agg.present += r._count;
      studentAgg.set(r.studentId, agg);
    }
    const riskIds = [...studentAgg.entries()]
      .filter(([, a]) => a.total >= 3 && a.present / a.total < 0.6)
      .map(([id]) => id);
    const riskStudents = await this.prisma.scoped.student.findMany({
      where: { id: { in: riskIds.slice(0, 20) } },
      select: { firstName: true, lastName: true, phone: true },
    });
    return {
      last30Days: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      attendanceRatePct: total > 0 ? Math.round((present / total) * 100) : null,
      riskStudents: riskStudents.map((s) => ({
        name: `${s.firstName} ${s.lastName}`,
        phone: s.phone,
      })),
    };
  }

  /** HR overview for the HR Copilot — all lists capped at 50 rows to keep tokens sane. */
  private async getHrOverview() {
    const CAP = 50;
    const now = new Date();
    const in60d = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const year = now.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1));

    const employees = await this.prisma.scoped.employee.findMany({
      where: { firedAt: null },
      orderBy: { createdAt: 'asc' },
      take: CAP,
    });
    const empIds = employees.map((e) => e.id);
    const [users, expiringContracts, salaryChanges, approvedLeaves, lateAgg] = await Promise.all([
      this.prisma.scoped.user.findMany({
        where: { id: { in: employees.map((e) => e.userId) } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.scoped.employeeContract.findMany({
        where: {
          employeeId: { in: empIds },
          expiresAt: { gte: now, lte: in60d },
          status: { in: ['aktiv', 'imzalanib'] },
        },
        orderBy: { expiresAt: 'asc' },
        take: CAP,
      }),
      this.prisma.scoped.salaryChange.findMany({
        where: { employeeId: { in: empIds }, effectiveAt: { gte: sixMonthsAgo } },
        orderBy: { effectiveAt: 'desc' },
        take: CAP,
      }),
      this.prisma.scoped.leaveRequest.findMany({
        where: {
          employeeId: { in: empIds },
          status: 'approved',
          type: 'vacation',
          fromDate: { lt: yearEnd },
          toDate: { gte: yearStart },
        },
        take: 200,
      }),
      this.prisma.scoped.employeeAttendance.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: empIds }, date: { gte: monthStart } },
        _sum: { lateMinutes: true },
        _count: true,
      }),
    ]);

    const uMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const nameOf = (employeeId: string) => {
      const e = employees.find((x) => x.id === employeeId);
      return e ? (uMap.get(e.userId) ?? '—') : '—';
    };

    // Approved vacation days used within the current year, per employee.
    const DAY = 24 * 3600 * 1000;
    const usedDays = new Map<string, number>();
    for (const r of approvedLeaves) {
      const from = Math.max(r.fromDate.getTime(), yearStart.getTime());
      const to = Math.min(r.toDate.getTime(), yearEnd.getTime() - DAY);
      const days = Math.max(0, Math.round((to - from) / DAY) + 1);
      usedDays.set(r.employeeId, (usedDays.get(r.employeeId) ?? 0) + days);
    }
    const ALLOWANCE = 21;

    return {
      employees: employees.map((e) => ({
        name: uMap.get(e.userId) ?? '—',
        position: e.position,
        hrStatus: e.hrStatus,
        salaryQepik: e.salaryQepik,
        hiredAt: e.hiredAt?.toISOString().slice(0, 10) ?? null,
      })),
      contractsExpiring60d: expiringContracts.map((c) => ({
        employee: nameOf(c.employeeId),
        title: c.title,
        expiresAt: c.expiresAt?.toISOString().slice(0, 10) ?? null,
      })),
      salaryChangesLast6Months: salaryChanges.map((s) => ({
        employee: nameOf(s.employeeId),
        oldQepik: s.oldQepik,
        newQepik: s.newQepik,
        effectiveAt: s.effectiveAt.toISOString().slice(0, 10),
      })),
      leaveBalances: employees.map((e) => {
        const used = usedDays.get(e.id) ?? 0;
        return {
          employee: uMap.get(e.userId) ?? '—',
          allowanceDays: ALLOWANCE,
          usedDays: used,
          remainingDays: Math.max(0, ALLOWANCE - used),
        };
      }),
      lateStatsThisMonth: lateAgg
        .map((a) => ({
          employee: nameOf(a.employeeId),
          totalLateMinutes: a._sum.lateMinutes ?? 0,
          recordedDays: a._count,
        }))
        .sort((a, b) => b.totalLateMinutes - a.totalLateMinutes)
        .slice(0, CAP),
    };
  }

  private async getLeadFunnel() {
    const q = new ListQueryDto();
    q.range = 'this_month';
    const range = resolveDateRange(q)!;
    const [stages, counts, spend, won] = await Promise.all([
      this.prisma.scoped.leadStage.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.scoped.lead.groupBy({
        by: ['stageId'],
        where: { deletedAt: null, createdAt: { gte: range.gte, lt: range.lt } },
        _count: true,
      }),
      this.prisma.scoped.adSpend.aggregate({
        where: { date: { gte: range.gte, lt: range.lt } },
        _sum: { amount: true },
      }),
      this.prisma.scoped.lead.count({
        where: {
          deletedAt: null,
          createdAt: { gte: range.gte, lt: range.lt },
          convertedStudentId: { not: null },
        },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.stageId, c._count]));
    const totalLeads = counts.reduce((s, c) => s + c._count, 0);
    const totalSpend = spend._sum.amount ?? 0;
    return {
      stages: stages.map((s) => ({ name: s.name, count: countMap.get(s.id) ?? 0 })),
      totalLeads,
      converted: won,
      conversionPct: totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0,
      adSpendQepik: totalSpend,
      cplQepik: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
      cacQepik: won > 0 ? Math.round(totalSpend / won) : 0,
    };
  }

  // ---------- chat ----------

  async chat(userId: string, message: string, conversationId?: string) {
    await this.plan.assertFeature('ai');
    await this.plan.consumeAiRequest();
    const tenantId = requireTenantId();

    // conversation
    let conversation = conversationId
      ? await this.prisma.scoped.aiConversation.findFirst({
          where: { id: conversationId, userId },
        })
      : null;
    if (conversationId && !conversation) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conversation not found' });
    }
    if (!conversation) {
      conversation = await this.prisma.scoped.aiConversation.create({
        data: { tenantId, userId, title: message.slice(0, 60) },
      });
    }
    await this.prisma.scoped.aiMessage.create({
      data: { tenantId, conversationId: conversation.id, role: 'user', content: message },
    });

    if (!this.client) {
      const fallback = await this.fallbackAnswer();
      await this.prisma.scoped.aiMessage.create({
        data: { tenantId, conversationId: conversation.id, role: 'assistant', content: fallback },
      });
      return { conversationId: conversation.id, reply: fallback, provider: 'none' };
    }

    // history (last 20 messages)
    const history = await this.prisma.scoped.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // manual tool loop (max 6 iterations)
    let inputTokens = 0;
    let outputTokens = 0;
    const usedTools: string[] = [];
    let finalText = '';

    for (let i = 0; i < 6; i++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;

      if (response.stop_reason === 'refusal') {
        finalText = 'Bu sorğuya cavab verə bilmirəm. Zəhmət olmasa başqa cür soruşun.';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          usedTools.push(block.name);
          let result: unknown;
          try {
            result = await this.runTool(block.name, block.input as Record<string, unknown>);
          } catch (err) {
            result = { error: (err as Error).message };
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      break;
    }

    if (!finalText) finalText = 'Cavab hazırlana bilmədi. Yenidən cəhd edin.';

    await Promise.all([
      this.prisma.scoped.aiMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          role: 'assistant',
          content: finalText,
          toolCalls: usedTools.length ? usedTools : undefined,
        },
      }),
      this.prisma.scoped.aiUsageLog.create({
        data: { tenantId, userId, inputTokens, outputTokens, model: this.model },
      }),
    ]);

    return { conversationId: conversation.id, reply: finalText, provider: 'anthropic', usedTools };
  }

  /** Deterministic KPI summary when no AI provider is configured. */
  private async fallbackAnswer(): Promise<string> {
    const kpis = await this.getKpis();
    const fmt = (q: number) => `${(q / 100).toFixed(2)} ₼`;
    return [
      'AI provayder qoşulmayıb (Parametrlər → İnteqrasiyalar bölməsindən Anthropic API açarı əlavə edin).',
      'Cari əsas göstəricilər:',
      `• Aktiv tələbə: ${kpis.activeStudents}`,
      `• Aktiv qrup: ${kpis.activeGroups}`,
      `• Bu ay gəlir: ${fmt(kpis.monthIncomeQepik)}`,
      `• Bu ay xərc: ${fmt(kpis.monthExpenseQepik)}`,
      `• Ümumi borc: ${fmt(kpis.outstandingDebtQepik)}`,
      `• Bu ay yeni tələbə: ${kpis.newStudentsThisMonth}`,
    ].join('\n');
  }

  async conversations(userId: string) {
    return this.prisma.scoped.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  async conversationMessages(userId: string, id: string) {
    const conversation = await this.prisma.scoped.aiConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conversation not found' });
    }
    return conversation;
  }
}
