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

  // --- Education demo data ---
  const existingCourses = await prisma.course.count({ where: { tenantId: tenant.id } });
  if (existingCourses === 0) {
    const rooms = await prisma.room.findMany({ where: { tenantId: tenant.id } });

    const catLang = await prisma.courseCategory.create({
      data: { tenantId: tenant.id, name: 'Dillər' },
    });
    const catIt = await prisma.courseCategory.create({
      data: { tenantId: tenant.id, name: 'İT' },
    });

    const english = await prisma.course.create({
      data: {
        tenantId: tenant.id, categoryId: catLang.id, name: 'İngilis dili — General',
        level: 'B1', pricingModel: 'monthly', price: 12000, durationWeeks: 24, defaultCapacity: 10,
        syllabus: [{ title: 'Grammar basics' }, { title: 'Speaking practice' }],
      },
    });
    const python = await prisma.course.create({
      data: {
        tenantId: tenant.id, categoryId: catIt.id, name: 'Python proqramlaşdırma',
        level: 'Başlanğıc', pricingModel: 'monthly', price: 18000, durationWeeks: 16, defaultCapacity: 12,
      },
    });
    await prisma.course.create({
      data: {
        tenantId: tenant.id, categoryId: catLang.id, name: 'SAT hazırlığı',
        level: 'Advanced', pricingModel: 'course', price: 90000, durationWeeks: 12, defaultCapacity: 8,
      },
    });

    // Teachers (users + teacher profiles)
    const teacherUsers = await Promise.all(
      [
        { email: 'aysel.m@demo.az', firstName: 'Aysel', lastName: 'Məmmədova', subjects: ['İngilis dili'] },
        { email: 'tural.h@demo.az', firstName: 'Tural', lastName: 'Həsənov', subjects: ['Python', 'Alqoritmlər'] },
      ].map(async (t) => {
        const user = await prisma.user.create({
          data: {
            tenantId: tenant.id, email: t.email,
            passwordHash: await argon2.hash('Demo123!'),
            firstName: t.firstName, lastName: t.lastName,
            roles: { create: { roleId: roleIds['teacher']! } },
          },
        });
        const teacher = await prisma.teacher.create({
          data: {
            tenantId: tenant.id, userId: user.id, subjects: t.subjects,
            maxWeeklyHours: 30,
            workingHours: {
              mon: { from: '09:00', to: '19:00' }, tue: { from: '09:00', to: '19:00' },
              wed: { from: '09:00', to: '19:00' }, thu: { from: '09:00', to: '19:00' },
              fri: { from: '09:00', to: '19:00' }, sat: { from: '10:00', to: '15:00' },
            },
          },
        });
        await prisma.teacherRate.create({
          data: { tenantId: tenant.id, teacherId: teacher.id, type: 'per_lesson', amount: 2500 },
        });
        return teacher;
      }),
    );

    // Students
    const studentNames: [string, string][] = [
      ['Nigar', 'Əliyeva'], ['Murad', 'Quliyev'], ['Leyla', 'Hüseynova'], ['Kamran', 'İsmayılov'],
      ['Aytac', 'Rzayeva'], ['Elvin', 'Cəfərov'], ['Səbinə', 'Nəbiyeva'], ['Rauf', 'Babayev'],
      ['Günel', 'Abbasova'], ['Orxan', 'Süleymanov'], ['Fidan', 'Kərimova'], ['Nihad', 'Mustafayev'],
    ];
    const students = [];
    for (let i = 0; i < studentNames.length; i++) {
      const [firstName, lastName] = studentNames[i]!;
      students.push(
        await prisma.student.create({
          data: {
            tenantId: tenant.id,
            code: `ST${String(i + 1).padStart(5, '0')}`,
            firstName, lastName,
            phone: `+99450${String(1000000 + i * 111).slice(0, 7)}`,
            branchId: branch!.id,
            status: 'active',
          },
        }),
      );
    }

    // Groups + enrollments
    const groupEng = await prisma.group.create({
      data: {
        tenantId: tenant.id, courseId: english.id, branchId: branch!.id,
        teacherId: teacherUsers[0]!.id, roomId: rooms[0]?.id,
        name: 'ENG-B1-01', capacity: 10, status: 'active',
        startDate: new Date('2026-06-01'),
      },
    });
    const groupPy = await prisma.group.create({
      data: {
        tenantId: tenant.id, courseId: python.id, branchId: branch!.id,
        teacherId: teacherUsers[1]!.id, roomId: rooms[1]?.id,
        name: 'PY-01', capacity: 12, status: 'active',
        startDate: new Date('2026-06-15'),
      },
    });
    await prisma.groupStudent.createMany({
      data: [
        ...students.slice(0, 7).map((s) => ({
          tenantId: tenant.id, groupId: groupEng.id, studentId: s.id, status: 'active',
        })),
        ...students.slice(5, 12).map((s) => ({
          tenantId: tenant.id, groupId: groupPy.id, studentId: s.id, status: 'active',
        })),
      ],
    });

    // Schedule rules + 2 weeks of lessons
    const ruleEng = await prisma.scheduleRule.create({
      data: {
        tenantId: tenant.id, groupId: groupEng.id, weekdays: [0, 2, 4],
        startTime: '18:00', endTime: '19:30', roomId: rooms[0]?.id,
        validFrom: new Date(), type: 'offline',
      },
    });
    const rulePy = await prisma.scheduleRule.create({
      data: {
        tenantId: tenant.id, groupId: groupPy.id, weekdays: [1, 3],
        startTime: '19:00', endTime: '21:00', roomId: rooms[1]?.id,
        validFrom: new Date(), type: 'hybrid',
      },
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (const { rule, group, teacher } of [
      { rule: ruleEng, group: groupEng, teacher: teacherUsers[0]! },
      { rule: rulePy, group: groupPy, teacher: teacherUsers[1]! },
    ]) {
      for (let i = 0; i < 14; i++) {
        const d = new Date(today.getTime() + i * 24 * 3600 * 1000);
        const weekday = (d.getUTCDay() + 6) % 7;
        if (!rule.weekdays.includes(weekday)) continue;
        const [sh, sm] = rule.startTime.split(':').map(Number);
        const [eh, em] = rule.endTime.split(':').map(Number);
        await prisma.lesson.create({
          data: {
            tenantId: tenant.id, groupId: group.id, ruleId: rule.id,
            teacherId: teacher.id, roomId: rule.roomId,
            date: d,
            startAt: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh! - 4, sm)),
            endAt: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), eh! - 4, em)),
            type: rule.type,
          },
        });
      }
    }
    console.log('Education demo data seeded (courses, teachers, students, groups, lessons)');
  }

  console.log('Seed complete: plans, platform user, demo tenant (owner@demo.az / Demo123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
