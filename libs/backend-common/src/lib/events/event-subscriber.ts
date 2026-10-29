import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { hostname } from 'node:os';
import { EventConsumer } from './event-consumer';
import { EventHandlers } from './events.types';
import { createRedis } from './redis';

/**
 * Base para um serviço NestJS ouvir eventos. A subclasse diz o grupo, o URL do
 * Redis e os handlers; o arranque e a paragem ficam ligados ao ciclo de vida da app.
 *
 *   @Injectable()
 *   class UserEvents extends EventSubscriber { ... }
 */
export abstract class EventSubscriber
  implements OnApplicationBootstrap, OnModuleDestroy
{
  protected abstract readonly group: string;
  /** null desliga o consumidor (ex.: testes que chamam os handlers diretamente). */
  protected abstract redisUrl(): string | null;
  protected abstract handlers(): EventHandlers;

  private consumer: EventConsumer | null = null;
  private readonly logger = new Logger(this.constructor.name);

  onApplicationBootstrap(): void {
    const url = this.redisUrl();
    if (!url) {
      this.logger.warn('Consumidor de eventos desligado (sem REDIS_URL).');
      return;
    }
    const redis = createRedis(url, `${this.group}-consumer`, {
      blocking: true,
    });
    // Sem listener, o ioredis escreve "Unhandled error event" com stack trace a cada
    // tentativa de religação. O ciclo do consumidor já regista a falha (com backoff).
    redis.on('error', () => undefined);
    this.consumer = new EventConsumer({
      redis,
      group: this.group,
      consumer: `${hostname()}-${process.pid}`,
      handlers: this.handlers(),
      logger: this.logger,
    });
    this.consumer.start();
    this.logger.log(`A ouvir eventos como "${this.group}".`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.stop();
  }
}
