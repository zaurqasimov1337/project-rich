import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AiService } from './ai.service';

class ChatDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @RequirePermissions('ai.use')
  status() {
    return { enabled: this.ai.enabled };
  }

  @Post('chat')
  @RequirePermissions('ai.use')
  chat(@Body() dto: ChatDto, @CurrentUser() user: AuthUser) {
    return this.ai.chat(user.userId, dto.message, dto.conversationId);
  }

  @Get('conversations')
  @RequirePermissions('ai.use')
  conversations(@CurrentUser() user: AuthUser) {
    return this.ai.conversations(user.userId);
  }

  @Get('conversations/:id')
  @RequirePermissions('ai.use')
  conversation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.conversationMessages(user.userId, id);
  }
}
