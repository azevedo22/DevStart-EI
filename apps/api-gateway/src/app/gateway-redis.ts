import { createRedis } from '@devstart/backend-common';
import { Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { GatewayEnv } from './env';

export const GATEWAY_REDIS = Symbol('GATEWAY_REDIS');

@Injectable()
class GatewayRedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(GATEWAY_REDIS) private readonly redis: Redis | null) {}
  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}

/** Ligação ao Redis do gateway (verificação de revogação). `null` sem REDIS_URL. */
@Module({
  providers: [
    {
      provide: GATEWAY_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>): Redis | null => {
        const url = config.get('REDIS_URL', { infer: true });
        if (!url) return null;
        const redis = createRedis(url, 'api-gateway');
        redis.on('error', () => undefined); // tratado no middleware (fail-open)
        return redis;
      },
    },
    GatewayRedisLifecycle,
  ],
  exports: [GATEWAY_REDIS],
})
export class GatewayRedisModule {}
