import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class ExamDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(['exam', 'quiz', 'midterm', 'final'])
  type?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;
}

class ResultItemDto {
  @IsUUID()
  studentId!: string;

  @IsInt()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  comment?: string;
}

class PutResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultItemDto)
  items!: ResultItemDto[];
}

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('exams.read')
  list(@Query('groupId') groupId?: string) {
    return this.prisma.scoped.exam.findMany({
      where: groupId ? { groupId } : {},
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  @Get(':id')
  @RequirePermissions('exams.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const exam = await this.prisma.scoped.exam.findFirst({
      where: { id },
      include: {
        group: {
          include: {
            students: {
              where: { status: 'active' },
              include: {
                student: { select: { id: true, code: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        results: true,
      },
    });
    if (!exam) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Exam not found' });
    const resultMap = new Map(exam.results.map((r) => [r.studentId, r]));
    return {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      date: exam.date,
      maxScore: exam.maxScore,
      weight: exam.weight,
      group: { id: exam.group.id, name: exam.group.name },
      rows: exam.group.students.map((e) => ({
        student: e.student,
        result: resultMap.get(e.student.id) ?? null,
      })),
    };
  }

  @Post()
  @RequirePermissions('exams.manage')
  create(@Body() dto: ExamDto) {
    return this.prisma.scoped.exam.create({
      data: {
        tenantId: requireTenantId(),
        groupId: dto.groupId,
        name: dto.name,
        type: dto.type ?? 'exam',
        date: new Date(dto.date),
        maxScore: dto.maxScore ?? 100,
        weight: dto.weight ?? 100,
      },
    });
  }

  @Put(':id/results')
  @RequirePermissions('exams.manage')
  async putResults(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PutResultsDto) {
    const exam = await this.prisma.scoped.exam.findFirst({ where: { id } });
    if (!exam) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Exam not found' });
    const tenantId = requireTenantId();
    for (const item of dto.items) {
      await this.prisma.examResult.upsert({
        where: { examId_studentId: { examId: id, studentId: item.studentId } },
        update: { score: Math.min(item.score, exam.maxScore), comment: item.comment },
        create: {
          tenantId,
          examId: id,
          studentId: item.studentId,
          score: Math.min(item.score, exam.maxScore),
          comment: item.comment,
        },
      });
    }
    return { ok: true };
  }

  @Delete(':id')
  @RequirePermissions('exams.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.exam.deleteMany({ where: { id } });
    return { ok: true };
  }
}
