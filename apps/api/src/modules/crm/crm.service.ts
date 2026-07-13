import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { ListQueryDto, paginated, resolveDateRange } from '../../common/dto/list-query.dto';
import type { CreateLeadDto, UpdateLeadDto } from './dto/crm.dto';

export const DEFAULT_STAGES = [
  { name: 'Yeni', order: 0, color: '#0EA5E9' },
  { name: 'Əlaqə saxlanılıb', order: 1, color: '#8B5CF6' },
  { name: 'Sınaq dərsi', order: 2, color: '#F59E0B' },
  { name: 'Qeydiyyat', order: 3, color: '#16A34A', isWon: true },
  { name: 'İtirilib', order: 4, color: '#DC2626', isLost: true },
];

export const DEFAULT_SOURCES = ['Instagram', 'Facebook', 'Google', 'Tövsiyə', 'Gəliş', 'Sayt'];

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Seeds default pipeline for a tenant if empty (idempotent). */
  async ensureDefaults(): Promise<void> {
    const tenantId = requireTenantId();
    const count = await this.prisma.scoped.leadStage.count();
    if (count === 0) {
      await this.prisma.leadStage.createMany({
        data: DEFAULT_STAGES.map((s) => ({ tenantId, ...s })),
      });
      await this.prisma.leadSource.createMany({
        data: DEFAULT_SOURCES.map((name) => ({ tenantId, name })),
      });
    }
  }

  async listLeads(q: ListQueryDto, filters: { stageId?: string; sourceId?: string; ownerId?: string }) {
    const range = resolveDateRange(q);
    const where = {
      deletedAt: null,
      ...(filters.stageId ? { stageId: filters.stageId } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { phone: { contains: q.search } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.lead.findMany({
        where,
        include: {
          stage: { select: { id: true, name: true, color: true, isWon: true, isLost: true } },
          source: { select: { id: true, name: true } },
        },
        orderBy: q.orderBy('createdAt', ['createdAt', 'name']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.lead.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  /** Kanban feed: all open leads grouped client-side; capped per stage. */
  async board() {
    const stages = await this.prisma.scoped.leadStage.findMany({ orderBy: { order: 'asc' } });
    const leads = await this.prisma.scoped.lead.findMany({
      where: { deletedAt: null, stage: { isLost: false, isWon: false } },
      include: { source: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const closed = await this.prisma.scoped.lead.groupBy({
      by: ['stageId'],
      where: { deletedAt: null, stage: { OR: [{ isWon: true }, { isLost: true }] } },
      _count: true,
    });
    return {
      stages,
      leads,
      closedCounts: Object.fromEntries(closed.map((c) => [c.stageId, c._count])),
    };
  }

  async createLead(dto: CreateLeadDto, userId: string) {
    let stageId = dto.stageId;
    if (!stageId) {
      const first = await this.prisma.scoped.leadStage.findFirst({ orderBy: { order: 'asc' } });
      if (!first) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'No pipeline stages' });
      stageId = first.id;
    }
    const lead = await this.prisma.scoped.lead.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        sourceId: dto.sourceId,
        stageId,
        ownerId: dto.ownerId ?? userId,
        courseInterestId: dto.courseInterestId,
        value: dto.value,
        branchId: dto.branchId,
        notes: dto.notes,
        utm: dto.utm ?? {},
      },
    });
    this.audit.log({ action: 'create', entityType: 'lead', entityId: lead.id, after: lead });
    return lead;
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lead not found' });
    return this.prisma.scoped.lead.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        phone: dto.phone ?? undefined,
        email: dto.email ?? undefined,
        sourceId: dto.sourceId ?? undefined,
        ownerId: dto.ownerId ?? undefined,
        courseInterestId: dto.courseInterestId ?? undefined,
        value: dto.value ?? undefined,
        branchId: dto.branchId ?? undefined,
        notes: dto.notes ?? undefined,
        lostReason: dto.lostReason ?? undefined,
      },
    });
  }

  async moveStage(id: string, stageId: string, userId: string, lostReason?: string) {
    const [lead, stage] = await Promise.all([
      this.prisma.scoped.lead.findFirst({ where: { id, deletedAt: null }, include: { stage: true } }),
      this.prisma.scoped.leadStage.findFirst({ where: { id: stageId } }),
    ]);
    if (!lead || !stage) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    await this.prisma.scoped.lead.update({
      where: { id },
      data: { stageId, lostReason: stage.isLost ? (lostReason ?? 'Səbəb göstərilməyib') : null },
    });
    await this.prisma.scoped.leadActivity.create({
      data: {
        tenantId: requireTenantId(),
        leadId: id,
        type: 'stage_change',
        body: `${lead.stage.name} → ${stage.name}`,
        userId,
        doneAt: new Date(),
      },
    });
    return { ok: true };
  }

  /** Converts a lead to a student (+ optional group enrollment). */
  async convert(id: string, opts: { groupId?: string }, userId: string) {
    const lead = await this.prisma.scoped.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lead not found' });
    if (lead.convertedStudentId) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Lead already converted' });
    }
    const tenantId = requireTenantId();
    const [firstName, ...rest] = lead.name.trim().split(/\s+/);
    const count = await this.prisma.scoped.student.count();

    const student = await this.prisma.scoped.student.create({
      data: {
        tenantId,
        code: `ST${String(count + 1).padStart(5, '0')}`,
        firstName: firstName ?? lead.name,
        lastName: rest.join(' ') || '—',
        phone: lead.phone,
        email: lead.email,
        branchId: lead.branchId,
        leadId: lead.id,
      },
    });
    if (opts.groupId) {
      await this.prisma.scoped.groupStudent.create({
        data: { tenantId, groupId: opts.groupId, studentId: student.id },
      });
    }
    const wonStage = await this.prisma.scoped.leadStage.findFirst({ where: { isWon: true } });
    await this.prisma.scoped.lead.update({
      where: { id },
      data: { convertedStudentId: student.id, ...(wonStage ? { stageId: wonStage.id } : {}) },
    });
    await this.prisma.scoped.leadActivity.create({
      data: {
        tenantId, leadId: id, type: 'note',
        body: `Tələbəyə çevrildi: ${student.code}`, userId, doneAt: new Date(),
      },
    });
    this.audit.log({ action: 'convert', entityType: 'lead', entityId: id, after: { studentId: student.id } });
    return { studentId: student.id };
  }

  async funnel(q: ListQueryDto) {
    const range = resolveDateRange(q) ?? {
      gte: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      lt: new Date(),
    };
    const [stages, counts, spend] = await Promise.all([
      this.prisma.scoped.leadStage.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.scoped.lead.groupBy({
        by: ['stageId'],
        where: { deletedAt: null, createdAt: range },
        _count: true,
      }),
      this.prisma.scoped.adSpend.aggregate({
        where: { date: { gte: range.gte, lt: range.lt } },
        _sum: { amount: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.stageId, c._count]));
    const totalLeads = counts.reduce((s, c) => s + c._count, 0);
    const won = stages.filter((s) => s.isWon).reduce((s, st) => s + (countMap.get(st.id) ?? 0), 0);
    const totalSpend = spend._sum.amount ?? 0;
    return {
      stages: stages.map((s) => ({ id: s.id, name: s.name, color: s.color, count: countMap.get(s.id) ?? 0 })),
      totalLeads,
      won,
      conversionRate: totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0,
      adSpend: totalSpend,
      cpl: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
      cac: won > 0 ? Math.round(totalSpend / won) : 0,
    };
  }
}
