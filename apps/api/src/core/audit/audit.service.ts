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
          // Prefix action when acting under impersonation so tenant-side audit
          // distinguishes real-owner from platform-impersonated actions.
          action: ctx.impersonatedBy ? `impersonated:${entry.action}` : entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: (entry.before as object) ?? undefined,
          after: ctx.impersonatedBy
            ? ({ ...(entry.after as object), _impersonatedBy: ctx.impersonatedBy } as object)
            : ((entry.after as object) ?? undefined),
          ip: ctx.ip,
        },
      })
      .catch(() => undefined);
  }
}
