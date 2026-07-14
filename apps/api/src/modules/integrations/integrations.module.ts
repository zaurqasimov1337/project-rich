import { Global, Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { IntegrationsController } from './integrations.controller';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ApiKeysController } from './api-keys.controller';

@Global()
@Module({
  imports: [CrmModule],
  controllers: [
    IntegrationsController,
    WebhooksController,
    ApiKeysController,
    InstagramWebhookController,
  ],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class IntegrationsModule {}
