import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { REDIS } from '../../core/redis/redis.module';
import { requireTenantId } from '../../core/context/request-context';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @RequirePermissions('dashboard.view')
  async get() {
    const tenantId = requireTenantId();
    const cacheKey = `dashboard:${tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [
      activeStudents,
      activeGroups,
      todayLessons,
      attendanceAgg,
      newStudentsMonth,
      upcoming,
    ] = await Promise.all([
      this.prisma.scoped.student.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.scoped.group.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.scoped.lesson.count({
        where: { startAt: { gte: todayStart, lt: todayEnd }, status: { not: 'cancelled' } },
      }),
      this.prisma.scoped.attendance.groupBy({
        by: ['status'],
        where: { markedAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      this.prisma.scoped.student.count({
        where: { deletedAt: null, createdAt: { gte: monthStart } },
      }),
      this.prisma.scoped.lesson.findMany({
        where: { startAt: { gte: new Date() }, status: 'scheduled' },
        include: { group: { select: { name: true, course: { select: { name: true } } } } },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
    ]);

    const attTotal = attendanceAgg.reduce((s, r) => s + r._count, 0);
    const attPresent =
      attendanceAgg.filter((r) => ['present', 'late'].includes(r.status))
        .reduce((s, r) => s + r._count, 0);

    const result = {
      activeStudents,
      activeGroups,
      todayLessons,
      newStudentsMonth,
      attendanceRate: attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null,
      monthRevenue: 0, // finance module (Phase 4) fills this
      upcomingLessons: upcoming.map((l) => ({
        id: l.id,
        startAt: l.startAt,
        endAt: l.endAt,
        group: l.group.name,
        course: l.group.course.name,
      })),
    };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
    return result;
  }
}
