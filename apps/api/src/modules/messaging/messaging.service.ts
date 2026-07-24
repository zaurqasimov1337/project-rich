import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { requireTenantId } from '../../core/context/request-context';

interface BulkSendInput {
  channel: string;
  studentIds: string[];
  subject?: string;
  body: string;
}

/**
 * Bulk email/SMS to students. Email goes through MailService (SMTP). SMS is
 * logged pending a provider connector (Twilio/local) — a tenant integration.
 * Supports {{firstName}} {{lastName}} {{code}} placeholders per recipient.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private render(template: string, s: { firstName: string; lastName: string; code: string }): string {
    return template
      .replace(/\{\{\s*firstName\s*\}\}/g, s.firstName)
      .replace(/\{\{\s*lastName\s*\}\}/g, s.lastName)
      .replace(/\{\{\s*code\s*\}\}/g, s.code);
  }

  async bulkSend(input: BulkSendInput, userId: string) {
    const tenantId = requireTenantId();
    const students = await this.prisma.scoped.student.findMany({
      where: { id: { in: input.studentIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, code: true, email: true, phone: true },
    });

    // Does the tenant have an active SMS provider?
    const smsProvider =
      input.channel === 'sms'
        ? await this.prisma.scoped.tenantIntegration.findFirst({
            where: { catalogKey: 'twilio', status: 'connected' },
          })
        : null;

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const s of students) {
      const recipient = input.channel === 'email' ? s.email : s.phone;
      if (!recipient) {
        skipped++;
        continue;
      }
      const body = this.render(input.body, s);
      const subject = input.subject ? this.render(input.subject, s) : undefined;

      let status = 'sent';
      let error: string | undefined;

      try {
        if (input.channel === 'email') {
          await this.mail.send(recipient, subject ?? 'Mactab', body);
        } else if (!smsProvider) {
          // No SMS provider connected — record as failed with guidance.
          status = 'failed';
          error = 'SMS provayder qoşulmayıb (İnteqrasiyalar → Twilio)';
        }
        // With a provider, the connector would send here (Phase: connector impl).
      } catch (err) {
        status = 'failed';
        error = (err as Error).message;
      }

      await this.prisma.scoped.messageLog.create({
        data: {
          tenantId,
          channel: input.channel,
          recipient,
          subject,
          body,
          status,
          error,
          entityType: 'student',
          entityId: s.id,
          sentById: userId,
        },
      });
      if (status === 'sent') sent++;
      else failed++;
    }

    return { sent, failed, skipped, total: input.studentIds.length };
  }
}
