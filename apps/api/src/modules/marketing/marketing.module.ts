import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';

@Module({
  controllers: [MarketingController],
})
export class MarketingModule {}
