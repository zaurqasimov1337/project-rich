import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TEACHER_RATE_TYPES } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class CreateTeacherDto {
  /** Existing tenant user to promote to teacher. */
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, { from: string; to: string }>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  maxWeeklyHours?: number;
}

class UpdateTeacherDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, { from: string; to: string }>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  maxWeeklyHours?: number;
}

class RateDto {
  @IsIn(TEACHER_RATE_TYPES as unknown as string[])
  type!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('teachers.read')
  async list(@Query() q: ListQueryDto) {
    const where = { deletedAt: null };
    const [teachers, total] = await Promise.all([
      this.prisma.scoped.teacher.findMany({
        where,
        include: {
          groups: { where: { deletedAt: null, status: 'active' }, select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.teacher.count({ where }),
    ]);
    // join user names
    const users = await this.prisma.scoped.user.findMany({
      where: { id: { in: teachers.map((t) => t.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    let rows = teachers.map((t) => ({
      id: t.id,
      userId: t.userId,
      user: userMap.get(t.userId) ?? null,
      subjects: t.subjects,
      maxWeeklyHours: t.maxWeeklyHours,
      hiredAt: t.hiredAt,
      activeGroups: t.groups,
    }));
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.user &&
          (`${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(s) ||
            r.user.email.toLowerCase().includes(s) ||
            r.subjects.some((sub) => sub.toLowerCase().includes(s))),
      );
    }
    return paginated(rows, total, q);
  }

  @Get(':id')
  @RequirePermissions('teachers.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const teacher = await this.prisma.scoped.teacher.findFirst({
      where: { id, deletedAt: null },
      include: {
        rates: true,
        groups: {
          where: { deletedAt: null },
          include: {
            course: { select: { name: true } },
            _count: { select: { students: { where: { status: 'active' } } } },
          },
        },
      },
    });
    if (!teacher) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Teacher not found' });
    const user = await this.prisma.scoped.user.findFirst({
      where: { id: teacher.userId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
    return { ...teacher, user };
  }

  @Get(':id/load')
  @RequirePermissions('teachers.read')
  async load(@Param('id', ParseUUIDPipe) id: string, @Query('weekOf') weekOf?: string) {
    const base = weekOf ? new Date(weekOf) : new Date();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday.getTime() + 7 * 24 * 3600 * 1000);

    const lessons = await this.prisma.scoped.lesson.findMany({
      where: { teacherId: id, startAt: { gte: monday, lt: sunday }, status: { not: 'cancelled' } },
      select: { startAt: true, endAt: true, groupId: true },
    });
    const minutes = lessons.reduce(
      (sum, l) => sum + (l.endAt.getTime() - l.startAt.getTime()) / 60000,
      0,
    );
    return { weekOf: monday, lessons: lessons.length, hours: Math.round((minutes / 60) * 10) / 10 };
  }

  @Post()
  @RequirePermissions('teachers.create')
  async create(@Body() dto: CreateTeacherDto) {
    const user = await this.prisma.scoped.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    const existing = await this.prisma.scoped.teacher.findFirst({ where: { userId: dto.userId } });
    if (existing) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'User is already a teacher' });
    }
    return this.prisma.scoped.teacher.create({
      data: {
        tenantId: requireTenantId(),
        userId: dto.userId,
        subjects: dto.subjects ?? [],
        bio: dto.bio,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        workingHours: dto.workingHours ?? {},
        maxWeeklyHours: dto.maxWeeklyHours ?? 40,
      },
    });
  }

  @Patch(':id')
  @RequirePermissions('teachers.update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto) {
    const teacher = await this.prisma.scoped.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!teacher) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Teacher not found' });
    return this.prisma.scoped.teacher.update({
      where: { id },
      data: {
        subjects: dto.subjects ?? undefined,
        bio: dto.bio ?? undefined,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        workingHours: dto.workingHours ?? undefined,
        maxWeeklyHours: dto.maxWeeklyHours ?? undefined,
      },
    });
  }

  @Post(':id/rates')
  @RequirePermissions('teachers.rates')
  async addRate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RateDto) {
    return this.prisma.scoped.teacherRate.create({
      data: {
        tenantId: requireTenantId(),
        teacherId: id,
        type: dto.type,
        amount: dto.amount,
        courseId: dto.courseId,
      },
    });
  }

  @Delete(':id/rates/:rateId')
  @RequirePermissions('teachers.rates')
  async deleteRate(@Param('rateId', ParseUUIDPipe) rateId: string) {
    await this.prisma.scoped.teacherRate.deleteMany({ where: { id: rateId } });
    return { ok: true };
  }

  @Delete(':id')
  @RequirePermissions('teachers.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const activeGroups = await this.prisma.scoped.group.count({
      where: { teacherId: id, deletedAt: null, status: { in: ['planned', 'active'] } },
    });
    if (activeGroups > 0) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Teacher has active groups' });
    }
    await this.prisma.scoped.teacher.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }
}
