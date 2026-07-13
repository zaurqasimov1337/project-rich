import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SCHEDULE_CONFLICTS, type ScheduleConflictType } from '@edusphere/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

export interface LessonCandidate {
  groupId: string;
  teacherId: string;
  roomId?: string | null;
  startAt: Date;
  endAt: Date;
  /** lessons to ignore during overlap checks (when editing) */
  excludeLessonIds?: string[];
}

export interface ScheduleConflict {
  type: ScheduleConflictType;
  message: string;
  entity?: { kind: string; id: string; name?: string };
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function minutesOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private async minBreakMin(): Promise<number> {
    const setting = await this.prisma.scoped.setting.findFirst({
      where: { key: 'lessonDefaults' },
    });
    const v = setting?.value as { minBreakMin?: number } | undefined;
    return v?.minBreakMin ?? 10;
  }

  /**
   * Validates a candidate lesson against all 8 conflict rules.
   * Returns [] when the slot is clean.
   */
  async validate(c: LessonCandidate): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];
    if (c.endAt <= c.startAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'endAt must be after startAt',
      });
    }
    const exclude = c.excludeLessonIds?.length ? { id: { notIn: c.excludeLessonIds } } : {};
    const minBreak = await this.minBreakMin();
    const breakMs = minBreak * 60000;
    // Window widened by break so we catch adjacency violations in one query.
    const windowStart = new Date(c.startAt.getTime() - breakMs - 12 * 3600 * 1000);
    const windowEnd = new Date(c.endAt.getTime() + breakMs + 12 * 3600 * 1000);

    const [group, nearby] = await Promise.all([
      this.prisma.scoped.group.findFirst({
        where: { id: c.groupId, deletedAt: null },
        include: { _count: { select: { students: { where: { status: 'active' } } } } },
      }),
      this.prisma.scoped.lesson.findMany({
        where: {
          status: 'scheduled',
          startAt: { gte: windowStart, lt: windowEnd },
          OR: [
            { teacherId: c.teacherId },
            ...(c.roomId ? [{ roomId: c.roomId }] : []),
            { groupId: c.groupId },
          ],
          ...exclude,
        },
        include: { group: { select: { name: true } } },
      }),
    ]);
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Group not found' });

    // 1. Teacher double-booking
    for (const l of nearby) {
      if (l.teacherId === c.teacherId && overlap(c.startAt, c.endAt, l.startAt, l.endAt)) {
        conflicts.push({
          type: SCHEDULE_CONFLICTS.TEACHER_BUSY,
          message: `Müəllim bu vaxtda başqa dərsdədir (${l.group.name})`,
          entity: { kind: 'lesson', id: l.id, name: l.group.name },
        });
        break;
      }
    }

    // 2. Room double-booking (lessons + reservations)
    if (c.roomId) {
      for (const l of nearby) {
        if (l.roomId === c.roomId && overlap(c.startAt, c.endAt, l.startAt, l.endAt)) {
          conflicts.push({
            type: SCHEDULE_CONFLICTS.ROOM_BUSY,
            message: `Otaq bu saatda doludur (${l.group.name})`,
            entity: { kind: 'lesson', id: l.id, name: l.group.name },
          });
          break;
        }
      }
      const reservation = await this.prisma.scoped.roomReservation.findFirst({
        where: { roomId: c.roomId, startAt: { lt: c.endAt }, endAt: { gt: c.startAt } },
      });
      if (reservation) {
        conflicts.push({
          type: SCHEDULE_CONFLICTS.ROOM_BUSY,
          message: `Otaq rezerv olunub: ${reservation.title}`,
          entity: { kind: 'reservation', id: reservation.id, name: reservation.title },
        });
      }
    }

    // 3. Group double-booking
    for (const l of nearby) {
      if (l.groupId === c.groupId && overlap(c.startAt, c.endAt, l.startAt, l.endAt)) {
        conflicts.push({
          type: SCHEDULE_CONFLICTS.GROUP_BUSY,
          message: 'Qrupun bu vaxtda artıq dərsi var',
          entity: { kind: 'lesson', id: l.id },
        });
        break;
      }
    }

    // 4. Room capacity
    if (c.roomId) {
      const room = await this.prisma.scoped.room.findFirst({
        where: { id: c.roomId, deletedAt: null },
      });
      if (room && room.capacity < group._count.students) {
        conflicts.push({
          type: SCHEDULE_CONFLICTS.ROOM_CAPACITY,
          message: `Otağın tutumu (${room.capacity}) qrupun tələbə sayından (${group._count.students}) azdır`,
          entity: { kind: 'room', id: room.id, name: room.name },
        });
      }
    }

    // 5. Teacher working hours
    const teacher = await this.prisma.scoped.teacher.findFirst({
      where: { id: c.teacherId, deletedAt: null },
    });
    if (teacher) {
      const wh = teacher.workingHours as Record<string, { from: string; to: string }>;
      const weekday = WEEKDAY_KEYS[(c.startAt.getUTCDay() + 6) % 7]!;
      const hours = wh?.[weekday];
      if (wh && Object.keys(wh).length > 0) {
        if (!hours) {
          conflicts.push({
            type: SCHEDULE_CONFLICTS.OUTSIDE_WORKING_HOURS,
            message: 'Müəllimin bu gün iş günü deyil',
          });
        } else if (
          minutesOfDay(c.startAt) < parseHM(hours.from) ||
          minutesOfDay(c.endAt) > parseHM(hours.to)
        ) {
          conflicts.push({
            type: SCHEDULE_CONFLICTS.OUTSIDE_WORKING_HOURS,
            message: `Müəllimin iş saatı: ${hours.from}–${hours.to}`,
          });
        }
      }

      // 6. Max weekly hours
      const monday = new Date(c.startAt);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      monday.setUTCHours(0, 0, 0, 0);
      const weekLessons = await this.prisma.scoped.lesson.findMany({
        where: {
          teacherId: c.teacherId,
          status: 'scheduled',
          startAt: { gte: monday, lt: new Date(monday.getTime() + 7 * 24 * 3600 * 1000) },
          ...exclude,
        },
        select: { startAt: true, endAt: true },
      });
      const weekMinutes =
        weekLessons.reduce((s, l) => s + (l.endAt.getTime() - l.startAt.getTime()) / 60000, 0) +
        (c.endAt.getTime() - c.startAt.getTime()) / 60000;
      if (weekMinutes / 60 > teacher.maxWeeklyHours) {
        conflicts.push({
          type: SCHEDULE_CONFLICTS.MAX_WEEKLY_HOURS,
          message: `Müəllimin həftəlik limit aşılır (${Math.round(weekMinutes / 60)}h / ${teacher.maxWeeklyHours}h)`,
        });
      }
    }

    // 7. Min break between lessons (teacher & room adjacency)
    for (const l of nearby) {
      const sameTeacher = l.teacherId === c.teacherId;
      const sameRoom = c.roomId && l.roomId === c.roomId;
      if (!sameTeacher && !sameRoom) continue;
      if (overlap(c.startAt, c.endAt, l.startAt, l.endAt)) continue; // already flagged
      const gapAfter = c.startAt.getTime() - l.endAt.getTime();
      const gapBefore = l.startAt.getTime() - c.endAt.getTime();
      const gap = gapAfter >= 0 ? gapAfter : gapBefore;
      if (gap >= 0 && gap < breakMs) {
        conflicts.push({
          type: SCHEDULE_CONFLICTS.MIN_BREAK,
          message: `Dərslər arasında minimum ${minBreak} dəq fasilə olmalıdır`,
          entity: { kind: 'lesson', id: l.id },
        });
        break;
      }
    }

    // 8. Holidays
    const dayStart = new Date(Date.UTC(
      c.startAt.getUTCFullYear(), c.startAt.getUTCMonth(), c.startAt.getUTCDate(),
    ));
    const holiday = await this.prisma.scoped.holiday.findFirst({
      where: {
        date: dayStart,
        OR: [{ branchId: null }, { branchId: group.branchId }],
      },
    });
    if (holiday) {
      conflicts.push({
        type: SCHEDULE_CONFLICTS.HOLIDAY,
        message: `Bu gün qeyri-iş günüdür: ${holiday.name}`,
        entity: { kind: 'holiday', id: holiday.id, name: holiday.name },
      });
    }

    return conflicts;
  }

  /**
   * Generates lessons for a rule from max(validFrom, today) for 12 weeks
   * (bounded by validUntil). Skips holidays and conflicting slots; returns
   * a report of created and skipped dates.
   */
  async materializeRule(ruleId: string): Promise<{ created: number; skipped: { date: string; reasons: string[] }[] }> {
    const rule = await this.prisma.scoped.scheduleRule.findFirst({
      where: { id: ruleId },
      include: { group: true },
    });
    if (!rule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Rule not found' });
    const teacherId = rule.teacherId ?? rule.group.teacherId;
    if (!teacherId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Group has no teacher' });
    }
    const roomId = rule.roomId ?? rule.group.roomId;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const from = rule.validFrom > today ? new Date(rule.validFrom) : today;
    const horizon = new Date(today.getTime() + 12 * 7 * 24 * 3600 * 1000);
    const until = rule.validUntil && rule.validUntil < horizon ? new Date(rule.validUntil) : horizon;

    const existing = await this.prisma.scoped.lesson.findMany({
      where: { ruleId: rule.id, date: { gte: from, lte: until } },
      select: { date: true },
    });
    const existingDates = new Set(existing.map((l) => l.date.toISOString().slice(0, 10)));

    const [sh, sm] = rule.startTime.split(':').map(Number);
    const [eh, em] = rule.endTime.split(':').map(Number);
    const tenantId = requireTenantId();

    let created = 0;
    const skipped: { date: string; reasons: string[] }[] = [];

    for (let d = new Date(from); d <= until; d.setUTCDate(d.getUTCDate() + 1)) {
      const weekday = (d.getUTCDay() + 6) % 7;
      if (!rule.weekdays.includes(weekday)) continue;
      const dateKey = d.toISOString().slice(0, 10);
      if (existingDates.has(dateKey)) continue;

      const startAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh, sm));
      const endAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), eh, em));

      const conflicts = await this.validate({
        groupId: rule.groupId,
        teacherId,
        roomId,
        startAt,
        endAt,
      });
      if (conflicts.length > 0) {
        skipped.push({ date: dateKey, reasons: conflicts.map((c) => c.type) });
        continue;
      }
      await this.prisma.scoped.lesson.create({
        data: {
          tenantId,
          groupId: rule.groupId,
          ruleId: rule.id,
          teacherId,
          roomId,
          date: new Date(dateKey),
          startAt,
          endAt,
          type: rule.type,
        },
      });
      created++;
    }
    return { created, skipped };
  }
}
