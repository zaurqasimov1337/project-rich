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
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ENROLLMENT_STATUSES, GROUP_STATUSES } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class GroupDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  assistantId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

class UpdateGroupDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  assistantId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(GROUP_STATUSES as unknown as string[])
  status?: string;
}

class EnrollDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number;
}

class EnrollmentStatusDto {
  @IsIn(ENROLLMENT_STATUSES as unknown as string[])
  status!: string;
}

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('groups.read')
  async list(
    @Query() q: ListQueryDto,
    @Query('courseId') courseId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    const where = {
      deletedAt: null,
      ...(courseId ? { courseId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(q.branchId?.length ? { branchId: { in: q.branchId } } : {}),
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.group.findMany({
        where,
        include: {
          course: { select: { id: true, name: true, price: true, pricingModel: true } },
          _count: { select: { students: { where: { status: 'active' } } } },
        },
        orderBy: q.orderBy('createdAt', ['createdAt', 'name', 'startDate']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.group.count({ where }),
    ]);
    return paginated(
      data.map((g) => ({
        ...g,
        activeStudents: g._count.students,
        fillRate: g.capacity > 0 ? Math.round((g._count.students / g.capacity) * 100) : 0,
        _count: undefined,
      })),
      total,
      q,
    );
  }

  @Get(':id')
  @RequirePermissions('groups.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const group = await this.prisma.scoped.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        course: true,
        scheduleRules: true,
        students: {
          include: {
            student: {
              select: { id: true, code: true, firstName: true, lastName: true, phone: true, status: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Group not found' });
    return group;
  }

  @Post()
  @RequirePermissions('groups.manage')
  async create(@Body() dto: GroupDto) {
    const course = await this.prisma.scoped.course.findFirst({
      where: { id: dto.courseId, deletedAt: null },
    });
    if (!course) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found' });
    return this.prisma.scoped.group.create({
      data: {
        tenantId: requireTenantId(),
        courseId: dto.courseId,
        branchId: dto.branchId,
        name: dto.name,
        teacherId: dto.teacherId,
        assistantId: dto.assistantId,
        roomId: dto.roomId,
        capacity: dto.capacity ?? course.defaultCapacity,
        priceOverride: dto.priceOverride,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  @Patch(':id')
  @RequirePermissions('groups.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    const group = await this.prisma.scoped.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Group not found' });
    return this.prisma.scoped.group.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        teacherId: dto.teacherId ?? undefined,
        assistantId: dto.assistantId ?? undefined,
        roomId: dto.roomId ?? undefined,
        branchId: dto.branchId ?? undefined,
        capacity: dto.capacity ?? undefined,
        priceOverride: dto.priceOverride ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  @Post(':id/students')
  @RequirePermissions('groups.enroll')
  async enroll(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EnrollDto) {
    const group = await this.prisma.scoped.group.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { students: { where: { status: 'active' } } } } },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Group not found' });
    if (group._count.students >= group.capacity) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Group is full' });
    }
    const student = await this.prisma.scoped.student.findFirst({
      where: { id: dto.studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found' });

    const existing = await this.prisma.scoped.groupStudent.findFirst({
      where: { groupId: id, studentId: dto.studentId },
    });
    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException({ code: 'CONFLICT', message: 'Already enrolled' });
      }
      return this.prisma.scoped.groupStudent.update({
        where: { id: existing.id },
        data: { status: 'active', leftAt: null, priceOverride: dto.priceOverride },
      });
    }
    return this.prisma.scoped.groupStudent.create({
      data: {
        tenantId: requireTenantId(),
        groupId: id,
        studentId: dto.studentId,
        priceOverride: dto.priceOverride,
      },
    });
  }

  @Patch(':id/students/:enrollmentId')
  @RequirePermissions('groups.enroll')
  async setEnrollmentStatus(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: EnrollmentStatusDto,
  ) {
    const enrollment = await this.prisma.scoped.groupStudent.findFirst({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Enrollment not found' });
    }
    return this.prisma.scoped.groupStudent.update({
      where: { id: enrollmentId },
      data: {
        status: dto.status,
        leftAt: ['dropped', 'finished'].includes(dto.status) ? new Date() : null,
      },
    });
  }

  @Delete(':id')
  @RequirePermissions('groups.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.group.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), status: 'archived' },
    });
    return { ok: true };
  }
}
