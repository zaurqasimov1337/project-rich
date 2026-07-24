import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../core/prisma/prisma.service';
import { getContext, requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { LOST_STATUSES, WON_STATUSES } from './sales.constants';
import { toCsvString, type BrandedColumn } from '../../common/export/branded-export';
import type { AddTeamMemberDto, CreateLeadPaymentDto, UpdateLeadPaymentDto } from './dto/sales.dto';

const OPEN_PAYMENT_STATUSES = ['gozleyir', 'depozit_odedi', 'qismen_odenib', 'gecikib'];

interface PaymentListParams {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SalesOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private canSeeAll(): boolean {
    return getContext()?.permissions?.has('leads.settings') ?? false;
  }

  /** Lead scope for non-privileged users: only their own book. */
  private ownScope(): Prisma.LeadWhereInput {
    if (this.canSeeAll()) return {};
    const userId = getContext()?.userId;
    return userId ? { assignedTo: userId } : {};
  }

  private bakuDayBounds() {
    const OFFSET = 4 * 60 * 60 * 1000;
    const baku = new Date(Date.now() + OFFSET);
    const y = baku.getUTCFullYear();
    const mo = baku.getUTCMonth();
    const d = baku.getUTCDate();
    return {
      startToday: new Date(Date.UTC(y, mo, d) - OFFSET),
      startTomorrow: new Date(Date.UTC(y, mo, d + 1) - OFFSET),
    };
  }

  // ===== Lead payments =====
  async listPayments(p: PaymentListParams) {
    const page = Math.max(1, Number(p.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(p.limit) || 25));

    const leadWhere: Prisma.LeadWhereInput = { deletedAt: null, ...this.ownScope() };
    if (p.q && p.q.trim()) {
      const like = p.q.trim();
      leadWhere.OR = [
        { fullName: { contains: like, mode: 'insensitive' } },
        { name: { contains: like, mode: 'insensitive' } },
        { phone: { contains: like } },
      ];
    }
    const where: Prisma.LeadPaymentWhereInput = {
      ...(p.status ? { status: p.status } : {}),
      lead: leadWhere,
    };

    const [items, total, sums] = await Promise.all([
      this.prisma.scoped.leadPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { lead: { select: { id: true, leadNo: true, fullName: true, name: true, phone: true } } },
      }),
      this.prisma.scoped.leadPayment.count({ where }),
      this.prisma.scoped.leadPayment.aggregate({
        where,
        _sum: { amountDue: true, amountPaid: true },
      }),
    ]);

    const trainingIds = [...new Set(items.map((i) => i.trainingId).filter(Boolean) as string[])];
    const trainings = trainingIds.length
      ? await this.prisma.scoped.course.findMany({ where: { id: { in: trainingIds } }, select: { id: true, name: true } })
      : [];
    const trainMap = new Map(trainings.map((t) => [t.id, t.name]));

    return {
      data: items.map((i) => ({
        id: i.id,
        leadId: i.leadId,
        leadNo: i.lead?.leadNo ?? null,
        leadName: i.lead?.fullName ?? i.lead?.name ?? '—',
        leadPhone: i.lead?.phone ?? null,
        trainingId: i.trainingId,
        trainingName: i.trainingId ? (trainMap.get(i.trainingId) ?? null) : null,
        amountDue: i.amountDue,
        amountPaid: i.amountPaid,
        monthlyAmount: i.monthlyAmount,
        remaining: Math.max(0, i.amountDue - i.amountPaid),
        paidAt: i.paidAt,
        nextDueAt: i.nextDueAt,
        status: i.status,
        method: i.method,
        note: i.note,
        createdAt: i.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      totals: {
        due: sums._sum.amountDue ?? 0,
        paid: sums._sum.amountPaid ?? 0,
        remaining: Math.max(0, (sums._sum.amountDue ?? 0) - (sums._sum.amountPaid ?? 0)),
      },
    };
  }

  /** Mirror the latest payment state onto the lead (millisec behaviour). */
  private async mirrorToLead(leadId: string, status?: string | null, method?: string | null) {
    const data: Prisma.LeadUncheckedUpdateInput = {};
    if (status) data.paymentStatus = status;
    if (method) data.paymentMethod = method;
    if (Object.keys(data).length) {
      await this.prisma.scoped.lead.update({ where: { id: leadId }, data });
    }
  }

  async createPayment(dto: CreateLeadPaymentDto, userId: string) {
    const tenantId = requireTenantId();
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id: dto.leadId, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Müraciət tapılmadı' });

    const payment = await this.prisma.scoped.leadPayment.create({
      data: {
        tenantId,
        leadId: dto.leadId,
        trainingId: dto.trainingId ?? lead.courseInterestId,
        amountDue: dto.amountDue,
        amountPaid: dto.amountPaid ?? 0,
        monthlyAmount: dto.monthlyAmount,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : dto.amountPaid ? new Date() : undefined,
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
        status: dto.status ?? 'gozleyir',
        method: dto.method,
        note: dto.note,
        createdBy: userId,
      },
    });
    await this.mirrorToLead(dto.leadId, payment.status, payment.method);
    await this.prisma.scoped.leadActivity.create({
      data: {
        tenantId,
        leadId: dto.leadId,
        type: 'payment',
        title: 'Ödəniş qeydə alındı',
        body: dto.note,
        meta: { amountDue: payment.amountDue, amountPaid: payment.amountPaid, status: payment.status },
        userId,
      },
    });
    this.audit.log({ action: 'create', entityType: 'lead_payment', entityId: payment.id, after: payment });
    return payment;
  }

  async updatePayment(id: string, dto: UpdateLeadPaymentDto, userId: string) {
    const tenantId = requireTenantId();
    const payment = await this.prisma.scoped.leadPayment.findFirst({ where: { id } });
    if (!payment) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ödəniş tapılmadı' });

    const data: Prisma.LeadPaymentUncheckedUpdateInput = {};
    if (dto.trainingId !== undefined) data.trainingId = dto.trainingId;
    if (dto.amountDue !== undefined) data.amountDue = dto.amountDue;
    if (dto.amountPaid !== undefined) data.amountPaid = dto.amountPaid;
    if (dto.monthlyAmount !== undefined) data.monthlyAmount = dto.monthlyAmount;
    if (dto.paidAt !== undefined) data.paidAt = new Date(dto.paidAt);
    if (dto.nextDueAt !== undefined) data.nextDueAt = new Date(dto.nextDueAt);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.method !== undefined) data.method = dto.method;
    if (dto.note !== undefined) data.note = dto.note;

    const updated = await this.prisma.scoped.leadPayment.update({ where: { id }, data });
    await this.mirrorToLead(payment.leadId, dto.status, dto.method);
    if (dto.status !== undefined && dto.status !== payment.status) {
      await this.prisma.scoped.leadActivity.create({
        data: {
          tenantId,
          leadId: payment.leadId,
          type: 'payment',
          title: `Ödəniş statusu: ${payment.status} → ${dto.status}`,
          userId,
        },
      });
    }
    this.audit.log({ action: 'update', entityType: 'lead_payment', entityId: id, after: updated });
    return updated;
  }

  async deletePayment(id: string) {
    const payment = await this.prisma.scoped.leadPayment.findFirst({ where: { id } });
    if (!payment) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ödəniş tapılmadı' });
    await this.prisma.scoped.leadPayment.delete({ where: { id } });
    this.audit.log({ action: 'delete', entityType: 'lead_payment', entityId: id });
    return { ok: true };
  }

  // ===== Sales team (per-manager KPIs + bonus) =====
  async team() {
    const tenantId = requireTenantId();
    const seeAll = this.canSeeAll();
    const ownUserId = getContext()?.userId;

    const leadWhere: Prisma.LeadWhereInput = { deletedAt: null, assignedTo: { not: null } };
    if (!seeAll && ownUserId) leadWhere.assignedTo = ownUserId;

    const [byManager, wonByManager, revenueRows] = await Promise.all([
      this.prisma.scoped.lead.groupBy({ by: ['assignedTo'], where: leadWhere, _count: true }),
      this.prisma.scoped.lead.groupBy({
        by: ['assignedTo'],
        where: { ...leadWhere, status: { in: WON_STATUSES } },
        _count: true,
      }),
      this.prisma.$queryRaw<{ uid: string; revenue: number }[]>(Prisma.sql`
        SELECT l."assignedTo" AS uid, COALESCE(SUM(p."amountPaid"), 0)::int AS revenue
        FROM lead_payments p
        JOIN leads l ON l.id = p."leadId"
        WHERE p."tenantId" = ${tenantId} AND l."deletedAt" IS NULL AND l."assignedTo" IS NOT NULL
          ${!seeAll && ownUserId ? Prisma.sql`AND l."assignedTo" = ${ownUserId}` : Prisma.empty}
        GROUP BY 1
      `),
    ]);

    // Members = anyone with assigned leads PLUS anyone holding the sales_manager
    // role or a bonus profile — so a freshly added member shows up with zeros.
    const leadUserIds = byManager.map((m) => m.assignedTo).filter(Boolean) as string[];
    const [roleUsers, allProfiles] = await Promise.all([
      this.prisma.scoped.user.findMany({
        where: {
          deletedAt: null,
          status: 'active',
          roles: { some: { role: { key: 'sales_manager' } } },
          ...(!seeAll && ownUserId ? { id: ownUserId } : {}),
        },
        select: { id: true },
      }),
      this.prisma.scoped.salesManagerProfile.findMany({
        where: !seeAll && ownUserId ? { userId: ownUserId } : {},
      }),
    ]);
    const userIds = [
      ...new Set([...leadUserIds, ...roleUsers.map((u) => u.id), ...allProfiles.map((p) => p.userId)]),
    ];
    const users = userIds.length
      ? await this.prisma.scoped.user.findMany({
          where: { id: { in: userIds }, deletedAt: null },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));
    const totalMap = new Map(
      (byManager as { assignedTo: string | null; _count: number }[]).map((m) => [m.assignedTo, m._count]),
    );
    const wonMap = new Map(
      (wonByManager as { assignedTo: string | null; _count: number }[]).map((w) => [w.assignedTo, w._count]),
    );
    const revMap = new Map(revenueRows.map((r) => [r.uid, r.revenue]));

    const rows = userIds
      .filter((uid) => userMap.has(uid))
      .map((uid) => {
        const u = userMap.get(uid)!;
        const total = totalMap.get(uid) ?? 0;
        const closed = wonMap.get(uid) ?? 0;
        const revenue = revMap.get(uid) ?? 0;
        const bonusRate = profileMap.get(uid)?.bonusRate ?? 5.0;
        return {
          userId: uid,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          totalLeads: total,
          closedCount: closed,
          conversionRate: total > 0 ? Math.round((closed / total) * 1000) / 10 : 0,
          revenue,
          bonusRate,
          bonus: Math.round((revenue * bonusRate) / 100),
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.closedCount - a.closedCount || b.totalLeads - a.totalLeads);

    return { seeAll, data: rows };
  }

  /** Create a new sales team member: active user with the sales_manager role + bonus profile. */
  async addTeamMember(dto: AddTeamMemberDto) {
    const tenantId = requireTenantId();
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Bu email artıq qeydiyyatdadır' });
    }
    const role = await this.prisma.scoped.role.findFirst({ where: { key: 'sales_manager' } });
    if (!role) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'sales_manager rolu tapılmadı' });
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.scoped.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: 'active',
      },
    });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await this.prisma.scoped.salesManagerProfile.create({
      data: { tenantId, userId: user.id, bonusRate: dto.bonusRate ?? 5.0 },
    });
    this.audit.log({ action: 'create', entityType: 'sales_team_member', entityId: user.id });
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }

  async updateTeamMember(userId: string, bonusRate: number) {
    const tenantId = requireTenantId();
    const user = await this.prisma.scoped.user.findFirst({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstifadəçi tapılmadı' });
    const profile = await this.prisma.scoped.salesManagerProfile.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, bonusRate },
      update: { bonusRate },
    });
    this.audit.log({ action: 'update', entityType: 'sales_manager_profile', entityId: profile.id, after: profile });
    return profile;
  }

  // ===== Trainings (sales view of the course catalog) =====
  async trainings() {
    const [courses, leadCounts, wonCounts] = await Promise.all([
      this.prisma.scoped.course.findMany({
        where: { deletedAt: null },
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.scoped.lead.groupBy({
        by: ['courseInterestId'],
        where: { deletedAt: null, courseInterestId: { not: null } },
        _count: true,
      }),
      this.prisma.scoped.lead.groupBy({
        by: ['courseInterestId'],
        where: { deletedAt: null, courseInterestId: { not: null }, status: { in: WON_STATUSES } },
        _count: true,
      }),
    ]);
    const leadMap = new Map(leadCounts.map((c) => [c.courseInterestId, c._count]));
    const wonMap = new Map(wonCounts.map((c) => [c.courseInterestId, c._count]));
    return courses.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category?.name ?? null,
      level: c.level,
      price: c.price,
      pricingModel: c.pricingModel,
      durationWeeks: c.durationWeeks,
      format: c.format,
      status: c.status,
      leadCount: leadMap.get(c.id) ?? 0,
      registeredCount: wonMap.get(c.id) ?? 0,
    }));
  }

  // ===== Notifications (live counts) =====
  async notifications() {
    const { startToday, startTomorrow } = this.bakuDayBounds();
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const leadScope = this.ownScope();

    const [overdueFollowups, todayFollowups, upcomingPayments, overduePayments] = await Promise.all([
      this.prisma.scoped.followup.count({
        where: { isDone: false, dueAt: { lt: startToday }, lead: { deletedAt: null, ...leadScope } },
      }),
      this.prisma.scoped.followup.count({
        where: { isDone: false, dueAt: { gte: startToday, lt: startTomorrow }, lead: { deletedAt: null, ...leadScope } },
      }),
      this.prisma.scoped.leadPayment.count({
        where: {
          status: { in: OPEN_PAYMENT_STATUSES },
          nextDueAt: { gte: startToday, lte: in3Days },
          lead: { deletedAt: null, ...leadScope },
        },
      }),
      this.prisma.scoped.leadPayment.count({
        where: {
          status: { in: OPEN_PAYMENT_STATUSES },
          nextDueAt: { lt: startToday },
          lead: { deletedAt: null, ...leadScope },
        },
      }),
    ]);

    return { overdueFollowups, todayFollowups, upcomingPayments, overduePayments };
  }

  // ===== Reports (analytics overview) =====
  async reportsOverview(dateFrom?: string, dateTo?: string) {
    const tenantId = requireTenantId();
    const seeAll = this.canSeeAll();
    const ownUserId = getContext()?.userId;
    const assignedTo = seeAll ? undefined : ownUserId;

    const range: Prisma.DateTimeFilter = {};
    if (dateFrom) range.gte = new Date(dateFrom + 'T00:00:00.000Z');
    if (dateTo) {
      const end = new Date(dateTo + 'T00:00:00.000Z');
      end.setUTCDate(end.getUTCDate() + 1);
      range.lt = end;
    }
    const baseWhere: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(assignedTo ? { assignedTo } : {}),
      ...(dateFrom || dateTo ? { createdAt: range } : {}),
    };

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
    twelveMonthsAgo.setUTCDate(1);
    twelveMonthsAgo.setUTCHours(0, 0, 0, 0);

    const [byStatus, bySource, byCampaignRaw, byTrainingRaw, byManagerRaw, wonByManager, lostRaw, revenueAgg, monthly] =
      await Promise.all([
        this.prisma.scoped.lead.groupBy({ by: ['status'], where: baseWhere, _count: true }),
        this.prisma.scoped.lead.groupBy({ by: ['sourceKey'], where: baseWhere, _count: true }),
        this.prisma.scoped.lead.groupBy({ by: ['campaignId'], where: { ...baseWhere, campaignId: { not: null } }, _count: true }),
        this.prisma.scoped.lead.groupBy({ by: ['courseInterestId'], where: baseWhere, _count: true }),
        seeAll
          ? this.prisma.scoped.lead.groupBy({ by: ['assignedTo'], where: { ...baseWhere, assignedTo: { not: null } }, _count: true })
          : Promise.resolve([]),
        seeAll
          ? this.prisma.scoped.lead.groupBy({
              by: ['assignedTo'],
              where: { ...baseWhere, assignedTo: { not: null }, status: { in: WON_STATUSES } },
              _count: true,
            })
          : Promise.resolve([]),
        this.prisma.scoped.lead.groupBy({
          by: ['lostReason'],
          where: { ...baseWhere, status: { in: LOST_STATUSES }, lostReason: { not: null } },
          _count: true,
        }),
        this.prisma.scoped.leadPayment.aggregate({
          _sum: { amountPaid: true },
          where: { lead: baseWhere },
        }),
        this.prisma.$queryRaw<{ month: string; total: number; won: number }[]>(Prisma.sql`
          SELECT to_char(date_trunc('month', l."createdAt"), 'YYYY-MM') AS month,
                 count(*)::int AS total,
                 (count(*) FILTER (WHERE l.status IN ('qeydiyyat_oldu', 'satis_baglandi')))::int AS won
          FROM leads l
          WHERE l."tenantId" = ${tenantId} AND l."deletedAt" IS NULL AND l."createdAt" >= ${twelveMonthsAgo}
            ${assignedTo ? Prisma.sql`AND l."assignedTo" = ${assignedTo}` : Prisma.empty}
          GROUP BY 1
          ORDER BY 1
        `),
      ]);

    // Potential contract value of won leads: monthly price × course duration
    // (e.g. 300 AZN × 6 ay = 1800 AZN) — what the sales are worth if every
    // registered student stays to the end.
    const wonByTraining = await this.prisma.scoped.lead.groupBy({
      by: ['courseInterestId'],
      where: { ...baseWhere, status: { in: WON_STATUSES }, courseInterestId: { not: null } },
      _count: true,
    });
    const wonTrainIds = wonByTraining.map((w) => w.courseInterestId).filter(Boolean) as string[];
    const wonCourses = wonTrainIds.length
      ? await this.prisma.scoped.course.findMany({
          where: { id: { in: wonTrainIds } },
          select: { id: true, price: true, pricingModel: true, durationWeeks: true },
        })
      : [];
    const courseMap = new Map(wonCourses.map((c) => [c.id, c]));
    const potentialRevenue = wonByTraining.reduce((acc, w) => {
      const c = w.courseInterestId ? courseMap.get(w.courseInterestId) : undefined;
      if (!c) return acc;
      const months = c.durationWeeks ? Math.max(1, Math.round(c.durationWeeks / 4.345)) : 1;
      const contract = c.pricingModel === 'monthly' ? c.price * months : c.price;
      return acc + contract * w._count;
    }, 0);

    const statusCount = new Map(byStatus.map((s) => [s.status, s._count]));
    const sumStatuses = (keys: string[]) => keys.reduce((acc, k) => acc + (statusCount.get(k) ?? 0), 0);
    const total = byStatus.reduce((acc, s) => acc + s._count, 0);
    const registered = sumStatuses([...WON_STATUSES]);
    const lost = sumStatuses([...LOST_STATUSES]);
    const potential = sumStatuses(['gelecek_potensial']);
    const demoDone = sumStatuses(['demo_verildi']);
    const inProgress = Math.max(0, total - registered - lost - potential - (statusCount.get('yeni_lead') ?? 0));

    // resolve names
    const campaignIds = (byCampaignRaw as { campaignId: string | null; _count: number }[])
      .map((c) => c.campaignId)
      .filter(Boolean) as string[];
    const trainingIds = (byTrainingRaw as { courseInterestId: string | null; _count: number }[])
      .map((t) => t.courseInterestId)
      .filter(Boolean) as string[];
    const managerIds = (byManagerRaw as { assignedTo: string | null; _count: number }[])
      .map((m) => m.assignedTo)
      .filter(Boolean) as string[];
    const [campaigns, trainings, managers] = await Promise.all([
      campaignIds.length
        ? this.prisma.scoped.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
        : [],
      trainingIds.length
        ? this.prisma.scoped.course.findMany({ where: { id: { in: trainingIds } }, select: { id: true, name: true } })
        : [],
      managerIds.length
        ? this.prisma.scoped.user.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
    ]);
    const campMap = new Map(campaigns.map((c) => [c.id, c.name]));
    const trainMap = new Map(trainings.map((t) => [t.id, t.name]));
    const mgrMap = new Map(managers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const wonMgrMap = new Map(
      (wonByManager as { assignedTo: string | null; _count: number }[]).map((w) => [w.assignedTo, w._count]),
    );

    return {
      seeAll,
      summary: {
        total,
        registered,
        lost,
        conversionRate: total > 0 ? Math.round((registered / total) * 1000) / 10 : 0,
        revenue: revenueAgg._sum.amountPaid ?? 0,
        potentialRevenue,
      },
      funnel: [
        { key: 'total', label: 'Bütün leadlər', count: total },
        { key: 'in_progress', label: 'Prosesdə', count: inProgress },
        { key: 'demo_done', label: 'Demo keçirilib', count: demoDone },
        { key: 'registered', label: 'Qeydiyyat / Satış', count: registered },
        { key: 'potential', label: 'Gələcək potensial', count: potential },
        { key: 'lost', label: 'İtirilmiş', count: lost },
      ],
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })).sort((a, b) => b.count - a.count),
      bySource: bySource
        .map((s) => ({ source: s.sourceKey ?? 'unknown', count: s._count }))
        .sort((a, b) => b.count - a.count),
      byCampaign: (byCampaignRaw as { campaignId: string | null; _count: number }[])
        .map((c) => ({
          campaignId: c.campaignId,
          name: c.campaignId ? (campMap.get(c.campaignId) ?? 'Naməlum') : 'Naməlum',
          count: c._count,
        }))
        .sort((a, b) => b.count - a.count),
      byTraining: (byTrainingRaw as { courseInterestId: string | null; _count: number }[])
        .map((t) => ({
          trainingId: t.courseInterestId,
          name: t.courseInterestId ? (trainMap.get(t.courseInterestId) ?? 'Naməlum') : 'Təyin edilməyib',
          count: t._count,
        }))
        .sort((a, b) => b.count - a.count),
      byManager: (byManagerRaw as { assignedTo: string | null; _count: number }[])
        .map((m) => ({
          userId: m.assignedTo,
          name: m.assignedTo ? (mgrMap.get(m.assignedTo) ?? 'Naməlum') : 'Təyin edilməyib',
          total: m._count,
          won: wonMgrMap.get(m.assignedTo) ?? 0,
        }))
        .sort((a, b) => b.won - a.won || b.total - a.total),
      lostReasons: lostRaw
        .map((l) => ({ reason: l.lostReason ?? 'Naməlum', count: l._count }))
        .sort((a, b) => b.count - a.count),
      monthly,
    };
  }

  // ===== Exports (CSV serialization stays formula-injection safe via helper) =====

  /** Leads dataset shared by the CSV/XLSX/PDF export routes. */
  async exportLeadsData(): Promise<{ columns: BrandedColumn[]; rows: Record<string, unknown>[] }> {
    const leads = await this.prisma.scoped.lead.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const trainingIds = [...new Set(leads.map((l) => l.courseInterestId).filter(Boolean) as string[])];
    const userIds = [...new Set(leads.map((l) => l.assignedTo).filter(Boolean) as string[])];
    const [trainings, users] = await Promise.all([
      trainingIds.length
        ? this.prisma.scoped.course.findMany({ where: { id: { in: trainingIds } }, select: { id: true, name: true } })
        : [],
      userIds.length
        ? this.prisma.scoped.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
    ]);
    const trainMap = new Map(trainings.map((t) => [t.id, t.name]));
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const columns: BrandedColumn[] = [
      { key: 'leadNo', header: 'No', type: 'number' },
      { key: 'fullName', header: 'Ad Soyad' },
      { key: 'phone', header: 'Telefon' },
      { key: 'email', header: 'Email' },
      { key: 'instagram', header: 'Instagram' },
      { key: 'city', header: 'Şəhər' },
      { key: 'source', header: 'Mənbə' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Prioritet' },
      { key: 'score', header: 'Skor', type: 'number' },
      { key: 'training', header: 'Təlim' },
      { key: 'manager', header: 'Məsul' },
      { key: 'followupCount', header: 'Follow-up sayı', type: 'number' },
      { key: 'nextFollowupAt', header: 'Növbəti əlaqə' },
      { key: 'paymentStatus', header: 'Ödəniş statusu' },
      { key: 'paymentMethod', header: 'Ödəniş üsulu' },
      { key: 'discountPct', header: 'Endirim %' },
      { key: 'lostReason', header: 'İtirilmə səbəbi' },
      { key: 'createdAt', header: 'Yaradılıb' },
    ];
    const rows = leads.map((l) => ({
      leadNo: l.leadNo,
      fullName: l.fullName ?? l.name,
      phone: l.phone,
      email: l.email,
      instagram: l.instagram,
      city: l.city,
      source: l.sourceKey,
      status: l.status,
      priority: l.priority,
      score: l.score,
      training: l.courseInterestId ? (trainMap.get(l.courseInterestId) ?? '') : '',
      manager: l.assignedTo ? (userMap.get(l.assignedTo) ?? '') : '',
      followupCount: l.followupCount,
      nextFollowupAt: l.nextFollowupAt?.toISOString() ?? '',
      paymentStatus: l.paymentStatus ?? '',
      paymentMethod: l.paymentMethod ?? '',
      discountPct: l.discountPct ?? '',
      lostReason: l.lostReason ?? '',
      createdAt: l.createdAt.toISOString(),
    }));
    return { columns, rows };
  }

  async exportLeadsCsv(): Promise<string> {
    const { columns, rows } = await this.exportLeadsData();
    return toCsvString(
      columns.map((c) => c.header),
      rows.map((r) => columns.map((c) => r[c.key])),
    );
  }

  /** Sales report indicator/value dataset shared by the CSV/XLSX/PDF export routes. */
  async exportReportsData(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ columns: BrandedColumn[]; rows: Record<string, unknown>[] }> {
    const report = await this.reportsOverview(dateFrom, dateTo);
    const pairs: [unknown, unknown][] = [];
    pairs.push(['— Xülasə —', '']);
    pairs.push(['Ümumi lead', report.summary.total]);
    pairs.push(['Qeydiyyat / Satış', report.summary.registered]);
    pairs.push(['İtirilmiş', report.summary.lost]);
    pairs.push(['Konversiya %', report.summary.conversionRate]);
    pairs.push(['Yığılmış gəlir (qəpik)', report.summary.revenue]);
    pairs.push(['— Funnel —', '']);
    for (const f of report.funnel) pairs.push([f.label, f.count]);
    pairs.push(['— Mənbə üzrə —', '']);
    for (const s of report.bySource) pairs.push([s.source, s.count]);
    pairs.push(['— Kampaniya üzrə —', '']);
    for (const c of report.byCampaign) pairs.push([c.name, c.count]);
    pairs.push(['— Təlim üzrə —', '']);
    for (const t of report.byTraining) pairs.push([t.name, t.count]);
    if (report.seeAll) {
      pairs.push(['— Menecer üzrə (lead / satış) —', '']);
      for (const m of report.byManager) pairs.push([m.name, `${m.total} / ${m.won}`]);
    }
    pairs.push(['— İtirilmə səbəbləri —', '']);
    for (const l of report.lostReasons) pairs.push([l.reason, l.count]);
    pairs.push(['— Aylıq trend (ay: lead / satış) —', '']);
    for (const m of report.monthly) pairs.push([m.month, `${m.total} / ${m.won}`]);

    return {
      columns: [
        { key: 'metric', header: 'Göstərici' },
        { key: 'value', header: 'Dəyər' },
      ],
      rows: pairs.map(([metric, value]) => ({ metric, value })),
    };
  }

  async exportReportsCsv(dateFrom?: string, dateTo?: string): Promise<string> {
    const { columns, rows } = await this.exportReportsData(dateFrom, dateTo);
    return toCsvString(
      columns.map((c) => c.header),
      rows.map((r) => columns.map((c) => r[c.key])),
    );
  }
}
