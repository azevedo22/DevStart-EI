/**
 * Application Tracker Service — candidaturas, Kanban e entrevistas.
 * Só deve ser acessível através do API Gateway (confia no cabeçalho x-user-id).
 */
import { configureApp } from '@devstart/backend-common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Env } from './app/config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const port = app
    .get<ConfigService<Env, true>>(ConfigService)
    .get('TRACKER_SERVICE_PORT', { infer: true });
  await app.listen(port);
  Logger.log(
    `Application Tracker Service a correr em http://localhost:${port}/api`,
  );
}

bootstrap();
