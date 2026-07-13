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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ATTENDANCE_STATUSES, LESSON_TYPES } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { NotificationsService } from '../notifications/notifications.service';
import { ScheduleService } from './schedule.service';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

class ValidateDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  teacherId!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  excludeLessonIds?: string[];
}

class CreateRuleDto {
  @IsUUID()
  groupId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];

  @Matches(TIME_RE)
  startTime!: string;

  @Matches(TIME_RE)
  endTime!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsIn(LESSON_TYPES as unknown as string[])
  type?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

class CreateLessonDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  teacherId!: string;

  @IsOptional()
  @IsUUID()
  assistantId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsIn(LESSON_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;
}

class UpdateLessonDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;
}

class CancelLessonDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

class AttendanceItemDto {
  @IsUUID()
  studentId!: string;

  @IsIn(ATTENDANCE_STATUSES as unknown as string[])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

class MarkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  items!: AttendanceItemDto[];
}

class JournalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  homework?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

@ApiTags('schedule')
@ApiBearerAuth()
@Controller()
export class ScheduleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: ScheduleService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- calendar feed ----------

  @Get('schedule')
  @RequirePermissions('schedule.read')
  async feed(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('roomId') roomId?: string,
    @Query('groupId') groupId?: string,
  ) {
    const gte = from ? new Date(from) : new Date();
    const lt = to ? new Date(to) : new Date(gte.getTime() + 7 * 24 * 3600 * 1000);
    return this.prisma.scoped.lesson.findMany({
      where: {
        startAt: { gte, lt },
        ...(teacherId ? { teacherId } : {}),
        ...(roomId ? { roomId } : {}),
        ...(groupId ? { groupId } : {}),
        ...(branchId ? { group: { branchId } } : {}),
      },
      include: {
        group: { select: { id: true, name: true, branchId: true, course: { select: { name: true } } } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  @Post('schedule/validate')
  @RequirePermissions('schedule.read')
  async validate(@Body() dto: ValidateDto) {
    const conflicts = await this.schedule.validate({
      groupId: dto.groupId,
      teacherId: dto.teacherId,
      roomId: dto.roomId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      excludeLessonIds: dto.excludeLessonIds,
    });
    return { valid: conflicts.length === 0, conflicts };
  }

  // ---------- rules ----------

  @Get('schedule-rules')
  @RequirePermissions('schedule.read')
  rules(@Query('groupId') groupId?: string) {
    return this.prisma.scoped.scheduleRule.findMany({
      where: groupId ? { groupId } : {},
      include: { group: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('schedule-rules')
  @RequirePermissions('schedule.manage')
  async createRule(@Body() dto: CreateRuleDto) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'endTime must be after startTime',
      });
    }
    const rule = await this.prisma.scoped.scheduleRule.create({
      data: {
        tenantId: requireTenantId(),
        groupId: dto.groupId,
        weekdays: dto.weekdays,
        startTime: dto.startTime,
        endTime: dto.endTime,
        roomId: dto.roomId,
        teacherId: dto.teacherId,
        type: (dto.type as never) ?? 'offline',
        validFrom: new Date(dto.validFrom),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
    const report = await this.schedule.materializeRule(rule.id);
    return { rule, ...report };
  }

  @Delete('schedule-rules/:id')
  @RequirePermissions('schedule.manage')
  async deleteRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('deleteFuture') deleteFuture?: string,
  ) {
    if (deleteFuture === 'true') {
      await this.prisma.scoped.lesson.deleteMany({
        where: { ruleId: id, status: 'scheduled', startAt: { gte: new Date() } },
      });
    }
    await this.prisma.scoped.scheduleRule.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ---------- lessons ----------

  @Post('lessons')
  @RequirePermissions('schedule.manage')
  async createLesson(@Body() dto: CreateLessonDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const conflicts = await this.schedule.validate({
      groupId: dto.groupId,
      teacherId: dto.teacherId,
      roomId: dto.roomId,
      startAt,
      endAt,
    });
    if (conflicts.length > 0) {
      throw new BadRequestException({
        code: 'SCHEDULE_CONFLICT',
        message: 'Schedule conflicts detected',
        details: conflicts,
      });
    }
    return this.prisma.scoped.lesson.create({
      data: {
        tenantId: requireTenantId(),
        groupId: dto.groupId,
        teacherId: dto.teacherId,
        assistantId: dto.assistantId,
        roomId: dto.roomId,
        date: new Date(startAt.toISOString().slice(0, 10)),
        startAt,
        endAt,
        type: (dto.type as never) ?? 'offline',
        maxParticipants: dto.maxParticipants,
        topic: dto.topic,
      },
    });
  }

  @Patch('lessons/:id')
  @RequirePermissions('schedule.manage')
  async updateLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
    @Query('scope') scope: 'one' | 'following' = 'one',
  ) {
    const lesson = await this.prisma.scoped.lesson.findFirst({ where: { id } });
    if (!lesson) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lesson not found' });

    const targets =
      scope === 'following' && lesson.ruleId
        ? await this.prisma.scoped.lesson.findMany({
            where: {
              ruleId: lesson.ruleId,
              status: 'scheduled',
              startAt: { gte: lesson.startAt },
            },
            orderBy: { startAt: 'asc' },
          })
        : [lesson];

    // Time shift computed from the edited lesson, applied to each target.
    const deltaStart = dto.startAt ? new Date(dto.startAt).getTime() - lesson.startAt.getTime() : 0;
    const deltaEnd = dto.endAt ? new Date(dto.endAt).getTime() - lesson.endAt.getTime() : 0;

    const results = [];
    for (const t of targets) {
      const newStart = new Date(t.startAt.getTime() + deltaStart);
      const newEnd = new Date(t.endAt.getTime() + deltaEnd);
      const conflicts = await this.schedule.validate({
        groupId: t.groupId,
        teacherId: dto.teacherId ?? t.teacherId,
        roomId: dto.roomId ?? t.roomId,
        startAt: newStart,
        endAt: newEnd,
        excludeLessonIds: [t.id],
      });
      if (conflicts.length > 0) {
        if (scope === 'one') {
          throw new BadRequestException({
            code: 'SCHEDULE_CONFLICT',
            message: 'Schedule conflicts detected',
            details: conflicts,
          });
        }
        results.push({ id: t.id, skipped: true, conflicts: conflicts.map((c) => c.type) });
        continue;
      }
      await this.prisma.scoped.lesson.update({
        where: { id: t.id },
        data: {
          teacherId: dto.teacherId ?? undefined,
          roomId: dto.roomId ?? undefined,
          startAt: newStart,
          endAt: newEnd,
          date: new Date(newStart.toISOString().slice(0, 10)),
          topic: t.id === lesson.id ? (dto.topic ?? undefined) : undefined,
        },
      });
      results.push({ id: t.id, skipped: false });
    }
    return { updated: results.filter((r) => !r.skipped).length, results };
  }

  @Post('lessons/:id/cancel')
  @RequirePermissions('schedule.cancel')
  async cancelLesson(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelLessonDto) {
    const lesson = await this.prisma.scoped.lesson.findFirst({
      where: { id, status: 'scheduled' },
      include: { group: { select: { name: true, teacherId: true } } },
    });
    if (!lesson) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lesson not found' });
    await this.prisma.scoped.lesson.update({
      where: { id },
      data: { status: 'cancelled', cancelReason: dto.reason },
    });
    // Notify the teacher (student notifications go through messaging in Phase 4).
    const teacher = await this.prisma.scoped.teacher.findFirst({
      where: { id: lesson.teacherId },
    });
    if (teacher) {
      await this.notifications.notify(requireTenantId(), [teacher.userId], {
        type: 'lesson.cancelled',
        title: 'Dərs ləğv edildi',
        body: `${lesson.group.name} — ${lesson.startAt.toISOString().slice(0, 16).replace('T', ' ')}: ${dto.reason}`,
        entityType: 'lesson',
        entityId: id,
      });
    }
    return { ok: true };
  }

  // ---------- attendance & journal ----------

  @Get('lessons/:id/attendance')
  @RequirePermissions('attendance.read')
  async getAttendance(@Param('id', ParseUUIDPipe) id: string) {
    const lesson = await this.prisma.scoped.lesson.findFirst({
      where: { id },
      include: {
        group: {
          include: {
            students: {
              where: { status: 'active' },
              include: {
                student: { select: { id: true, code: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        attendance: true,
      },
    });
    if (!lesson) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lesson not found' });
    const marked = new Map(lesson.attendance.map((a) => [a.studentId, a]));
    return {
      lesson: {
        id: lesson.id,
        startAt: lesson.startAt,
        topic: lesson.topic,
        homework: lesson.homework,
        journalNotes: lesson.journalNotes,
        status: lesson.status,
        group: { id: lesson.group.id, name: lesson.group.name },
      },
      roster: lesson.group.students.map((e) => ({
        student: e.student,
        attendance: marked.get(e.student.id) ?? null,
      })),
    };
  }

  @Put('lessons/:id/attendance')
  @RequirePermissions('attendance.mark')
  async markAttendance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkAttendanceDto) {
    const lesson = await this.prisma.scoped.lesson.findFirst({ where: { id } });
    if (!lesson) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lesson not found' });
    const tenantId = requireTenantId();
    for (const item of dto.items) {
      await this.prisma.attendance.upsert({
        where: { lessonId_studentId: { lessonId: id, studentId: item.studentId } },
        update: { status: item.status, note: item.note, markedAt: new Date() },
        create: {
          tenantId,
          lessonId: id,
          studentId: item.studentId,
          status: item.status,
          note: item.note,
        },
      });
    }
    if (lesson.status === 'scheduled' && lesson.endAt < new Date()) {
      await this.prisma.scoped.lesson.update({ where: { id }, data: { status: 'done' } });
    }
    return { ok: true };
  }

  @Put('lessons/:id/journal')
  @RequirePermissions('journal.write')
  async journal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JournalDto) {
    const lesson = await this.prisma.scoped.lesson.findFirst({ where: { id } });
    if (!lesson) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lesson not found' });
    return this.prisma.scoped.lesson.update({
      where: { id },
      data: {
        topic: dto.topic ?? undefined,
        homework: dto.homework ?? undefined,
        journalNotes: dto.notes ?? undefined,
      },
    });
  }
}
