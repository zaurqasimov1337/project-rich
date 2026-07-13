import {
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
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TASK_PRIORITIES, TASK_STATUSES } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class CreateTaskDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES as unknown as string[])
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;
}

class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES as unknown as string[])
  priority?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;
}

class TaskListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  mine?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('tasks.read')
  async list(@Query() q: TaskListQueryDto, @CurrentUser() user: AuthUser) {
    const where = {
      ...(q.mine === 'true' ? { assigneeId: user.userId } : q.assigneeId ? { assigneeId: q.assigneeId } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.task.findMany({
        where,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.task.count({ where }),
    ]);
    const leadIds = [...new Set(data.map((t) => t.leadId).filter(Boolean) as string[])];
    const leads = leadIds.length
      ? await this.prisma.scoped.lead.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, fullName: true, name: true },
        })
      : [];
    const leadMap = new Map(leads.map((l) => [l.id, l.fullName ?? l.name]));
    const enriched = data.map((t) => ({ ...t, leadName: t.leadId ? (leadMap.get(t.leadId) ?? null) : null }));
    return paginated(enriched, total, q);
  }

  @Post()
  @RequirePermissions('tasks.manage')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.prisma.scoped.task.create({
      data: {
        tenantId: requireTenantId(),
        title: dto.title,
        body: dto.body,
        leadId: dto.leadId,
        assigneeId: dto.assigneeId ?? user.userId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority ?? 'medium',
        entityType: dto.entityType ?? (dto.leadId ? 'lead' : undefined),
        entityId: dto.entityId ?? dto.leadId,
        createdBy: user.userId,
      },
    });
  }

  @Patch(':id')
  @RequirePermissions('tasks.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    const task = await this.prisma.scoped.task.findFirst({ where: { id } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
    const completedAt =
      dto.status === 'done' ? new Date() : dto.status && dto.status !== 'done' ? null : undefined;
    return this.prisma.scoped.task.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        body: dto.body ?? undefined,
        leadId: dto.leadId ?? undefined,
        assigneeId: dto.assigneeId ?? undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority ?? undefined,
        status: dto.status ?? undefined,
        completedAt,
      },
    });
  }

  @Delete(':id')
  @RequirePermissions('tasks.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.task.deleteMany({ where: { id } });
    return { ok: true };
  }
}
