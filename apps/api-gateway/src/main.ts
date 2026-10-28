/**
 * API Gateway — ponto de entrada único do frontend.
 * 1. Valida o JWT (rotas protegidas) e passa a identidade aos serviços.
 * 2. Encaminha /api/v1/<recurso> para o microsserviço dono do recurso.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app/app.module';
import { createAuthMiddleware } from './app/auth.middleware';
import { DEV_JWT_SECRET, GatewayEnv } from './app/env';
import { buildRoutes, rewritePath } from './app/routes.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<GatewayEnv, true>>(ConfigService);
  const logger = new Logger('Gateway');

  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });

  const jwtSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
  if (jwtSecret === DEV_JWT_SECRET) {
    logger.warn(
      'A usar o segredo JWT de desenvolvimento. Define JWT_ACCESS_SECRET fora do ambiente local.',
    );
  }
  // A autenticação corre antes do proxy: um pedido recusado nunca chega aos serviços.
  app.use(
    createAuthMiddleware({
      jwtSecret,
      issuer: config.get('JWT_ISSUER', { infer: true }),
    }),
  );

  for (const route of buildRoutes()) {
    app.use(
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        xfwd: true, // X-Forwarded-For: os serviços veem o IP real (rate limiting)
        pathRewrite: (path) => rewritePath(path),
        pathFilter: route.prefixes.map((p) => `/api/v1/${p}`),
      }),
    );
    logger.log(`/api/v1/{${route.prefixes.join(',')}} → ${route.target}`);
  }

  app.setGlobalPrefix('api');
  const port = config.get('GATEWAY_PORT', { infer: true });
  await app.listen(port);
  logger.log(`API Gateway a correr em http://localhost:${port}/api`);
}

bootstrap();
