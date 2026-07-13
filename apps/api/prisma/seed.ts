import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@edusphere/shared';

const prisma = new PrismaClient();

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    priceMonthly: 4900,
    priceYearly: 49000,
    sortOrder: 1,
    limits: { users: 5, students: 100, teachers: 10, branches: 1, aiRequests: 100, storageMb: 1024, apiCalls: 0 },
    features: { crm: true, finance: true, marketing: false, ai: false, lms: true, hr: false, payroll: false, api: false, whiteLabel: false, multiBranch: false, whatsapp: false, webhooks: false },
  },
  {
    code: 'professional',
    name: 'Professional',
    priceMonthly: 9900,
    priceYearly: 99000,
    sortOrder: 2,
    limits: { users: 15, students: 500, teachers: 30, branches: 3, aiRequests: 1000, storageMb: 10240, apiCalls: 10000 },
    features: { crm: true, finance: true, marketing: true, ai: true, lms: true, hr: true, payroll: true, api: false, whiteLabel: false, multiBranch: true, whatsapp: false, webhooks: true },
  },
  {
    code: 'business',
    name: 'Business',
    priceMonthly: 19900,
    priceYearly: 199000,
    sortOrder: 3,
    limits: { users: 50, students: 2000, teachers: 100, branches: 10, aiRequests: 5000, storageMb: 51200, apiCalls: 100000 },
    features: { crm: true, finance: true, marketing: true, ai: true, lms: true, hr: true, payroll: true, api: true, whiteLabel: false, multiBranch: true, whatsapp: true, webhooks: true },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 49900,
    priceYearly: 499000,
    sortOrder: 4,
    limits: { users: -1, students: -1, teachers: -1, branches: -1, aiRequests: 50000, storageMb: 512000, apiCalls: -1 },
    features: { crm: true, finance: true, marketing: true, ai: true, lms: true, hr: true, payroll: true, api: true, whiteLabel: true, multiBranch: true, whatsapp: true, webhooks: true },
  },
];

async function main() {
  // --- Plans ---
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: { limits: p.limits, features: p.features, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly },
      create: p,
    });
  }

  // --- Platform super admin ---
  await prisma.platformUser.upsert({
    where: { email: 'root@edusphere.app' },
    update: {},
    create: {
      email: 'root@edusphere.app',
      passwordHash: await argon2.hash('Root123!'),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
    },
  });

  // --- Demo tenant ---
  const businessPlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'business' } });
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Tədris Mərkəzi',
      slug: 'demo',
      status: 'active',
      planId: businessPlan.id,
      trialEndsAt: null,
    },
  });

  await prisma.subscription.upsert({
    where: { id: `${tenant.id}` },
    update: {},
    create: {
      id: tenant.id, // 1:1 demo subscription keyed by tenant for idempotent seed
      tenantId: tenant.id,
      planId: businessPlan.id,
      period: 'yearly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  });

  // --- Roles + permissions ---
  const roleIds: Record<string, string> = {};
  for (const [key, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: {
        tenantId: tenant.id,
        key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        isSystem: true,
      },
    });
    roleIds[key] = role.id;
    const list = perms === '*' ? ALL_PERMISSIONS : perms;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: list.map((permission) => ({ roleId: role.id, permission })),
    });
  }

  // --- Owner user ---
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@demo.az' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@demo.az',
      passwordHash: await argon2.hash('Demo123!'),
      firstName: 'Zaur',
      lastName: 'Qasımov',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: roleIds['owner']! } },
    update: {},
    create: { userId: owner.id, roleId: roleIds['owner']! },
  });

  // --- Main branch + rooms ---
  let branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isMain: true } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Mərkəz filialı',
        address: 'Bakı, Nizami küç. 12',
        phone: '+994501234567',
        isMain: true,
        workingHours: {
          mon: { from: '09:00', to: '20:00' }, tue: { from: '09:00', to: '20:00' },
          wed: { from: '09:00', to: '20:00' }, thu: { from: '09:00', to: '20:00' },
          fri: { from: '09:00', to: '20:00' }, sat: { from: '10:00', to: '16:00' },
        },
      },
    });
    await prisma.room.createMany({
      data: [
        { tenantId: tenant.id, branchId: branch.id, name: 'Otaq 101', number: '101', capacity: 12, floor: 1, equipment: ['projector', 'whiteboard'] },
        { tenantId: tenant.id, branchId: branch.id, name: 'Otaq 102', number: '102', capacity: 8, floor: 1, equipment: ['whiteboard'] },
        { tenantId: tenant.id, branchId: branch.id, name: 'Konfrans zalı', number: '201', capacity: 40, floor: 2, equipment: ['projector', 'sound'] },
      ],
    });
  }

  console.log('Seed complete: plans, platform user, demo tenant (owner@demo.az / Demo123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
