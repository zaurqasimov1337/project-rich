import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PRICING_MODELS } from '@edusphere/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, paginated } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class CourseDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn(PRICING_MODELS as unknown as string[])
  pricingModel!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationWeeks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultCapacity?: number;

  @IsOptional()
  @IsArray()
  syllabus?: { title: string; topics?: string[] }[];
}

class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(PRICING_MODELS as unknown as string[])
  pricingModel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationWeeks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultCapacity?: number;

  @IsOptional()
  @IsArray()
  syllabus?: { title: string; topics?: string[] }[];

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;
}

class CategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

@ApiTags('courses')
@ApiBearerAuth()
@Controller()
export class CoursesController {
  constructor(private readonly prisma: PrismaService) {}

  // ----- categories -----

  @Get('course-categories')
  @RequirePermissions('courses.read')
  categories() {
    return this.prisma.scoped.courseCategory.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('course-categories')
  @RequirePermissions('courses.manage')
  createCategory(@Body() dto: CategoryDto) {
    return this.prisma.scoped.courseCategory.create({
      data: { tenantId: requireTenantId(), name: dto.name, parentId: dto.parentId },
    });
  }

  @Delete('course-categories/:id')
  @RequirePermissions('courses.manage')
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.course.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    await this.prisma.scoped.courseCategory.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ----- courses -----

  @Get('courses')
  @RequirePermissions('courses.read')
  async list(@Query() q: ListQueryDto, @Query('categoryId') categoryId?: string) {
    const where = {
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.course.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { groups: { where: { deletedAt: null, status: 'active' } } } },
        },
        orderBy: q.orderBy('createdAt', ['createdAt', 'name', 'price']),
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.course.count({ where }),
    ]);
    return paginated(
      data.map((c) => ({ ...c, activeGroups: c._count.groups, _count: undefined })),
      total,
      q,
    );
  }

  @Get('courses/:id')
  @RequirePermissions('courses.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const course = await this.prisma.scoped.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        groups: {
          where: { deletedAt: null },
          include: { _count: { select: { students: { where: { status: 'active' } } } } },
        },
      },
    });
    if (!course) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found' });
    const activeStudents = course.groups.reduce((sum, g) => sum + g._count.students, 0);
    return { ...course, stats: { activeStudents, groupCount: course.groups.length } };
  }

  @Post('courses')
  @RequirePermissions('courses.manage')
  create(@Body() dto: CourseDto) {
    return this.prisma.scoped.course.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        categoryId: dto.categoryId,
        level: dto.level,
        description: dto.description,
        pricingModel: dto.pricingModel as never,
        price: dto.price,
        durationWeeks: dto.durationWeeks,
        defaultCapacity: dto.defaultCapacity ?? 12,
        syllabus: dto.syllabus ?? [],
      },
    });
  }

  @Patch('courses/:id')
  @RequirePermissions('courses.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    const existing = await this.prisma.scoped.course.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found' });
    return this.prisma.scoped.course.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        categoryId: dto.categoryId ?? undefined,
        level: dto.level ?? undefined,
        description: dto.description ?? undefined,
        pricingModel: (dto.pricingModel as never) ?? undefined,
        price: dto.price ?? undefined,
        durationWeeks: dto.durationWeeks ?? undefined,
        defaultCapacity: dto.defaultCapacity ?? undefined,
        syllabus: dto.syllabus ?? undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  @Delete('courses/:id')
  @RequirePermissions('courses.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const activeGroups = await this.prisma.scoped.group.count({
      where: { courseId: id, deletedAt: null, status: { in: ['planned', 'active'] } },
    });
    if (activeGroups > 0) {
      throw new NotFoundException({ code: 'CONFLICT', message: 'Course has active groups' });
    }
    await this.prisma.scoped.course.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), status: 'archived' },
    });
    return { ok: true };
  }
}
