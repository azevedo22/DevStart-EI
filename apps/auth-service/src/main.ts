/**
 * Auth Service — autenticação, utilizadores e JWT
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`Auth Service a correr em http://localhost:${port}/api`);
}

bootstrap();
