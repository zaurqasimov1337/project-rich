import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env';
import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';
import { MailModule } from './core/mail/mail.module';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';
import { BranchesModule } from './modules/branches/branches.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { CoursesModule } from './modules/courses/courses.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { GroupsModule } from './modules/groups/groups.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { ExamsModule } from './modules/exams/exams.module';
import { requestContext } from './core/context/request-context';
import type { NextFunction, Request, Response } from 'express';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
        transport:
          process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        autoLogging: { ignore: (req) => req.url?.includes('/health') ?? false },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    AuditModule,
    AuthModule,
    HealthModule,
    UsersModule,
    RolesModule,
    SettingsModule,
    NotificationsModule,
    FilesModule,
    BranchesModule,
    RoomsModule,
    CoursesModule,
    StudentsModule,
    TeachersModule,
    GroupsModule,
    ScheduleModule,
    ExamsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Seed AsyncLocalStorage context for every request; auth guard enriches it later.
    consumer
      .apply((req: Request, _res: Response, next: NextFunction) => {
        requestContext.run(
          {
            requestId: (req.headers['x-request-id'] as string) ?? randomUUID(),
            realm: 'public',
            ip: req.ip,
          },
          next,
        );
      })
      .forRoutes('*');
  }
}
