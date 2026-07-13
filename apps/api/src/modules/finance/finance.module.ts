import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PayrollController } from './payroll.controller';

@Module({
  controllers: [FinanceController, PayrollController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
