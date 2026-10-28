/**
 * Profile & Skill Service — competências, projetos, stacks alvo e skill gap
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = Number(process.env['PROFILE_SERVICE_PORT'] ?? 3002);
  await app.listen(port);
  Logger.log(
    `Profile & Skill Service a correr em http://localhost:${port}/api`,
  );
}

bootstrap();
