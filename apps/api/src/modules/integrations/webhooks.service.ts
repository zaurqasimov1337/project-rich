import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { WebhookEvent } from '@edusphere/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

/**
 * Fire-and-forget webhook dispatcher. Records a delivery, POSTs with an
 * HMAC-SHA256 signature, and retries up to 3× with backoff on failure.
 * SSRF-guarded: refuses private/loopback hosts.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isPrivateHost(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) return true;
      // block private IPv4 ranges
      const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (m) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))
          return true;
        if (a === 169 && b === 254) return true; // link-local
      }
      return false;
    } catch {
      return true;
    }
  }

  /** Enqueue delivery to all endpoints subscribed to `event`. Non-blocking. */
  async dispatch(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    const tenantId = requireTenantId();
    const endpoints = await this.prisma.scoped.webhookEndpoint.findMany({
      where: { active: true, events: { has: event } },
    });
    for (const ep of endpoints) {
      const delivery = await this.prisma.scoped.webhookDelivery.create({
        data: { tenantId, endpointId: ep.id, event, payload: payload as object },
      });
      void this.deliver(delivery.id, ep.url, ep.secret, event, payload);
    }
  }

  private async deliver(
    deliveryId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.isPrivateHost(url)) {
      await this.prisma.scoped.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'failed', lastError: 'Private/loopback host blocked (SSRF)' },
      });
      return;
    }
    const body = JSON.stringify({ event, data: payload, ts: Date.now() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          await this.prisma.scoped.webhookDelivery.update({
            where: { id: deliveryId },
            data: { status: 'success', attempts: attempt },
          });
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (attempt === 3) {
          await this.prisma.scoped.webhookDelivery.update({
            where: { id: deliveryId },
            data: { status: 'failed', attempts: attempt, lastError: (err as Error).message },
          });
        } else {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        }
      }
    }
  }
}
