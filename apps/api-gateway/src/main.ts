/**
 * API Gateway — ponto de entrada único do frontend.
 * Encaminha /api/v1/<recurso> para o microsserviço dono do recurso.
 * Próximos passos: validação do JWT aqui, rate limiting e CORS por ambiente.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app/app.module';
import { buildRoutes, rewritePath } from './app/routes.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
  });

  const logger = new Logger('Gateway');
  for (const route of buildRoutes()) {
    const proxy = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      pathRewrite: (path) => rewritePath(path),
      pathFilter: route.prefixes.map((p) => `/api/v1/${p}`),
    });
    app.use(proxy);
    logger.log(`/api/v1/{${route.prefixes.join(',')}} → ${route.target}`);
  }

  app.setGlobalPrefix('api');
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  logger.log(`API Gateway a correr em http://localhost:${port}/api`);
}

bootstrap();
