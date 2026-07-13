import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getContext } from '../context/request-context';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit write; never fails the request. */
  log(entry: {
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  }): void {
    const ctx = getContext();
    if (!ctx?.tenantId) return;
    this.prisma.auditLog
      .create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: (entry.before as object) ?? undefined,
          after: (entry.after as object) ?? undefined,
          ip: ctx.ip,
        },
      })
      .catch(() => undefined);
  }
}
