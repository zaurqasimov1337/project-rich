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
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { TEACHER_RATE_TYPES } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class NewTeacherUserDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

class CreateTeacherDto {
  /** Existing tenant user to promote to teacher. Provide this OR `newUser`. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Create a brand-new user and make them a teacher in one step. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NewTeacherUserDto)
  newUser?: NewTeacherUserDto;

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

  /** Optional convenience: sets a revenue-share rate (percent) for the teacher. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  revenuePct?: number;
}

class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

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

  /** Revenue-share percent. Creates or updates the teacher's revenue_pct rate. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  revenuePct?: number;

  /** Org-structure department (departments table). */
  @IsOptional()
  @IsUUID()
  departmentId?: string;
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
          rates: true,
          groups: {
            where: { deletedAt: null, status: 'active' },
            select: {
              id: true,
              name: true,
              priceOverride: true,
              course: { select: { price: true } },
              _count: { select: { students: { where: { status: 'active' } } } },
            },
          },
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
    let rows = teachers.map((t) => {
      const revPctRate = t.rates.find((r) => r.type === 'revenue_pct');
      const revenuePct = revPctRate ? revPctRate.amount / 100 : 0; // percent value
      const monthlyEarnings = t.groups.reduce((sum, g) => {
        const price = g.priceOverride ?? g.course?.price ?? 0;
        return sum + Math.round(g._count.students * price * (revenuePct / 100));
      }, 0);
      return {
        id: t.id,
        userId: t.userId,
        user: userMap.get(t.userId) ?? null,
        subjects: t.subjects,
        maxWeeklyHours: t.maxWeeklyHours,
        hiredAt: t.hiredAt,
        activeGroups: t.groups.map((g) => ({ id: g.id, name: g.name })),
        rates: t.rates,
        revenuePct,
        monthlyEarnings,
      };
    });
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
    const tenantId = requireTenantId();

    if (!dto.userId && !dto.newUser) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'İstifadəçi seçin və ya yeni müəllim məlumatlarını daxil edin',
      });
    }

    // Resolve the target user id — either an existing user or a freshly created one.
    let userId: string;
    if (dto.newUser) {
      const email = dto.newUser.email.toLowerCase().trim();
      const emailTaken = await this.prisma.user.findFirst({ where: { tenantId, email } });
      if (emailTaken) {
        throw new BadRequestException({ code: 'CONFLICT', message: 'Bu e-poçt artıq qeydiyyatdadır' });
      }
      // Teachers created here can log in after a password reset; we set a random
      // hash so the account exists without a usable password until then.
      const tempPassword = randomBytes(24).toString('hex');
      const teacherRole = await this.prisma.scoped.role.findFirst({ where: { key: 'teacher' } });
      const created = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          passwordHash: await argon2.hash(tempPassword),
          firstName: dto.newUser.firstName.trim(),
          lastName: dto.newUser.lastName.trim(),
          phone: dto.newUser.phone?.trim() || null,
          status: 'active',
          ...(teacherRole ? { roles: { create: { roleId: teacherRole.id } } } : {}),
        },
      });
      userId = created.id;
    } else {
      const user = await this.prisma.scoped.user.findFirst({
        where: { id: dto.userId, deletedAt: null },
      });
      if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
      const existing = await this.prisma.scoped.teacher.findFirst({ where: { userId: dto.userId } });
      if (existing) {
        throw new BadRequestException({ code: 'CONFLICT', message: 'User is already a teacher' });
      }
      userId = dto.userId!;
    }

    const teacher = await this.prisma.scoped.teacher.create({
      data: {
        tenantId,
        userId,
        subjects: dto.subjects ?? [],
        bio: dto.bio,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        workingHours: dto.workingHours ?? {},
        maxWeeklyHours: dto.maxWeeklyHours ?? 40,
      },
    });

    if (dto.revenuePct != null) {
      await this.prisma.scoped.teacherRate.create({
        data: {
          tenantId,
          teacherId: teacher.id,
          type: 'revenue_pct',
          amount: Math.round(dto.revenuePct * 100), // percent*100, per schema
        },
      });
    }

    return teacher;
  }

  @Patch(':id')
  @RequirePermissions('teachers.update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto) {
    const tenantId = requireTenantId();
    const teacher = await this.prisma.scoped.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!teacher) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Teacher not found' });

    // Contact fields live on the linked user account.
    if (
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.email !== undefined ||
      dto.phone !== undefined
    ) {
      let emailUpdate: string | undefined;
      if (dto.email !== undefined) {
        emailUpdate = dto.email.toLowerCase().trim();
        const clash = await this.prisma.user.findFirst({
          where: { tenantId, email: emailUpdate, id: { not: teacher.userId } },
        });
        if (clash) {
          throw new BadRequestException({ code: 'CONFLICT', message: 'Bu e-poçt artıq qeydiyyatdadır' });
        }
      }
      await this.prisma.scoped.user.update({
        where: { id: teacher.userId },
        data: {
          firstName: dto.firstName?.trim() ?? undefined,
          lastName: dto.lastName?.trim() ?? undefined,
          email: emailUpdate,
          phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        },
      });
    }

    // Revenue-share rate: update the existing revenue_pct rate or create one.
    if (dto.revenuePct !== undefined) {
      const amount = Math.round(dto.revenuePct * 100); // percent*100, per schema
      const existingRate = await this.prisma.scoped.teacherRate.findFirst({
        where: { teacherId: id, type: 'revenue_pct' },
      });
      if (existingRate) {
        await this.prisma.scoped.teacherRate.update({
          where: { id: existingRate.id },
          data: { amount },
        });
      } else {
        await this.prisma.scoped.teacherRate.create({
          data: { tenantId, teacherId: id, type: 'revenue_pct', amount },
        });
      }
    }

    if (dto.departmentId) {
      const dep = await this.prisma.scoped.department.findFirst({ where: { id: dto.departmentId } });
      if (!dep) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Department not found' });
    }

    return this.prisma.scoped.teacher.update({
      where: { id },
      data: {
        subjects: dto.subjects ?? undefined,
        bio: dto.bio ?? undefined,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        workingHours: dto.workingHours ?? undefined,
        maxWeeklyHours: dto.maxWeeklyHours ?? undefined,
        departmentId: dto.departmentId ?? undefined,
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
