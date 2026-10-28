import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/**
 * Configuração partilhada entre o main.ts e os testes e2e,
 * para os testes correrem exatamente a mesma aplicação que vai para produção.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // O serviço só é acessível através do gateway: o IP real vem em X-Forwarded-For.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão no DTO
      forbidNonWhitelisted: true, // e recusa o pedido se vierem campos a mais
      transform: true,
      stopAtFirstError: true, // uma mensagem por campo
    }),
  );
}
