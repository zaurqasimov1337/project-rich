import { PrismaService } from './prisma.service';
import { requestContext } from '../context/request-context';

/**
 * Tenant-isolation contract tests. These run against the dev database and
 * verify the Prisma extension injects tenantId on every operation shape.
 */
describe('PrismaService tenant scoping', () => {
  let prisma: PrismaService;
  const T1 = '00000000-0000-4000-8000-0000000000a1';
  const T2 = '00000000-0000-4000-8000-0000000000a2';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.branch.deleteMany({ where: { tenantId: { in: [T1, T2] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [T1, T2] } } });
    await prisma.tenant.createMany({
      data: [
        { id: T1, name: 'T1', slug: 'iso-t1' },
        { id: T2, name: 'T2', slug: 'iso-t2' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.branch.deleteMany({ where: { tenantId: { in: [T1, T2] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [T1, T2] } } });
    await prisma.$disconnect();
  });

  // Await inside run(): Prisma promises are lazy and must execute within ALS scope.
  const inTenant = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
    requestContext.run(
      { requestId: 'test', realm: 'tenant', tenantId },
      async () => await fn(),
    );

  it('stamps tenantId on create', async () => {
    const branch = await inTenant(T1, () =>
      prisma.scoped.branch.create({ data: { name: 'B1' } as never }),
    );
    expect(branch.tenantId).toBe(T1);
  });

  it('filters reads by tenant', async () => {
    await inTenant(T2, () => prisma.scoped.branch.create({ data: { name: 'B2' } as never }));
    const t1Branches = await inTenant(T1, () => prisma.scoped.branch.findMany());
    expect(t1Branches.every((b) => b.tenantId === T1)).toBe(true);
    expect(t1Branches.some((b) => b.name === 'B2')).toBe(false);
  });

  it('blocks cross-tenant reads by id', async () => {
    const b2 = await inTenant(T2, () => prisma.scoped.branch.findFirst({ where: { name: 'B2' } }));
    const stolen = await inTenant(T1, () =>
      prisma.scoped.branch.findFirst({ where: { id: b2!.id } }),
    );
    expect(stolen).toBeNull();
  });

  it('blocks cross-tenant updates', async () => {
    const b2 = await inTenant(T2, () => prisma.scoped.branch.findFirst({ where: { name: 'B2' } }));
    const res = await inTenant(T1, () =>
      prisma.scoped.branch.updateMany({ where: { id: b2!.id }, data: { name: 'HACKED' } }),
    );
    expect(res.count).toBe(0);
  });

  it('throws when tenant-scoped model is used without context', async () => {
    await expect(prisma.scoped.branch.findMany()).rejects.toThrow(/without tenant context/);
  });

  it('counts are tenant-filtered', async () => {
    const c1 = await inTenant(T1, () => prisma.scoped.branch.count());
    expect(c1).toBe(1);
  });
});
