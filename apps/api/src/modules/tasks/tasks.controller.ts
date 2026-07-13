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
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('tasks.read')
  async list(
    @Query() q: ListQueryDto,
    @CurrentUser() user: AuthUser,
    @Query('mine') mine?: string,
  ) {
    const where = {
      ...(mine === 'true' ? { assigneeId: user.userId } : {}),
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
    return paginated(data, total, q);
  }

  @Post()
  @RequirePermissions('tasks.manage')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.prisma.scoped.task.create({
      data: {
        tenantId: requireTenantId(),
        title: dto.title,
        body: dto.body,
        assigneeId: dto.assigneeId ?? user.userId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority ?? 'medium',
        entityType: dto.entityType,
        entityId: dto.entityId,
        createdBy: user.userId,
      },
    });
  }

  @Patch(':id')
  @RequirePermissions('tasks.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    const task = await this.prisma.scoped.task.findFirst({ where: { id } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
    return this.prisma.scoped.task.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        body: dto.body ?? undefined,
        assigneeId: dto.assigneeId ?? undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority ?? undefined,
        status: dto.status ?? undefined,
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
