import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateGatewayEnv } from './env';
import { GatewayRedisModule } from './gateway-redis';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api-gateway/.env', '.env'],
      validate: validateGatewayEnv,
    }),
    GatewayRedisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
