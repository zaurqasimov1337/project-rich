import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { WebhooksService } from '../integrations/webhooks.service';
import { ListQueryDto, paginated, resolveDateRange } from '../../common/dto/list-query.dto';
import { adSpendToAzn, fetchMetaAdsSpend, getMetaAdsCredentials } from '../integrations/meta-ads.util';
import type { CreateInvoiceDto, CreatePaymentDto } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async ensureDefaultAccount(): Promise<string> {
    const tenantId = requireTenantId();
    let account = await this.prisma.scoped.cashAccount.findFirst({ where: { deletedAt: null } });
    if (!account) {
      account = await this.prisma.scoped.cashAccount.create({
        data: { tenantId, name: 'Əsas kassa', type: 'cash' },
      });
    }
    return account.id;
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.scoped.invoice.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`) } },
    });
    return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ---------- invoices ----------

  async listInvoices(q: ListQueryDto, studentId?: string) {
    const range = resolveDateRange(q);
    // Refresh overdue flags lazily on read
    await this.prisma.scoped.invoice.updateMany({
      where: { status: { in: ['open', 'partial'] }, dueAt: { lt: new Date() } },
      data: { status: 'overdue' },
    });
    const where = {
      ...(studentId ? { studentId } : {}),
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(q.search ? { number: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.invoice.findMany({
        where,
        include: { payments: { select: { amount: true } } },
        orderBy: q.orderBy('createdAt', ['createdAt', 'dueAt', 'total', 'number']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.invoice.count({ where }),
    ]);
    // Join student names
    const students = await this.prisma.scoped.student.findMany({
      where: { id: { in: data.map((i) => i.studentId) } },
      select: { id: true, firstName: true, lastName: true, code: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s]));
    return paginated(
      data.map((i) => ({
        ...i,
        paid: i.payments.reduce((s, p) => s + p.amount, 0),
        student: sMap.get(i.studentId) ?? null,
        payments: undefined,
      })),
      total,
      q,
    );
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const student = await this.prisma.scoped.student.findFirst({
      where: { id: dto.studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found' });
    const total = dto.amount - (dto.discount ?? 0);
    if (total < 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Discount exceeds amount' });
    }
    const invoice = await this.prisma.scoped.invoice.create({
      data: {
        tenantId: requireTenantId(),
        studentId: dto.studentId,
        groupId: dto.groupId,
        number: await this.nextInvoiceNumber(),
        amount: dto.amount,
        discount: dto.discount ?? 0,
        total,
        dueAt: new Date(dto.dueAt),
        periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : undefined,
        periodTo: dto.periodTo ? new Date(dto.periodTo) : undefined,
        note: dto.note,
      },
    });
    this.audit.log({ action: 'create', entityType: 'invoice', entityId: invoice.id, after: invoice });
    return invoice;
  }

  /** Generates monthly invoices for all active enrollments (idempotent per period). */
  async generateMonthly(period: string) {
    const [yearS, monthS] = period.split('-');
    const year = Number(yearS);
    const month = Number(monthS);
    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'period must be YYYY-MM' });
    }
    const periodFrom = new Date(Date.UTC(year, month - 1, 1));
    const periodTo = new Date(Date.UTC(year, month, 0));
    const tenantId = requireTenantId();

    const enrollments = await this.prisma.scoped.groupStudent.findMany({
      where: {
        status: 'active',
        group: { deletedAt: null, status: 'active', course: { pricingModel: 'monthly' } },
      },
      include: { group: { include: { course: true } } },
    });

    const existing = await this.prisma.scoped.invoice.findMany({
      where: { periodFrom, periodTo },
      select: { studentId: true, groupId: true },
    });
    const existingKeys = new Set(existing.map((i) => `${i.studentId}:${i.groupId}`));

    let created = 0;
    for (const e of enrollments) {
      if (existingKeys.has(`${e.studentId}:${e.groupId}`)) continue;
      const amount = e.priceOverride ?? e.group.priceOverride ?? e.group.course.price;
      await this.prisma.scoped.invoice.create({
        data: {
          tenantId,
          studentId: e.studentId,
          groupId: e.groupId,
          number: await this.nextInvoiceNumber(),
          amount,
          total: amount,
          dueAt: new Date(Date.UTC(year, month - 1, 5)),
          periodFrom,
          periodTo,
          note: `${e.group.name} — ${period}`,
        },
      });
      created++;
    }
    return { created, skipped: enrollments.length - created };
  }

  async voidInvoice(id: string) {
    const invoice = await this.prisma.scoped.invoice.findFirst({
      where: { id },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });
    if (invoice.payments.length > 0) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Invoice has payments' });
    }
    await this.prisma.scoped.invoice.update({ where: { id }, data: { status: 'void' } });
    this.audit.log({ action: 'void', entityType: 'invoice', entityId: id });
    return { ok: true };
  }

  // ---------- payments ----------

  async createPayment(dto: CreatePaymentDto, userId: string, idempotencyKey?: string) {
    const tenantId = requireTenantId();
    if (idempotencyKey) {
      const existing = await this.prisma.scoped.payment.findFirst({ where: { idempotencyKey } });
      if (existing) return existing;
    }
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Amount must be positive' });
    }

    const cashAccountId = dto.cashAccountId ?? (await this.ensureDefaultAccount());

    let payment;
    try {
      payment = await this.createPaymentTx(dto, tenantId, cashAccountId, userId, idempotencyKey);
    } catch (err) {
      // Unique (tenantId, idempotencyKey) violation → concurrent duplicate; return the winner.
      if (
        idempotencyKey &&
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === 'P2002'
      ) {
        const existing = await this.prisma.scoped.payment.findFirst({ where: { idempotencyKey } });
        if (existing) return existing;
      }
      throw err;
    }
    this.audit.log({ action: 'create', entityType: 'payment', entityId: payment.id, after: payment });
    this.webhooks
      .dispatch('payment.received', {
        paymentId: payment.id,
        studentId: payment.studentId,
        amount: payment.amount,
        method: payment.method,
      })
      .catch(() => undefined);
    return payment;
  }

  private async createPaymentTx(
    dto: CreatePaymentDto,
    tenantId: string,
    cashAccountId: string,
    userId: string,
    idempotencyKey?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let invoice = null;
      if (dto.invoiceId) {
        invoice = await tx.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
        if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });
        if (invoice.status === 'void') {
          throw new BadRequestException({ code: 'CONFLICT', message: 'Invoice is void' });
        }
      }
      const p = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          studentId: dto.studentId,
          cashAccountId,
          method: dto.method,
          amount: dto.amount,
          reference: dto.reference,
          idempotencyKey,
          receivedById: userId,
        },
      });
      await tx.transaction.create({
        data: {
          tenantId,
          cashAccountId,
          type: 'income',
          amount: dto.amount,
          category: 'tuition',
          entityType: 'payment',
          entityId: p.id,
        },
      });
      if (invoice) {
        const paidAgg = await tx.payment.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { amount: true },
        });
        const paid = paidAgg._sum.amount ?? 0;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: paid >= invoice.total ? 'paid' : 'partial',
          },
        });
      }
      return p;
    });
  }

  // ---------- summary ----------

  async summary(q: ListQueryDto) {
    const range = resolveDateRange(q) ?? {
      gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      lt: new Date(),
    };
    const [income, expenses, debts, monthlySeries] = await Promise.all([
      this.prisma.scoped.transaction.aggregate({
        where: { type: 'income', date: { gte: range.gte, lt: range.lt } },
        _sum: { amount: true },
      }),
      this.prisma.scoped.transaction.aggregate({
        where: { type: { in: ['expense', 'payroll'] }, date: { gte: range.gte, lt: range.lt } },
        _sum: { amount: true },
      }),
      this.prisma.scoped.invoice.aggregate({
        where: { status: { in: ['overdue', 'partial', 'open'] } },
        _sum: { total: true },
      }),
      this.monthlySeries(),
    ]);
    const totalIncome = income._sum.amount ?? 0;

    // Instagram ad spend is billed by Meta in USD, but the books are kept in AZN.
    // Convert the period's Instagram spend at the fixed rate and fold it into the
    // expense total so "how much did we spend" reflects the ad budget too.
    let adSpendAzn = 0;
    const adsCreds = await getMetaAdsCredentials(this.prisma);
    if (adsCreds) {
      try {
        const spend = await fetchMetaAdsSpend(
          adsCreds.adAccountId,
          adsCreds.token,
          range.gte,
          range.lt,
        );
        adSpendAzn = adSpendToAzn(spend.instagram, adsCreds.currency);
      } catch {
        // An expired/invalid token must not blank the whole finance summary.
        adSpendAzn = 0;
      }
    }

    const totalExpense = (expenses._sum.amount ?? 0) + adSpendAzn;
    return {
      income: totalIncome,
      expense: totalExpense,
      adSpend: adSpendAzn,
      profit: totalIncome - totalExpense,
      outstandingDebt: debts._sum.total ?? 0,
      series: monthlySeries,
    };
  }

  private async monthlySeries() {
    const from = new Date();
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const txns = await this.prisma.scoped.transaction.findMany({
      where: { date: { gte: from } },
      select: { type: true, amount: true, date: true },
    });
    const buckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, {
        income: 0,
        expense: 0,
      });
    }
    for (const t of txns) {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (t.type === 'income') bucket.income += t.amount;
      else if (t.type === 'expense' || t.type === 'payroll') bucket.expense += t.amount;
    }
    return [...buckets.entries()].map(([month, v]) => ({ month, ...v }));
  }

  async debts(q: ListQueryDto) {
    await this.prisma.scoped.invoice.updateMany({
      where: { status: { in: ['open', 'partial'] }, dueAt: { lt: new Date() } },
      data: { status: 'overdue' },
    });
    const where = { status: { in: ['overdue', 'partial', 'open'] } };
    const [invoices, total] = await Promise.all([
      this.prisma.scoped.invoice.findMany({
        where,
        include: { payments: { select: { amount: true } } },
        orderBy: { dueAt: 'asc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.invoice.count({ where }),
    ]);
    const students = await this.prisma.scoped.student.findMany({
      where: { id: { in: invoices.map((i) => i.studentId) } },
      select: { id: true, firstName: true, lastName: true, code: true, phone: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s]));
    return paginated(
      invoices.map((i) => {
        const paid = i.payments.reduce((s, p) => s + p.amount, 0);
        return {
          id: i.id,
          number: i.number,
          student: sMap.get(i.studentId) ?? null,
          total: i.total,
          paid,
          remaining: i.total - paid,
          dueAt: i.dueAt,
          status: i.status,
          overdueDays: Math.max(0, Math.floor((Date.now() - i.dueAt.getTime()) / 86400000)),
        };
      }),
      total,
      q,
    );
  }
}
