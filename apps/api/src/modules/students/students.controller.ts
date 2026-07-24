import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { sendBrandedExport, type BrandedFormat } from '../../common/export/branded-export';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/students.dto';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions('students.read')
  list(
    @Query() q: ListQueryDto,
    @Query('groupId') groupId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.students.list(q, { groupId, courseId });
  }

  // NOTE: literal export routes must stay above the ':id' route.
  @Get('export.csv')
  @RequirePermissions('students.read')
  exportCsv(@Res() res: Response) {
    return this.export('csv', res);
  }

  @Get('export.xlsx')
  @RequirePermissions('students.read')
  exportXlsx(@Res() res: Response) {
    return this.export('xlsx', res);
  }

  @Get('export.pdf')
  @RequirePermissions('students.read')
  exportPdf(@Res() res: Response) {
    return this.export('pdf', res);
  }

  private async export(format: BrandedFormat, res: Response) {
    const { columns, rows } = await this.students.exportData();
    const filename = `students-${new Date().toISOString().slice(0, 10)}`;
    await sendBrandedExport(res, format, { filename, reportName: 'Tələbələr', columns, rows });
  }

  @Get(':id')
  @RequirePermissions('students.read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.detail(id);
  }

  @Get(':id/attendance')
  @RequirePermissions('students.read')
  attendance(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.attendanceSummary(id);
  }

  @Get(':id/grades')
  @RequirePermissions('students.read')
  grades(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.grades(id);
  }

  @Post()
  @RequirePermissions('students.create')
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('students.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('students.delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.remove(id);
  }
}
