import { createEvent, revokedUserKey } from '@devstart/backend-common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { EntityManager, In } from 'typeorm';
import { Env } from '../config/env';
import { AUTH_REDIS } from '../config/redis';
import { OutboxEvent } from '../outbox/outbox-event.entity';
import { OutboxRelay } from '../outbox/outbox-relay';
import { User } from './user.entity';

/**
 * O único caminho para apagar contas, usado pela eliminação pedida pelo
 * utilizador e pela limpeza das contas de demonstração expiradas.
 *
 * 1. Dentro da transação de quem chama: um evento user.deleted por conta no
 *    outbox e o DELETE dos utilizadores (os refresh tokens vão em cascata).
 * 2. Depois do commit: acorda o relay e revoga os access tokens já emitidos.
 */
@Injectable()
export class AccountRemovalService {
  private readonly logger = new Logger(AccountRemovalService.name);

  constructor(
    private readonly outbox: OutboxRelay,
    private readonly config: ConfigService<Env, true>,
    @Inject(AUTH_REDIS) private readonly redis: Redis | null,
  ) {}

  async removeWithin(em: EntityManager, userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    const events = userIds.map((userId) =>
      createEvent('user.deleted', { userId }),
    );
    await em.insert(
      OutboxEvent,
      events.map((e) => ({
        id: e.id,
        type: e.type,
        payload: e.payload,
        occurredAt: new Date(e.occurredAt),
        publishedAt: null,
      })),
    );
    await em.delete(User, { id: In(userIds) });
  }

  /** Chamar depois do commit da transação que usou removeWithin. */
  async afterCommit(userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    this.outbox.kick();
    await this.revokeAccessTokens(userIds);
  }

  /**
   * Os access tokens já emitidos valem até expirar. Marca os utilizadores como
   * revogados no Redis durante esse tempo; o gateway recusa-os.
   * Se o Redis estiver em baixo, os tokens expiram sozinhos em JWT_ACCESS_TTL.
   */
  private async revokeAccessTokens(userIds: string[]): Promise<void> {
    if (!this.redis) return;
    const ttl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    try {
      const pipeline = this.redis.multi();
      for (const id of userIds)
        pipeline.set(revokedUserKey(id), '1', 'EX', ttl);
      await pipeline.exec();
    } catch (err) {
      this.logger.warn(
        `Não foi possível revogar os tokens de ${userIds.length} conta(s) (${(err as Error).message}); expiram em ${ttl}s.`,
      );
    }
  }
}
