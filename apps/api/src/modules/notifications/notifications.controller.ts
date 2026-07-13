import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: ListQueryDto, @CurrentUser() user: AuthUser) {
    const where = { userId: user.userId };
    const [data, total, unread] = await Promise.all([
      this.prisma.scoped.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.notification.count({ where }),
      this.prisma.scoped.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total, unread } };
  }

  @Post(':id/read')
  async markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.scoped.notification.updateMany({
      where: { id, userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.prisma.scoped.notification.updateMany({
      where: { userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
