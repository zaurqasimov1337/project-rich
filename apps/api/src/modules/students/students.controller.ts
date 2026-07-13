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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
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
