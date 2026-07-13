import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto, paginated, resolveDateRange } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { FinanceService } from './finance.service';
import {
  CashAccountDto,
  CategoryNameDto,
  CreateExpenseDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  GenerateInvoicesDto,
} from './dto/finance.dto';

@ApiTags('finance')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly prisma: PrismaService,
  ) {}

  // ----- summary -----

  @Get('finance/summary')
  @RequirePermissions('finance.read')
  summary(@Query() q: ListQueryDto) {
    return this.finance.summary(q);
  }

  @Get('finance/debts')
  @RequirePermissions('finance.read')
  debts(@Query() q: ListQueryDto) {
    return this.finance.debts(q);
  }

  // ----- invoices -----

  @Get('invoices')
  @RequirePermissions('finance.read')
  invoices(@Query() q: ListQueryDto, @Query('studentId') studentId?: string) {
    return this.finance.listInvoices(q, studentId);
  }

  @Post('invoices')
  @RequirePermissions('finance.invoices.manage')
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.finance.createInvoice(dto);
  }

  @Post('invoices/generate')
  @RequirePermissions('finance.invoices.manage')
  generate(@Body() dto: GenerateInvoicesDto) {
    return this.finance.generateMonthly(dto.period);
  }

  @Post('invoices/:id/void')
  @RequirePermissions('finance.invoices.void')
  voidInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.voidInvoice(id);
  }

  // ----- payments -----

  @Get('payments')
  @RequirePermissions('finance.read')
  async payments(@Query() q: ListQueryDto, @Query('studentId') studentId?: string) {
    const range = resolveDateRange(q);
    const where = {
      ...(studentId ? { studentId } : {}),
      ...(range ? { paidAt: range } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.payment.findMany({
        where,
        include: { cashAccount: { select: { name: true } }, invoice: { select: { number: true } } },
        orderBy: { paidAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.payment.count({ where }),
    ]);
    const students = await this.prisma.scoped.student.findMany({
      where: { id: { in: data.map((p) => p.studentId) } },
      select: { id: true, firstName: true, lastName: true, code: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s]));
    return paginated(
      data.map((p) => ({ ...p, student: sMap.get(p.studentId) ?? null })),
      total,
      q,
    );
  }

  @Post('payments')
  @RequirePermissions('finance.payments.create')
  createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.finance.createPayment(dto, user.userId, idempotencyKey);
  }

  // ----- expenses -----

  @Get('expense-categories')
  @RequirePermissions('finance.read')
  async categories() {
    const existing = await this.prisma.scoped.expenseCategory.findMany({ orderBy: { name: 'asc' } });
    if (existing.length > 0) return existing;
    const tenantId = requireTenantId();
    await this.prisma.expenseCategory.createMany({
      data: ['İcarə', 'Maaşlar', 'Kommunal', 'Marketinq', 'Avadanlıq', 'Digər'].map((name) => ({
        tenantId,
        name,
      })),
    });
    return this.prisma.scoped.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('expense-categories')
  @RequirePermissions('finance.expenses.manage')
  createCategory(@Body() dto: CategoryNameDto) {
    return this.prisma.scoped.expenseCategory.create({
      data: { tenantId: requireTenantId(), name: dto.name },
    });
  }

  @Get('expenses')
  @RequirePermissions('finance.read')
  async expenses(@Query() q: ListQueryDto) {
    const range = resolveDateRange(q);
    const where = { ...(range ? { date: range } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.scoped.expense.findMany({
        where,
        include: { category: { select: { name: true } }, cashAccount: { select: { name: true } } },
        orderBy: { date: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.expense.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  @Post('expenses')
  @RequirePermissions('finance.expenses.manage')
  async createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUser) {
    const tenantId = requireTenantId();
    const cashAccountId = dto.cashAccountId ?? (await this.finance.ensureDefaultAccount());
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          tenantId,
          categoryId: dto.categoryId,
          cashAccountId,
          amount: dto.amount,
          date: new Date(dto.date),
          vendor: dto.vendor,
          note: dto.note,
          branchId: dto.branchId,
          createdById: user.userId,
        },
      });
      await tx.transaction.create({
        data: {
          tenantId,
          cashAccountId,
          type: 'expense',
          amount: dto.amount,
          category: 'expense',
          entityType: 'expense',
          entityId: expense.id,
          date: new Date(dto.date),
        },
      });
      return expense;
    });
  }

  // ----- cash accounts -----

  @Get('cash-accounts')
  @RequirePermissions('finance.read')
  async cashAccounts() {
    await this.finance.ensureDefaultAccount();
    const accounts = await this.prisma.scoped.cashAccount.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const balances = await this.prisma.scoped.transaction.groupBy({
      by: ['cashAccountId', 'type'],
      _sum: { amount: true },
    });
    return accounts.map((a) => {
      let balance = 0;
      for (const b of balances) {
        if (b.cashAccountId !== a.id) continue;
        const amount = b._sum.amount ?? 0;
        balance += ['income', 'transfer_in'].includes(b.type) ? amount : -amount;
      }
      return { ...a, balance };
    });
  }

  @Post('cash-accounts')
  @RequirePermissions('finance.accounts.manage')
  createAccount(@Body() dto: CashAccountDto) {
    return this.prisma.scoped.cashAccount.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        type: dto.type ?? 'cash',
        branchId: dto.branchId,
      },
    });
  }

  // ----- transactions -----

  @Get('transactions')
  @RequirePermissions('finance.read')
  async transactions(@Query() q: ListQueryDto, @Query('cashAccountId') cashAccountId?: string) {
    const range = resolveDateRange(q);
    const where = {
      ...(cashAccountId ? { cashAccountId } : {}),
      ...(range ? { date: range } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.transaction.findMany({
        where,
        include: { cashAccount: { select: { name: true } } },
        orderBy: { date: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.transaction.count({ where }),
    ]);
    return paginated(data, total, q);
  }
}
