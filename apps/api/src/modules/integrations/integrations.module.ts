import { Global, Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ApiKeysController } from './api-keys.controller';

@Global()
@Module({
  controllers: [IntegrationsController, WebhooksController, ApiKeysController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class IntegrationsModule {}
