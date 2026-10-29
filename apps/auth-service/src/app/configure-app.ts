import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { Env } from './config/env';

/**
 * Configuração partilhada entre o main.ts e os testes e2e,
 * para os testes correrem exatamente a mesma aplicação que vai para produção.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // O serviço só é acessível através de proxies (gateway, e nginx em produção):
  // o IP real do cliente vem em X-Forwarded-For.
  const hops = app
    .get<ConfigService<Env, true>>(ConfigService)
    .get('TRUST_PROXY_HOPS', { infer: true });
  (app as NestExpressApplication).set('trust proxy', hops);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão no DTO
      forbidNonWhitelisted: true, // e recusa o pedido se vierem campos a mais
      transform: true,
      stopAtFirstError: true, // uma mensagem por campo
    }),
  );
}
