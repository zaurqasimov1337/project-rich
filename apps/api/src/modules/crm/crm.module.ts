import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  controllers: [CrmController, SalesController],
  providers: [CrmService, SalesService],
  exports: [SalesService],
})
export class CrmModule {}
