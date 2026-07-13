import { PrismaService } from '../../core/prisma/prisma.service';
import { requestContext } from '../../core/context/request-context';
import { ScheduleService } from './schedule.service';
import { SCHEDULE_CONFLICTS } from '@edusphere/shared';

/**
 * Integration tests for the schedule conflict engine against the dev DB,
 * inside an isolated test tenant.
 */
describe('ScheduleService.validate', () => {
  const T = '00000000-0000-4000-8000-0000000000b1';
  let prisma: PrismaService;
  let service: ScheduleService;
  let groupId: string;
  let smallGroupRoomId: string;
  let teacherId: string;
  let roomId: string;

  const run = <R>(fn: () => Promise<R>): Promise<R> =>
    requestContext.run({ requestId: 'test', realm: 'tenant', tenantId: T }, async () => fn());

  // Next Monday 18:00–19:30 UTC (inside teacher working hours 09:00-19:30)
  const monday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  const at = (h: number, m = 0) =>
    new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), h, m));

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ScheduleService(prisma);

    // clean slate
    await prisma.lesson.deleteMany({ where: { tenantId: T } });
    await prisma.groupStudent.deleteMany({ where: { tenantId: T } });
    await prisma.group.deleteMany({ where: { tenantId: T } });
    await prisma.student.deleteMany({ where: { tenantId: T } });
    await prisma.teacher.deleteMany({ where: { tenantId: T } });
    await prisma.user.deleteMany({ where: { tenantId: T } });
    await prisma.room.deleteMany({ where: { tenantId: T } });
    await prisma.holiday.deleteMany({ where: { tenantId: T } });
    await prisma.branch.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });

    await prisma.tenant.create({ data: { id: T, name: 'SchedTest', slug: 'sched-test' } });
    const branch = await prisma.branch.create({ data: { tenantId: T, name: 'Main', isMain: true } });
    const room = await prisma.room.create({
      data: { tenantId: T, branchId: branch.id, name: 'R1', capacity: 10 },
    });
    const smallRoom = await prisma.room.create({
      data: { tenantId: T, branchId: branch.id, name: 'R2-small', capacity: 1 },
    });
    roomId = room.id;
    smallGroupRoomId = smallRoom.id;

    const user = await prisma.user.create({
      data: {
        tenantId: T, email: 'sched-teacher@test.az', passwordHash: 'x',
        firstName: 'Test', lastName: 'Teacher',
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        tenantId: T, userId: user.id, maxWeeklyHours: 4,
        workingHours: {
          mon: { from: '09:00', to: '19:30' }, tue: { from: '09:00', to: '19:30' },
          wed: { from: '09:00', to: '19:30' }, thu: { from: '09:00', to: '19:30' },
          fri: { from: '09:00', to: '19:30' },
        },
      },
    });
    teacherId = teacher.id;

    const course = await prisma.course.create({
      data: { tenantId: T, name: 'C1', pricingModel: 'monthly', price: 100 },
    });
    const group = await prisma.group.create({
      data: {
        tenantId: T, courseId: course.id, branchId: branch.id,
        teacherId, roomId, name: 'G1', capacity: 10, status: 'active',
      },
    });
    groupId = group.id;

    // enroll 2 students (for capacity test vs smallRoom cap=1)
    for (let i = 0; i < 2; i++) {
      const s = await prisma.student.create({
        data: { tenantId: T, code: `TS${i}`, firstName: `S${i}`, lastName: 'Test' },
      });
      await prisma.groupStudent.create({
        data: { tenantId: T, groupId: group.id, studentId: s.id, status: 'active' },
      });
    }

    // existing lesson Monday 10:00–11:00
    await prisma.lesson.create({
      data: {
        tenantId: T, groupId, teacherId, roomId,
        date: monday, startAt: at(10), endAt: at(11), status: 'scheduled',
      },
    });
  });

  afterAll(async () => {
    await prisma.lesson.deleteMany({ where: { tenantId: T } });
    await prisma.groupStudent.deleteMany({ where: { tenantId: T } });
    await prisma.group.deleteMany({ where: { tenantId: T } });
    await prisma.course.deleteMany({ where: { tenantId: T } });
    await prisma.student.deleteMany({ where: { tenantId: T } });
    await prisma.teacher.deleteMany({ where: { tenantId: T } });
    await prisma.user.deleteMany({ where: { tenantId: T } });
    await prisma.room.deleteMany({ where: { tenantId: T } });
    await prisma.holiday.deleteMany({ where: { tenantId: T } });
    await prisma.branch.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
    await prisma.$disconnect();
  });

  const types = (conflicts: { type: string }[]) => conflicts.map((c) => c.type);

  it('accepts a clean slot', async () => {
    const conflicts = await run(() =>
      service.validate({ groupId, teacherId, roomId, startAt: at(12), endAt: at(13) }),
    );
    expect(conflicts).toEqual([]);
  });

  it('detects teacher/room/group overlap', async () => {
    const conflicts = await run(() =>
      service.validate({ groupId, teacherId, roomId, startAt: at(10, 30), endAt: at(11, 30) }),
    );
    expect(types(conflicts)).toEqual(
      expect.arrayContaining([
        SCHEDULE_CONFLICTS.TEACHER_BUSY,
        SCHEDULE_CONFLICTS.ROOM_BUSY,
        SCHEDULE_CONFLICTS.GROUP_BUSY,
      ]),
    );
  });

  it('detects room capacity violation', async () => {
    const conflicts = await run(() =>
      service.validate({
        groupId, teacherId, roomId: smallGroupRoomId, startAt: at(14), endAt: at(15),
      }),
    );
    expect(types(conflicts)).toContain(SCHEDULE_CONFLICTS.ROOM_CAPACITY);
  });

  it('detects outside working hours', async () => {
    const conflicts = await run(() =>
      service.validate({ groupId, teacherId, roomId, startAt: at(20), endAt: at(21) }),
    );
    expect(types(conflicts)).toContain(SCHEDULE_CONFLICTS.OUTSIDE_WORKING_HOURS);
  });

  it('detects min-break violation', async () => {
    // existing lesson ends 11:00; default min break 10 min → 11:05 start violates
    const conflicts = await run(() =>
      service.validate({ groupId, teacherId, roomId, startAt: at(11, 5), endAt: at(12, 5) }),
    );
    expect(types(conflicts)).toContain(SCHEDULE_CONFLICTS.MIN_BREAK);
  });

  it('detects max weekly hours violation', async () => {
    // teacher max 4h/week; existing 1h + candidate 3.5h = 4.5h
    const conflicts = await run(() =>
      service.validate({ groupId, teacherId, roomId, startAt: at(12), endAt: at(15, 30) }),
    );
    expect(types(conflicts)).toContain(SCHEDULE_CONFLICTS.MAX_WEEKLY_HOURS);
  });

  it('detects holiday', async () => {
    await run(() =>
      prisma.scoped.holiday.create({
        data: { tenantId: T, date: monday, name: 'Test bayramı' },
      }),
    );
    const conflicts = await run(() =>
      service.validate({ groupId, teacherId, roomId, startAt: at(12), endAt: at(13) }),
    );
    expect(types(conflicts)).toContain(SCHEDULE_CONFLICTS.HOLIDAY);
    await prisma.holiday.deleteMany({ where: { tenantId: T } });
  });

  it('excludeLessonIds allows editing a lesson in place', async () => {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { tenantId: T } });
    const conflicts = await run(() =>
      service.validate({
        groupId, teacherId, roomId,
        startAt: at(10), endAt: at(11),
        excludeLessonIds: [lesson.id],
      }),
    );
    expect(types(conflicts)).not.toContain(SCHEDULE_CONFLICTS.TEACHER_BUSY);
  });
});
