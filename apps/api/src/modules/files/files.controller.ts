import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { FilesService } from './files.service';

class PresignUploadDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(100)
  mime!: string;

  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityId?: string;
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign-upload')
  @RequirePermissions('files.manage')
  presignUpload(@Body() dto: PresignUploadDto, @CurrentUser() user: AuthUser) {
    return this.files.presignUpload({ ...dto, uploadedById: user.userId });
  }

  @Get(':id/download')
  @RequirePermissions('files.read')
  presignDownload(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.files.presignDownload(id, user);
  }
}
