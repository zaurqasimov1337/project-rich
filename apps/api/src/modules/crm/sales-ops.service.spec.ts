import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { requestContext } from '../../core/context/request-context';
import { SalesOpsService } from './sales-ops.service';

describe('SalesOpsService (lead payments, team, reports)', () => {
  const T = '00000000-0000-4000-8000-0000000000d1';
  const USER = '00000000-0000-4000-8000-0000000000d2';
  let prisma: PrismaService;
  let service: SalesOpsService;
  let leadId: string;

  const run = <R>(fn: () => Promise<R>, perms: string[] = ['leads.settings']): Promise<R> =>
    requestContext.run(
      { requestId: 'test', realm: 'tenant', tenantId: T, userId: USER, permissions: new Set(perms) },
      async () => fn(),
    );

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new SalesOpsService(prisma, new AuditService(prisma));

    await cleanup();
    await prisma.tenant.create({ data: { id: T, name: 'SalesOpsTest', slug: 'sales-ops-test' } });
    await prisma.user.create({
      data: {
        id: USER,
        tenantId: T,
        email: 'salesops-test@test.local',
        passwordHash: 'x',
        firstName: 'Satış',
        lastName: 'Meneceri',
      },
    });
    const stage = await prisma.leadStage.create({ data: { tenantId: T, name: 'Yeni', order: 0 } });
    const lead = await prisma.lead.create({
      data: {
        tenantId: T,
        name: 'Test Lead',
        fullName: 'Test Lead',
        phone: '0551112233',
        stageId: stage.id,
        status: 'qeydiyyat_oldu',
        assignedTo: USER,
      },
    });
    leadId = lead.id;
  });

  async function cleanup() {
    await prisma.leadPayment.deleteMany({ where: { tenantId: T } });
    await prisma.leadActivity.deleteMany({ where: { tenantId: T } });
    await prisma.salesManagerProfile.deleteMany({ where: { tenantId: T } });
    await prisma.lead.deleteMany({ where: { tenantId: T } });
    await prisma.leadStage.deleteMany({ where: { tenantId: T } });
    await prisma.user.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  }

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('creates a payment, mirrors status/method to the lead and logs an activity', async () => {
    const payment = await run(() =>
      service.createPayment(
        { leadId, amountDue: 120000, amountPaid: 50000, status: 'qismen_odenib', method: 'kart' },
        USER,
      ),
    );
    expect(payment.amountDue).toBe(120000);
    expect(payment.status).toBe('qismen_odenib');

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    expect(lead?.paymentStatus).toBe('qismen_odenib');
    expect(lead?.paymentMethod).toBe('kart');

    const activity = await prisma.leadActivity.findFirst({
      where: { tenantId: T, leadId, type: 'payment' },
    });
    expect(activity).toBeTruthy();
  });

  it('lists payments with remaining amount and totals', async () => {
    const res = await run(() => service.listPayments({}));
    expect(res.total).toBe(1);
    expect(res.data[0]?.remaining).toBe(70000);
    expect(res.totals.due).toBe(120000);
    expect(res.totals.paid).toBe(50000);
  });

  it('computes team KPIs with default 5% bonus of collected revenue', async () => {
    const team = await run(() => service.team());
    const row = team.data.find((r) => r.userId === USER);
    expect(row).toBeTruthy();
    expect(row!.totalLeads).toBe(1);
    expect(row!.closedCount).toBe(1);
    expect(row!.conversionRate).toBe(100);
    expect(row!.revenue).toBe(50000);
    expect(row!.bonus).toBe(2500); // 5% of 50000
  });

  it('updates bonus rate via profile upsert and recalculates bonus', async () => {
    await run(() => service.updateTeamMember(USER, 10));
    const team = await run(() => service.team());
    const row = team.data.find((r) => r.userId === USER);
    expect(row!.bonusRate).toBe(10);
    expect(row!.bonus).toBe(5000);
  });

  it('scopes team to own results for non-privileged users', async () => {
    const team = await run(() => service.team(), ['leads.read']);
    expect(team.seeAll).toBe(false);
    expect(team.data.every((r) => r.userId === USER)).toBe(true);
  });

  it('reports overview aggregates funnel and revenue', async () => {
    const report = await run(() => service.reportsOverview());
    expect(report.summary.total).toBe(1);
    expect(report.summary.registered).toBe(1);
    expect(report.summary.conversionRate).toBe(100);
    expect(report.summary.revenue).toBe(50000);
    const registered = report.funnel.find((f) => f.key === 'registered');
    expect(registered?.count).toBe(1);
  });

  it('neutralizes spreadsheet formulas in CSV export', async () => {
    await prisma.lead.update({ where: { id: leadId }, data: { fullName: '=HYPERLINK("evil")' } });
    const csv = await run(() => service.exportLeadsCsv());
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    await prisma.lead.update({ where: { id: leadId }, data: { fullName: 'Test Lead' } });
  });
});
