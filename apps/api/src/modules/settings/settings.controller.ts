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
import { IsDateString, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';

/** Whitelisted setting keys with defaults. */
export const SETTING_DEFAULTS: Record<string, unknown> = {
  lessonDefaults: { durationMin: 60, minBreakMin: 10 },
  gradeScale: { min: 0, max: 100, passing: 60 },
  finance: { invoiceDueDays: 5, overdueReminderDays: [1, 3, 7] },
  branding: { logoFileId: null, primaryColor: null },
  notifications: { emailEnabled: true, smsEnabled: false },
};

class UpdateSettingsDto {
  @IsObject()
  values!: Record<string, unknown>;
}

class CreateHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('settings.read')
  async get() {
    const rows = await this.prisma.scoped.setting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...SETTING_DEFAULTS, ...stored };
  }

  @Patch()
  @RequirePermissions('settings.manage')
  async update(@Body() dto: UpdateSettingsDto) {
    const tenantId = requireTenantId();
    const entries = Object.entries(dto.values).filter(([k]) => k in SETTING_DEFAULTS);
    for (const [key, value] of entries) {
      await this.prisma.setting.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: { value: value as object },
        create: { tenantId, key, value: value as object },
      });
    }
    return { ok: true };
  }

  @Get('holidays')
  @RequirePermissions('settings.read')
  holidays(@Query('year') year?: string) {
    const y = year ? Number(year) : new Date().getFullYear();
    return this.prisma.scoped.holiday.findMany({
      where: { date: { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) } },
      orderBy: { date: 'asc' },
    });
  }

  @Post('holidays')
  @RequirePermissions('settings.manage')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.prisma.scoped.holiday.create({
      data: {
        tenantId: requireTenantId(),
        date: new Date(dto.date),
        name: dto.name,
        branchId: dto.branchId,
      },
    });
  }

  @Delete('holidays/:id')
  @RequirePermissions('settings.manage')
  async deleteHoliday(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.holiday.deleteMany({ where: { id } });
    return { ok: true };
  }
}
