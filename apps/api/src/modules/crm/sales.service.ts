import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { getContext, requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { CrmService } from './crm.service';
import {
  computePriority,
  computeScore,
  PIPELINE_COLUMNS,
  stageBucketForStatus,
  type ScoreFlags,
} from './sales.constants';
import type {
  BulkAssignDto,
  CreateFollowupDto,
  CreateSalesLeadDto,
  UpdateFollowupDto,
  UpdateSalesLeadDto,
} from './dto/sales.dto';

const FLAG_KEYS: (keyof ScoreFlags)[] = [
  'askedDemo',
  'askedPrice',
  'callAnswered',
  'parentInvolved',
  'budgetOk',
  'notResponding',
  'passive7d',
];

interface ListParams {
  q?: string;
  status?: string;
  priority?: string;
  trainingId?: string;
  source?: string;
  assignedTo?: string;
  paymentStatus?: string;
  minScore?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crm: CrmService,
  ) {}

  private canSeeAll(): boolean {
    return getContext()?.permissions?.has('leads.settings') ?? false;
  }

  /** Resolve a legacy LeadStage id for the given bucket so reports keep working. */
  private async resolveStageId(bucket: 'won' | 'lost' | 'open'): Promise<string> {
    await this.crm.ensureDefaults();
    const stages = await this.prisma.scoped.leadStage.findMany({ orderBy: { order: 'asc' } });
    const fallback = stages[0];
    if (!fallback) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Pipeline mərhələləri yoxdur' });
    if (bucket === 'won') return (stages.find((s) => s.isWon) ?? fallback).id;
    if (bucket === 'lost') return (stages.find((s) => s.isLost) ?? fallback).id;
    return (stages.find((s) => !s.isWon && !s.isLost) ?? fallback).id;
  }

  private async nextLeadNo(tenantId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT COALESCE(MAX("leadNo"), 0) + 1 AS n FROM leads WHERE "tenantId" = ${tenantId}`,
    );
    return rows[0]?.n ?? 1;
  }

  // ===== Leads list (raw SQL for format-independent phone search) =====
  async listLeads(p: ListParams) {
    const tenantId = requireTenantId();
    const page = Math.max(1, Number(p.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(p.limit) || 25));
    const offset = (page - 1) * limit;

    const conds: Prisma.Sql[] = [
      Prisma.sql`l."tenantId" = ${tenantId}`,
      Prisma.sql`l."deletedAt" IS NULL`,
    ];
    if (p.status) conds.push(Prisma.sql`l.status = ${p.status}`);
    if (p.priority) conds.push(Prisma.sql`l.priority = ${p.priority}`);
    if (p.trainingId) conds.push(Prisma.sql`l."courseInterestId" = ${p.trainingId}`);
    if (p.source) conds.push(Prisma.sql`l."sourceKey" = ${p.source}`);
    if (p.assignedTo) conds.push(Prisma.sql`l."assignedTo" = ${p.assignedTo}`);
    if (p.paymentStatus) conds.push(Prisma.sql`l."paymentStatus" = ${p.paymentStatus}`);
    if (p.minScore != null && !Number.isNaN(Number(p.minScore))) {
      conds.push(Prisma.sql`l.score >= ${Number(p.minScore)}`);
    }
    if (p.dateFrom) conds.push(Prisma.sql`l."createdAt" >= ${new Date(p.dateFrom + 'T00:00:00.000Z')}`);
    if (p.dateTo) {
      const end = new Date(p.dateTo + 'T00:00:00.000Z');
      end.setUTCDate(end.getUTCDate() + 1);
      conds.push(Prisma.sql`l."createdAt" < ${end}`);
    }
    if (p.q && p.q.trim()) {
      const term = p.q.trim();
      const like = `%${term}%`;
      const digits = term.replace(/\D/g, '');
      if (digits.length >= 3) {
        // Normalize both sides: strip a leading 994 country code or a leading 0 trunk,
        // so "055 690 40 25", "4025", "+994556904025" all match the same number.
        let ns = digits;
        if (ns.startsWith('994')) ns = ns.slice(3);
        else if (ns.startsWith('0')) ns = ns.slice(1);
        const digitLike = `%${ns}%`;
        // stored phone digits, same normalization, as a SQL expression
        const storedDigits = Prisma.sql`regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')`;
        const storedNorm = Prisma.sql`(CASE WHEN ${storedDigits} LIKE '994%' THEN substring(${storedDigits} from 4) WHEN ${storedDigits} LIKE '0%' THEN substring(${storedDigits} from 2) ELSE ${storedDigits} END)`;
        conds.push(
          Prisma.sql`(l."fullName" ILIKE ${like} OR l.instagram ILIKE ${like} OR l.notes ILIKE ${like} OR ${storedNorm} LIKE ${digitLike})`,
        );
      } else {
        conds.push(
          Prisma.sql`(l."fullName" ILIKE ${like} OR l.instagram ILIKE ${like} OR l.notes ILIKE ${like} OR l.phone ILIKE ${like})`,
        );
      }
    }
    const whereSql = Prisma.join(conds, ' AND ');

    const sortMap: Record<string, string> = {
      lead_no: 'l."leadNo"',
      name: 'l."fullName"',
      date: 'l."createdAt"',
      score: 'l.score',
    };
    const sortCol = sortMap[p.sort ?? 'date'] ?? 'l."createdAt"';
    const dir = p.order === 'asc' ? 'ASC' : 'DESC';

    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT l.*, c.name AS training_name,
             u."firstName" AS assignee_first, u."lastName" AS assignee_last
      FROM leads l
      LEFT JOIN courses c ON c.id = l."courseInterestId"
      LEFT JOIN users u ON u.id = l."assignedTo"
      WHERE ${whereSql}
      ORDER BY ${Prisma.raw(sortCol)} ${Prisma.raw(dir)} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);
    const totalRows = await this.prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`SELECT count(*)::int AS count FROM leads l WHERE ${whereSql}`,
    );
    const total = totalRows[0]?.count ?? 0;

    return {
      data: rows.map((r) => this.shapeLeadRow(r)),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private shapeLeadRow(r: Record<string, unknown>) {
    const first = r.assignee_first as string | null;
    const last = r.assignee_last as string | null;
    return {
      id: r.id,
      leadNo: r.leadNo,
      fullName: r.fullName ?? r.name,
      phone: r.phone,
      email: r.email,
      instagram: r.instagram,
      status: r.status,
      priority: r.priority,
      score: r.score,
      source: r.sourceKey,
      trainingId: r.courseInterestId,
      trainingName: r.training_name ?? null,
      assignedTo: r.assignedTo,
      assigneeName: first ? `${first} ${last ?? ''}`.trim() : null,
      followupCount: r.followupCount,
      nextFollowupAt: r.nextFollowupAt,
      paymentStatus: r.paymentStatus,
      createdAt: r.createdAt,
    };
  }

  // ===== Pipeline (kanban) =====
  async pipeline() {
    const leads = await this.prisma.scoped.lead.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        leadNo: true,
        fullName: true,
        name: true,
        phone: true,
        status: true,
        priority: true,
        score: true,
        courseInterestId: true,
        assignedTo: true,
      },
    });
    const trainIds = [...new Set(leads.map((l) => l.courseInterestId).filter(Boolean) as string[])];
    const assigneeIds = [...new Set(leads.map((l) => l.assignedTo).filter(Boolean) as string[])];
    const [trainings, assignees] = await Promise.all([
      trainIds.length
        ? this.prisma.scoped.course.findMany({ where: { id: { in: trainIds } }, select: { id: true, name: true } })
        : [],
      assigneeIds.length
        ? this.prisma.scoped.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
    ]);
    const trainMap = new Map(trainings.map((t) => [t.id, t.name]));
    const assigneeMap = new Map(assignees.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const statusToCol = new Map<string, string>();
    for (const col of PIPELINE_COLUMNS) for (const s of col.statuses) statusToCol.set(s, col.key);

    return PIPELINE_COLUMNS.map((col) => {
      const colLeads = leads
        .filter((l) => statusToCol.get(l.status) === col.key)
        .map((l) => ({
          id: l.id,
          leadNo: l.leadNo,
          fullName: l.fullName ?? l.name,
          phone: l.phone,
          status: l.status,
          priority: l.priority,
          score: l.score,
          trainingName: l.courseInterestId ? (trainMap.get(l.courseInterestId) ?? null) : null,
          assigneeName: l.assignedTo ? (assigneeMap.get(l.assignedTo) ?? null) : null,
        }));
      return { key: col.key, label: col.label, count: colLeads.length, leads: colLeads };
    });
  }

  // ===== Create =====
  async createLead(dto: CreateSalesLeadDto, userId: string) {
    const tenantId = requireTenantId();
    const status = dto.status ?? 'yeni_lead';
    const stageId = await this.resolveStageId(stageBucketForStatus(status));
    const leadNo = await this.nextLeadNo(tenantId);

    const flags: Partial<ScoreFlags> = {};
    for (const k of FLAG_KEYS) flags[k] = Boolean(dto[k]);
    const score = computeScore(flags);
    const priority = computePriority(score);

    const lead = await this.prisma.scoped.lead.create({
      data: {
        tenantId,
        leadNo,
        name: dto.fullName,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        instagram: dto.instagram,
        age: dto.age,
        gender: dto.gender,
        city: dto.city,
        educationStatus: dto.educationStatus,
        currentField: dto.currentField,
        courseInterestId: dto.interestedTrainingId,
        campaignId: dto.campaignId,
        sourceKey: dto.source,
        status,
        stageId,
        score,
        priority,
        ...flags,
        assignedTo: dto.assignedTo ?? userId,
        ownerId: userId,
        createdBy: userId,
        notes: dto.notes,
        nextFollowupAt: dto.nextFollowupAt ? new Date(dto.nextFollowupAt) : undefined,
        ...(dto.firstContactAt ? { createdAt: new Date(dto.firstContactAt) } : {}),
      },
    });
    await this.prisma.scoped.leadActivity.create({
      data: { tenantId, leadId: lead.id, type: 'created', title: 'Lead yaradıldı', userId },
    });
    // optional first follow-up
    if (dto.nextFollowupAt) {
      await this.prisma.scoped.followup.create({
        data: { tenantId, leadId: lead.id, dueAt: new Date(dto.nextFollowupAt), createdBy: userId },
      });
    }
    this.audit.log({ action: 'create', entityType: 'lead', entityId: lead.id, after: lead });
    return lead;
  }

  // ===== Detail =====
  async getLead(id: string) {
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Müraciət tapılmadı' });
    const [activities, followups, payments, training, assignee] = await Promise.all([
      this.prisma.scoped.leadActivity.findMany({
        where: { leadId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.scoped.followup.findMany({ where: { leadId: id }, orderBy: { dueAt: 'desc' } }),
      this.prisma.scoped.leadPayment.findMany({ where: { leadId: id }, orderBy: { createdAt: 'desc' } }),
      lead.courseInterestId
        ? this.prisma.scoped.course.findFirst({ where: { id: lead.courseInterestId }, select: { id: true, name: true } })
        : null,
      lead.assignedTo
        ? this.prisma.scoped.user.findFirst({ where: { id: lead.assignedTo }, select: { id: true, firstName: true, lastName: true } })
        : null,
    ]);
    return { ...lead, activities, followups, payments, training, assignee };
  }

  async listActivities(id: string) {
    return this.prisma.scoped.leadActivity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ===== Update (+ scoring + status activity) =====
  async updateLead(id: string, dto: UpdateSalesLeadDto, userId: string) {
    const tenantId = requireTenantId();
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Müraciət tapılmadı' });

    // merge scoring flags
    const flags: Partial<ScoreFlags> = {};
    for (const k of FLAG_KEYS) {
      flags[k] = dto[k] !== undefined ? (dto[k] as boolean) : (lead[k] as boolean);
    }
    const score = computeScore(flags);
    const priority = computePriority(score);

    const statusChanged = dto.status !== undefined && dto.status !== lead.status;
    const data: Prisma.LeadUncheckedUpdateInput = {
      score,
      priority,
      ...flags,
    };
    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
      data.name = dto.fullName;
    }
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.instagram !== undefined) data.instagram = dto.instagram;
    if (dto.age !== undefined) data.age = dto.age;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.educationStatus !== undefined) data.educationStatus = dto.educationStatus;
    if (dto.currentField !== undefined) data.currentField = dto.currentField;
    if (dto.interestedTrainingId !== undefined) data.courseInterestId = dto.interestedTrainingId;
    if (dto.source !== undefined) data.sourceKey = dto.source;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.lostReason !== undefined) data.lostReason = dto.lostReason;
    if (dto.objectionReason !== undefined) data.objectionReason = dto.objectionReason;
    if (dto.demoStatus !== undefined) data.demoStatus = dto.demoStatus;
    if (dto.callStatus !== undefined) data.callStatus = dto.callStatus;
    if (dto.registrationStatus !== undefined) data.registrationStatus = dto.registrationStatus;
    if (dto.remarketingStatus !== undefined) data.remarketingStatus = dto.remarketingStatus;
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.paymentPlan !== undefined) data.paymentPlan = dto.paymentPlan;
    if (dto.discountPct !== undefined) data.discountPct = dto.discountPct;
    if (dto.budgetMatch !== undefined) data.budgetMatch = dto.budgetMatch;
    if (dto.courseStartDate !== undefined) data.courseStartDate = new Date(dto.courseStartDate);
    if (dto.firstContactChannel !== undefined) data.firstContactChannel = dto.firstContactChannel;

    if (statusChanged) {
      const bucket = stageBucketForStatus(dto.status!);
      data.status = dto.status;
      data.stageId = await this.resolveStageId(bucket);
      if (bucket === 'won') data.closedBy = userId;
    }

    const updated = await this.prisma.scoped.lead.update({ where: { id }, data });

    if (statusChanged) {
      await this.prisma.scoped.leadActivity.create({
        data: {
          tenantId,
          leadId: id,
          type: 'status_changed',
          title: `Status: ${lead.status} → ${dto.status}`,
          userId,
        },
      });
    }

    // Payments ledger sync: payment-status change drives the payments tab;
    // a refused lead cancels its open payments.
    if (dto.paymentStatus !== undefined && dto.paymentStatus !== lead.paymentStatus) {
      await this.syncLeadPayment(lead, dto.paymentStatus, userId);
    } else if (statusChanged && stageBucketForStatus(dto.status!) === 'lost') {
      await this.syncLeadPayment(lead, 'legv_edilib', userId);
      await this.prisma.scoped.lead.update({ where: { id }, data: { paymentStatus: 'legv_edilib' } });
    }

    // Registered leads automatically become students in the Education module
    // (only 'qeydiyyat_oldu'; convert() guards against double-conversion).
    if (statusChanged && dto.status === 'qeydiyyat_oldu' && !lead.convertedStudentId) {
      try {
        await this.crm.convert(id, {}, userId);
      } catch {
        // already converted or education guard — status change must not fail
      }
    }
    this.audit.log({ action: 'update', entityType: 'lead', entityId: id, after: updated });
    return updated;
  }

  /**
   * Keep the payments ledger in sync with the lead's payment status:
   * - 'odenib'  -> settle the open payment, or auto-create one from the
   *   interested course's monthly price (e.g. 300 AZN) so the month's sales
   *   revenue is counted automatically;
   * - 'legv_edilib' -> cancel open payments;
   * - other open states -> mirror the state onto the open payment (create it
   *   for deposit/partial so the debt becomes visible in the payments tab).
   */
  private async syncLeadPayment(
    lead: { id: string; courseInterestId: string | null },
    newStatus: string,
    userId: string,
  ) {
    const tenantId = requireTenantId();
    const OPEN = ['gozleyir', 'depozit_odedi', 'qismen_odenib', 'gecikib'];
    const open = await this.prisma.scoped.leadPayment.findFirst({
      where: { leadId: lead.id, status: { in: OPEN } },
      orderBy: { createdAt: 'desc' },
    });

    const monthlyPrice = async (): Promise<number> => {
      if (!lead.courseInterestId) return 0;
      const course = await this.prisma.scoped.course.findFirst({
        where: { id: lead.courseInterestId },
        select: { price: true },
      });
      return course?.price ?? 0;
    };

    const logPayment = (title: string, meta: Record<string, unknown> = {}) =>
      this.prisma.scoped.leadActivity.create({
        data: { tenantId, leadId: lead.id, type: 'payment', title, meta, userId },
      });

    if (newStatus === 'odenib') {
      if (open) {
        await this.prisma.scoped.leadPayment.update({
          where: { id: open.id },
          data: { status: 'odenib', amountPaid: open.amountDue, paidAt: new Date() },
        });
        await logPayment('Ödəniş tam ödənildi (status ilə avtomatik)', { amount: open.amountDue });
      } else {
        const amount = await monthlyPrice();
        await this.prisma.scoped.leadPayment.create({
          data: {
            tenantId,
            leadId: lead.id,
            trainingId: lead.courseInterestId,
            amountDue: amount,
            amountPaid: amount,
            monthlyAmount: amount || undefined,
            status: 'odenib',
            paidAt: new Date(),
            note: 'Avtomatik: lead statusu "Ödənilib" edildi',
            createdBy: userId,
          },
        });
        await logPayment('Ödəniş avtomatik hesablandı', { amount });
      }
    } else if (newStatus === 'legv_edilib') {
      if (open) {
        await this.prisma.scoped.leadPayment.updateMany({
          where: { leadId: lead.id, status: { in: OPEN } },
          data: { status: 'legv_edilib' },
        });
        await logPayment('Açıq ödənişlər ləğv edildi');
      }
    } else if (OPEN.includes(newStatus)) {
      if (open) {
        await this.prisma.scoped.leadPayment.update({ where: { id: open.id }, data: { status: newStatus } });
      } else if (newStatus === 'depozit_odedi' || newStatus === 'qismen_odenib') {
        const amount = await monthlyPrice();
        await this.prisma.scoped.leadPayment.create({
          data: {
            tenantId,
            leadId: lead.id,
            trainingId: lead.courseInterestId,
            amountDue: amount,
            amountPaid: 0,
            monthlyAmount: amount || undefined,
            status: newStatus,
            note: 'Avtomatik: lead ödəniş statusundan yaradıldı',
            createdBy: userId,
          },
        });
        await logPayment('Ödəniş borcu avtomatik yaradıldı', { amount });
      }
    }
  }

  async moveColumn(id: string, columnKey: string, userId: string) {
    const col = PIPELINE_COLUMNS.find((c) => c.key === columnKey);
    if (!col) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Yanlış sütun' });
    return this.updateLead(id, { status: col.primary }, userId);
  }

  async deleteLead(id: string) {
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Müraciət tapılmadı' });
    await this.prisma.scoped.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    this.audit.log({ action: 'delete', entityType: 'lead', entityId: id });
    return { ok: true };
  }

  async bulkAssign(dto: BulkAssignDto) {
    const res = await this.prisma.scoped.lead.updateMany({
      where: { id: { in: dto.ids }, deletedAt: null },
      data: { assignedTo: dto.assignedTo },
    });
    return { updated: res.count };
  }

  async addActivity(leadId: string, type: string, title: string | undefined, body: string | undefined, userId: string) {
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id: leadId, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Müraciət tapılmadı' });
    return this.prisma.scoped.leadActivity.create({
      data: { tenantId: requireTenantId(), leadId, type, title, body, userId, doneAt: new Date() },
    });
  }

  // ===== Follow-ups =====
  private bakuDayBounds() {
    const OFFSET = 4 * 60 * 60 * 1000;
    const baku = new Date(Date.now() + OFFSET);
    const y = baku.getUTCFullYear();
    const mo = baku.getUTCMonth();
    const d = baku.getUTCDate();
    return {
      startToday: new Date(Date.UTC(y, mo, d) - OFFSET),
      startTomorrow: new Date(Date.UTC(y, mo, d + 1) - OFFSET),
      startDayAfter: new Date(Date.UTC(y, mo, d + 2) - OFFSET),
    };
  }

  async followups(bucket: 'today' | 'overdue' | 'tomorrow' | 'all' | 'done' = 'today') {
    const { startToday, startTomorrow, startDayAfter } = this.bakuDayBounds();
    const where: Prisma.FollowupWhereInput = {};
    if (bucket === 'done') where.isDone = true;
    else {
      where.isDone = false;
      if (bucket === 'overdue') where.dueAt = { lt: startToday };
      else if (bucket === 'today') where.dueAt = { gte: startToday, lt: startTomorrow };
      else if (bucket === 'tomorrow') where.dueAt = { gte: startTomorrow, lt: startDayAfter };
    }
    const items = await this.prisma.scoped.followup.findMany({
      where,
      orderBy: { dueAt: bucket === 'done' ? 'desc' : 'asc' },
      take: 300,
    });
    const leadIds = [...new Set(items.map((i) => i.leadId))];
    const leads = leadIds.length
      ? await this.prisma.scoped.lead.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, fullName: true, name: true, phone: true, courseInterestId: true, assignedTo: true },
        })
      : [];
    const trainingIds = [...new Set(leads.map((l) => l.courseInterestId).filter(Boolean) as string[])];
    const assigneeIds = [...new Set(leads.map((l) => l.assignedTo).filter(Boolean) as string[])];
    const [trainings, users] = await Promise.all([
      trainingIds.length
        ? this.prisma.scoped.course.findMany({ where: { id: { in: trainingIds } }, select: { id: true, name: true } })
        : [],
      assigneeIds.length
        ? this.prisma.scoped.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, firstName: true, lastName: true } })
        : [],
    ]);
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const trainMap = new Map(trainings.map((t) => [t.id, t.name]));
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const [overdue, today, tomorrow] = await Promise.all([
      this.prisma.scoped.followup.count({ where: { isDone: false, dueAt: { lt: startToday } } }),
      this.prisma.scoped.followup.count({ where: { isDone: false, dueAt: { gte: startToday, lt: startTomorrow } } }),
      this.prisma.scoped.followup.count({ where: { isDone: false, dueAt: { gte: startTomorrow, lt: startDayAfter } } }),
    ]);

    return {
      counts: { overdue, today, tomorrow },
      items: items.map((f) => {
        const lead = leadMap.get(f.leadId);
        return {
          id: f.id,
          leadId: f.leadId,
          dueAt: f.dueAt,
          doneAt: f.doneAt,
          isDone: f.isDone,
          note: f.note,
          leadName: lead?.fullName ?? lead?.name ?? '—',
          leadPhone: lead?.phone ?? null,
          trainingName: lead?.courseInterestId ? (trainMap.get(lead.courseInterestId) ?? null) : null,
          assigneeName: lead?.assignedTo ? (userMap.get(lead.assignedTo) ?? null) : null,
        };
      }),
    };
  }

  async createFollowup(dto: CreateFollowupDto, userId: string) {
    const tenantId = requireTenantId();
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id: dto.leadId, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Müraciət tapılmadı' });
    const followup = await this.prisma.scoped.followup.create({
      data: { tenantId, leadId: dto.leadId, dueAt: new Date(dto.dueAt), note: dto.note, createdBy: userId },
    });
    await this.prisma.scoped.lead.update({ where: { id: dto.leadId }, data: { nextFollowupAt: new Date(dto.dueAt) } });
    await this.prisma.scoped.leadActivity.create({
      data: { tenantId, leadId: dto.leadId, type: 'followup', title: 'Follow-up planlandı', body: dto.note, userId },
    });
    return followup;
  }

  async updateFollowup(id: string, dto: UpdateFollowupDto) {
    const tenantId = requireTenantId();
    const fu = await this.prisma.scoped.followup.findFirst({ where: { id } });
    if (!fu) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Follow-up tapılmadı' });
    const data: Prisma.FollowupUpdateInput = {};
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.dueAt !== undefined) data.dueAt = new Date(dto.dueAt);
    if (dto.isDone === true && !fu.isDone) {
      data.isDone = true;
      data.doneAt = new Date();
      await this.prisma.scoped.lead.update({
        where: { id: fu.leadId },
        data: { followupCount: { increment: 1 }, lastContactAt: new Date() },
      });
      await this.prisma.scoped.leadActivity.create({
        data: { tenantId, leadId: fu.leadId, type: 'followup', title: 'Follow-up tamamlandı', doneAt: new Date() },
      });
    } else if (dto.isDone === false) {
      data.isDone = false;
      data.doneAt = null;
    }
    return this.prisma.scoped.followup.update({ where: { id }, data });
  }

  // ===== Dashboard =====
  async dashboardSummary(dateFrom?: string, dateTo?: string, assignedToFilter?: string) {
    const seeAll = this.canSeeAll();
    const userId = getContext()?.userId;
    const assignedTo = seeAll ? assignedToFilter : userId;

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

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [total, monthCount, registered, hot, won, closed, byTrainingRaw, lostRaw, recent, byManagerRaw, topSoldRaw, recentActs] =
      await Promise.all([
        this.prisma.scoped.lead.count({ where: baseWhere }),
        this.prisma.scoped.lead.count({ where: { ...baseWhere, createdAt: { gte: monthStart } } }),
        this.prisma.scoped.lead.count({ where: { ...baseWhere, status: 'qeydiyyat_oldu' } }),
        this.prisma.scoped.lead.count({ where: { ...baseWhere, priority: 'hot' } }),
        this.prisma.scoped.lead.count({ where: { ...baseWhere, status: { in: ['qeydiyyat_oldu', 'satis_baglandi'] } } }),
        this.prisma.scoped.lead.count({ where: baseWhere }),
        this.prisma.scoped.lead.groupBy({ by: ['courseInterestId'], where: baseWhere, _count: true }),
        this.prisma.scoped.lead.groupBy({
          by: ['lostReason'],
          where: { ...baseWhere, status: 'imtina', lostReason: { not: null } },
          _count: true,
        }),
        this.prisma.scoped.lead.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, leadNo: true, fullName: true, name: true, phone: true, status: true, priority: true, createdAt: true },
        }),
        seeAll
          ? this.prisma.scoped.lead.groupBy({ by: ['assignedTo'], where: baseWhere, _count: true })
          : Promise.resolve([]),
        this.prisma.scoped.lead.groupBy({
          by: ['courseInterestId'],
          where: { ...baseWhere, status: { in: ['qeydiyyat_oldu', 'satis_baglandi'] }, courseInterestId: { not: null } },
          _count: true,
        }),
        this.prisma.scoped.leadActivity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, leadId: true, type: true, title: true, createdAt: true },
        }),
      ]);

    // resolve training + manager names (incl. top-sold trainings and activity lead names)
    const trainIds = [
      ...new Set([
        ...(byTrainingRaw.map((t) => t.courseInterestId).filter(Boolean) as string[]),
        ...(topSoldRaw.map((t) => t.courseInterestId).filter(Boolean) as string[]),
      ]),
    ];
    const actLeadIds = [...new Set(recentActs.map((a) => a.leadId))];
    const mgrIds = (byManagerRaw as { assignedTo: string | null }[]).map((m) => m.assignedTo).filter(Boolean) as string[];
    const [trainings, managers, wonByManager, actLeads] = await Promise.all([
      trainIds.length
        ? this.prisma.scoped.course.findMany({ where: { id: { in: trainIds } }, select: { id: true, name: true } })
        : [],
      mgrIds.length
        ? this.prisma.scoped.user.findMany({ where: { id: { in: mgrIds } }, select: { id: true, firstName: true, lastName: true } })
        : [],
      seeAll
        ? this.prisma.scoped.lead.groupBy({
            by: ['assignedTo'],
            where: { ...baseWhere, status: { in: ['qeydiyyat_oldu', 'satis_baglandi'] } },
            _count: true,
          })
        : Promise.resolve([]),
      actLeadIds.length
        ? this.prisma.scoped.lead.findMany({
            where: { id: { in: actLeadIds } },
            select: { id: true, fullName: true, name: true },
          })
        : [],
    ]);
    const trainMap = new Map(trainings.map((t) => [t.id, t.name]));
    const actLeadMap = new Map(actLeads.map((l) => [l.id, l.fullName ?? l.name]));
    const mgrMap = new Map(managers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const wonMap = new Map(
      (wonByManager as { assignedTo: string | null; _count: number }[]).map((w) => [w.assignedTo, w._count]),
    );

    return {
      kpis: {
        total,
        monthCount,
        registered,
        hot,
        conversion: total > 0 ? Math.round((won / total) * 100) : 0,
      },
      byTraining: byTrainingRaw
        .map((t) => ({
          trainingId: t.courseInterestId,
          name: t.courseInterestId ? (trainMap.get(t.courseInterestId) ?? 'Naməlum') : 'Təyin edilməyib',
          count: t._count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      lostReasons: lostRaw
        .map((l) => ({ reason: l.lostReason ?? 'Naməlum', count: l._count }))
        .sort((a, b) => b.count - a.count),
      managers: seeAll
        ? (byManagerRaw as { assignedTo: string | null; _count: number }[])
            .map((m) => ({
              userId: m.assignedTo,
              name: m.assignedTo ? (mgrMap.get(m.assignedTo) ?? 'Naməlum') : 'Təyin edilməyib',
              total: m._count,
              won: (m.assignedTo && wonMap.get(m.assignedTo)) || 0,
            }))
            .sort((a, b) => b.won - a.won)
        : [],
      topSold: topSoldRaw
        .map((t) => ({
          trainingId: t.courseInterestId,
          name: t.courseInterestId ? (trainMap.get(t.courseInterestId) ?? 'Naməlum') : 'Naməlum',
          count: t._count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      recentActivities: recentActs.map((a) => ({
        id: a.id,
        leadId: a.leadId,
        type: a.type,
        title: a.title,
        leadName: actLeadMap.get(a.leadId) ?? '—',
        createdAt: a.createdAt,
      })),
      recent: recent.map((r) => ({ ...r, fullName: r.fullName ?? r.name })),
      seeAll,
    };
  }
}
