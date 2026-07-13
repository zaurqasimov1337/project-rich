import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

/** Creates in-app notifications. Email/SMS delivery hooks in via queues (Phase 4). */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    tenantId: string,
    userIds: string[],
    payload: { type: string; title: string; body?: string; entityType?: string; entityId?: string },
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ tenantId, userId, ...payload })),
    });
  }
}
