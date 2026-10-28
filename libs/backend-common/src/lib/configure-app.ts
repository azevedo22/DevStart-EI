import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuração comum dos serviços internos, partilhada entre o main.ts
 * e os testes e2e, para os testes correrem exatamente a mesma aplicação.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão no DTO
      forbidNonWhitelisted: true, // e recusa o pedido se vierem campos a mais
      transform: true,
      stopAtFirstError: true, // uma mensagem por campo
    }),
  );
}
