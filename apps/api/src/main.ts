import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';

async function createAndStart(): Promise<void> {
  // rawBody: true lets the Instagram webhook verify Meta's HMAC signature over
  // the exact bytes Meta signed (re-serializing parsed JSON would not match).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [process.env.APP_URL_WEB ?? 'http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Mactab API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

/**
 * Neon's serverless Postgres suspends when idle and can take a few seconds to
 * wake on the first connection — Prisma connects as part of Nest's module init
 * (triggered inside app.listen()), so a cold-start P1001 would otherwise crash
 * the whole process. Retry the entire create+listen sequence instead.
 */
async function bootstrap() {
  const retries = 6;
  const delayMs = 3000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await createAndStart();
      return;
    } catch (e) {
      if (attempt === retries) throw e;
      // eslint-disable-next-line no-console
      console.warn(`[bootstrap] DB not ready yet (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

void bootstrap();
