import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesOpsController } from './sales-ops.controller';
import { SalesOpsService } from './sales-ops.service';

@Module({
  controllers: [CrmController, SalesController, SalesOpsController],
  providers: [CrmService, SalesService, SalesOpsService],
  exports: [SalesService],
})
export class CrmModule {}
