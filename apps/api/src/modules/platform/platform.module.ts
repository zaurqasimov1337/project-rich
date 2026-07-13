import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformController } from './platform.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PlatformAuthController, PlatformController],
})
export class PlatformModule {}
