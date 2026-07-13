import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, paginated, resolveDateRange } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-log')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  async list(@Query() q: ListQueryDto, @Query('entityType') entityType?: string) {
    const range = resolveDateRange(q);
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(q.search ? { action: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.auditLog.count({ where }),
    ]);
    return paginated(data, total, q);
  }
}
