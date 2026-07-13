import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list(@Query() q: ListQueryDto) {
    return this.users.list(q);
  }

  @Post('invite')
  @RequirePermissions('users.manage')
  invite(@Body() dto: InviteUserDto, @CurrentUser() user: AuthUser) {
    return this.users.invite(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users.manage')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user.userId);
  }
}
