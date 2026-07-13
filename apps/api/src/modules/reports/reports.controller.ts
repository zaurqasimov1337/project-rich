import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ExportService,
  ) {}

  @Get('catalog')
  @RequirePermissions('reports.view')
  catalog() {
    return [
      { key: 'revenue', name: 'Gəlir hesabatı', icon: 'wallet' },
      { key: 'debts', name: 'Borclar', icon: 'alert' },
      { key: 'attendance', name: 'Davamiyyət', icon: 'clipboard' },
      { key: 'group-fill', name: 'Qrup doluluğu', icon: 'users' },
      { key: 'teacher-load', name: 'Müəllim yükü', icon: 'user' },
      { key: 'course-roi', name: 'Kurs gəlirliliyi', icon: 'book' },
      { key: 'lead-funnel', name: 'Müraciət konversiyası', icon: 'filter' },
    ];
  }

  @Get(':key')
  @RequirePermissions('reports.view')
  async run(@Param('key') key: string, @Query() q: ListQueryDto) {
    if (!this.reports.isValidKey(key)) {
      throw new BadRequestException({ code: 'NOT_FOUND', message: 'Unknown report key' });
    }
    return this.reports.run(key, q);
  }

  @Get(':key/export')
  @RequirePermissions('reports.export')
  async export(
    @Param('key') key: string,
    @Query() q: ListQueryDto,
    @Query('format') format: 'xlsx' | 'csv',
    @Res() res: Response,
  ) {
    if (!this.reports.isValidKey(key)) {
      throw new BadRequestException({ code: 'NOT_FOUND', message: 'Unknown report key' });
    }
    const result = await this.reports.run(key, q);
    const filename = `${key}-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      this.exporter.toCsv(res, filename, result.columns, result.rows);
    } else {
      await this.exporter.toXlsx(res, filename, result.columns, result.rows);
    }
  }
}
