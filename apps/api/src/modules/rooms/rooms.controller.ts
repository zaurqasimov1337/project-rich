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
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

class RoomDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsIn(['active', 'maintenance', 'inactive'])
  status?: string;
}

class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsIn(['active', 'maintenance', 'inactive'])
  status?: string;
}

class ReservationDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('rooms.read')
  async list(@Query('branchId') branchId?: string) {
    return this.prisma.scoped.room.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
    });
  }

  @Get(':id/occupancy')
  @RequirePermissions('rooms.read')
  async occupancy(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date?: string,
  ) {
    const day = date ? new Date(date) : new Date();
    const dayStart = new Date(day.toISOString().slice(0, 10));
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const [lessons, reservations] = await Promise.all([
      this.prisma.scoped.lesson.findMany({
        where: {
          roomId: id,
          status: 'scheduled',
          startAt: { gte: dayStart, lt: dayEnd },
        },
        include: {
          group: { select: { id: true, name: true } },
          teacherRef: { select: { id: true, userId: true } },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.scoped.roomReservation.findMany({
        where: { roomId: id, startAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { startAt: 'asc' },
      }),
    ]);
    return { lessons, reservations };
  }

  @Post()
  @RequirePermissions('rooms.manage')
  async create(@Body() dto: RoomDto) {
    const branch = await this.prisma.scoped.branch.findFirst({
      where: { id: dto.branchId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Branch not found' });
    return this.prisma.scoped.room.create({
      data: {
        tenantId: requireTenantId(),
        branchId: dto.branchId,
        name: dto.name,
        number: dto.number,
        capacity: dto.capacity,
        floor: dto.floor,
        equipment: dto.equipment ?? [],
        status: dto.status ?? 'active',
      },
    });
  }

  @Post(':id/reservations')
  @RequirePermissions('rooms.manage')
  async reserve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReservationDto) {
    return this.prisma.scoped.roomReservation.create({
      data: {
        tenantId: requireTenantId(),
        roomId: id,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
      },
    });
  }

  @Patch(':id')
  @RequirePermissions('rooms.manage')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    const room = await this.prisma.scoped.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Room not found' });
    return this.prisma.scoped.room.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        number: dto.number ?? undefined,
        capacity: dto.capacity ?? undefined,
        floor: dto.floor ?? undefined,
        equipment: dto.equipment ?? undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermissions('rooms.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.room.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), status: 'inactive' },
    });
    return { ok: true };
  }
}
