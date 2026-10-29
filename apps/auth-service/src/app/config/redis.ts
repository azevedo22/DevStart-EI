import { createRedis } from '@devstart/backend-common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { Env } from './env';

type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** Ligação Redis do auth-service: rate limiting e revogação de utilizadores. */
export const AUTH_REDIS = Symbol('AUTH_REDIS');

/**
 * Contadores do rate limiting no Redis, partilhados por todas as instâncias do
 * serviço (em memória, cada instância teria o seu limite e um atacante teria
 * N vezes mais tentativas).
 *
 * Decisão consciente: se o Redis falhar, deixa passar (fail-open) e regista.
 * A alternativa (recusar tudo) faria uma falha do Redis impedir todos os logins.
 * As passwords continuam protegidas pelo bcrypt; o limite é uma segunda linha.
 */
export class FailOpenRedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger('ThrottlerStorage');
  private readonly inner: ThrottlerStorageRedisService;
  private lastWarning = 0;

  constructor(redis: Redis) {
    this.inner = new ThrottlerStorageRedisService(redis);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    try {
      return await this.inner.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    } catch (err) {
      // Um aviso por minuto chega; não inundar os logs a cada pedido.
      if (Date.now() - this.lastWarning > 60_000) {
        this.lastWarning = Date.now();
        this.logger.warn(
          `Redis indisponível para o rate limiting; a deixar passar (${(err as Error).message}).`,
        );
      }
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}

/** Fecha a ligação quando a aplicação pára (senão o processo não termina). */
@Injectable()
class AuthRedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(AUTH_REDIS) private readonly redis: Redis | null) {}
  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}

/** A ligação ao Redis, gerida pelo Nest. `null` quando REDIS_URL está vazio. */
@Global()
@Module({
  providers: [
    {
      provide: AUTH_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis | null => {
        const url = config.get('REDIS_URL', { infer: true });
        if (!url) return null;
        const redis = createRedis(url, 'auth-service');
        redis.on('error', () => undefined); // tratado por quem usa a ligação
        return redis;
      },
    },
    AuthRedisLifecycle,
  ],
  exports: [AUTH_REDIS],
})
export class AuthRedisModule {}
