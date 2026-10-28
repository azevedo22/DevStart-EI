/**
 * Application Tracker Service — candidaturas, Kanban e entrevistas
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = Number(process.env['TRACKER_SERVICE_PORT'] ?? 3003);
  await app.listen(port);
  Logger.log(
    `Application Tracker Service a correr em http://localhost:${port}/api`,
  );
}

bootstrap();
