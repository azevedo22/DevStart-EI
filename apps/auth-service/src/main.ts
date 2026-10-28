/**
 * Auth Service — registo, login e emissão de JWT.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { DEV_JWT_SECRET, Env } from './app/config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (config.get('JWT_ACCESS_SECRET', { infer: true }) === DEV_JWT_SECRET) {
    Logger.warn(
      'A usar o segredo JWT de desenvolvimento. Define JWT_ACCESS_SECRET fora do ambiente local.',
    );
  }

  const port = config.get('AUTH_SERVICE_PORT', { infer: true });
  await app.listen(port);
  Logger.log(`Auth Service a correr em http://localhost:${port}/api`);
}

bootstrap();
