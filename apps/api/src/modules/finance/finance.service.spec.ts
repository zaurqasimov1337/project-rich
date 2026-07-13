import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { requestContext } from '../../core/context/request-context';
import { FinanceService } from './finance.service';

describe('FinanceService payment flow', () => {
  const T = '00000000-0000-4000-8000-0000000000c1';
  const USER = '00000000-0000-4000-8000-0000000000c2';
  let prisma: PrismaService;
  let service: FinanceService;
  let studentId: string;

  const run = <R>(fn: () => Promise<R>): Promise<R> =>
    requestContext.run({ requestId: 'test', realm: 'tenant', tenantId: T }, async () => fn());

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new FinanceService(prisma, new AuditService(prisma));

    await cleanup();
    await prisma.tenant.create({ data: { id: T, name: 'FinTest', slug: 'fin-test' } });
    const student = await prisma.student.create({
      data: { tenantId: T, code: 'FT001', firstName: 'Test', lastName: 'Student' },
    });
    studentId = student.id;
  });

  async function cleanup() {
    await prisma.transaction.deleteMany({ where: { tenantId: T } });
    await prisma.payment.deleteMany({ where: { tenantId: T } });
    await prisma.invoice.deleteMany({ where: { tenantId: T } });
    await prisma.cashAccount.deleteMany({ where: { tenantId: T } });
    await prisma.student.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  }

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('creates invoice with sequential number and computed total', async () => {
    const invoice = await run(() =>
      service.createInvoice({
        studentId,
        amount: 12000,
        discount: 2000,
        dueAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      }),
    );
    expect(invoice.total).toBe(10000);
    expect(invoice.number).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(invoice.status).toBe('open');
  });

  it('rejects discount exceeding amount', async () => {
    await expect(
      run(() =>
        service.createInvoice({
          studentId,
          amount: 1000,
          discount: 2000,
          dueAt: new Date().toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('partial payment sets status=partial and posts income transaction', async () => {
    const invoice = await run(() =>
      prisma.scoped.invoice.findFirstOrThrow({ where: { total: 10000 } }),
    );
    const payment = await run(() =>
      service.createPayment(
        { studentId, invoiceId: invoice.id, method: 'cash', amount: 4000 },
        USER,
        'key-1',
      ),
    );
    expect(payment.amount).toBe(4000);

    const updated = await run(() =>
      prisma.scoped.invoice.findFirstOrThrow({ where: { id: invoice.id } }),
    );
    expect(updated.status).toBe('partial');

    const txn = await run(() =>
      prisma.scoped.transaction.findFirst({
        where: { entityType: 'payment', entityId: payment.id },
      }),
    );
    expect(txn?.type).toBe('income');
    expect(txn?.amount).toBe(4000);
  });

  it('idempotency key returns the same payment without double-charging', async () => {
    const again = await run(() =>
      service.createPayment(
        { studentId, invoiceId: undefined, method: 'cash', amount: 4000 },
        USER,
        'key-1',
      ),
    );
    const count = await run(() => prisma.scoped.payment.count());
    expect(count).toBe(1);
    expect(again.amount).toBe(4000);
  });

  it('full payment sets status=paid', async () => {
    const invoice = await run(() =>
      prisma.scoped.invoice.findFirstOrThrow({ where: { total: 10000 } }),
    );
    await run(() =>
      service.createPayment(
        { studentId, invoiceId: invoice.id, method: 'card', amount: 6000 },
        USER,
        'key-2',
      ),
    );
    const updated = await run(() =>
      prisma.scoped.invoice.findFirstOrThrow({ where: { id: invoice.id } }),
    );
    expect(updated.status).toBe('paid');
  });

  it('void is blocked when invoice has payments', async () => {
    const invoice = await run(() =>
      prisma.scoped.invoice.findFirstOrThrow({ where: { total: 10000 } }),
    );
    await expect(run(() => service.voidInvoice(invoice.id))).rejects.toMatchObject({
      response: { code: 'CONFLICT' },
    });
  });

  it('summary aggregates income and debt correctly', async () => {
    const q = Object.assign(Object.create(Object.getPrototypeOf({})), {
      range: 'this_month',
    });
    const summary = await run(() => service.summary(q as never));
    expect(summary.income).toBe(10000);
    expect(summary.outstandingDebt).toBe(0);
  });
});
