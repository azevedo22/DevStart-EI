import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/auth-service/.env', '.env'],
      validate: validateEnv,
    }),
    // Limite geral por IP; os endpoints de credenciais têm um limite próprio mais apertado.
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 100, ttl: 60_000 }],
      // Desligável só nos testes: em qualquer outro ambiente a variável é ignorada.
      skipIf: () =>
        process.env['NODE_ENV'] === 'test' &&
        process.env['THROTTLE_DISABLED'] === 'true',
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
