import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto, paginated, resolveDateRange } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { requireTenantId } from '../../core/context/request-context';
import { MessagingService } from './messaging.service';

class TemplateDto {
  @IsString()
  @MaxLength(60)
  key!: string;

  @IsIn(['email', 'sms'])
  channel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MaxLength(4000)
  body!: string;
}

class BulkSendDto {
  @IsIn(['email', 'sms'])
  channel!: string;

  /** Target student ids (recipients resolved from their contact info). */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  studentIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MaxLength(4000)
  body!: string;
}

@ApiTags('messaging')
@ApiBearerAuth()
@Controller()
export class MessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  // ----- templates -----

  @Get('message-templates')
  @RequirePermissions('messages.templates')
  templates() {
    return this.prisma.scoped.messageTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  @Post('message-templates')
  @RequirePermissions('messages.templates')
  async upsertTemplate(@Body() dto: TemplateDto) {
    const tenantId = requireTenantId();
    return this.prisma.messageTemplate.upsert({
      where: { tenantId_key_channel: { tenantId, key: dto.key, channel: dto.channel } },
      update: { subject: dto.subject, body: dto.body },
      create: { tenantId, key: dto.key, channel: dto.channel, subject: dto.subject, body: dto.body },
    });
  }

  @Delete('message-templates/:id')
  @RequirePermissions('messages.templates')
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.scoped.messageTemplate.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ----- bulk send -----

  @Post('messages/send')
  @RequirePermissions('messages.send')
  async send(@Body() dto: BulkSendDto, @CurrentUser() user: AuthUser) {
    if (dto.channel === 'email' && !dto.subject) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Email requires a subject' });
    }
    return this.messaging.bulkSend(dto, user.userId);
  }

  // ----- logs -----

  @Get('messages/logs')
  @RequirePermissions('messages.send')
  async logs(@Query() q: ListQueryDto, @Query('channel') channel?: string) {
    const range = resolveDateRange(q);
    const where = {
      ...(channel ? { channel } : {}),
      ...(range ? { createdAt: range } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scoped.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.scoped.messageLog.count({ where }),
    ]);
    return paginated(data, total, q);
  }
}
