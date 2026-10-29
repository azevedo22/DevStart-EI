import {
  EventPublisher,
  EventType,
  createRedis,
} from '@devstart/backend-common';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { Env } from '../config/env';

const BATCH = 50;
const INTERVAL_MS = 1_000;

interface PendingRow {
  id: string;
  type: EventType;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/**
 * Publica no Redis os eventos do outbox. Corre a cada segundo e também logo a
 * seguir a uma escrita (`kick`), para o atraso habitual ser de milissegundos.
 *
 * `FOR UPDATE SKIP LOCKED` deixa correr várias instâncias do serviço sem que
 * duas publiquem o mesmo lote.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private redis: Redis | null = null;
  private publisher: EventPublisher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<number> | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url) {
      this.logger.warn(
        'Outbox sem Redis (REDIS_URL vazio): os eventos ficam guardados e não são publicados.',
      );
      return;
    }
    this.redis = createRedis(url, 'auth-outbox');
    this.redis.on('error', () => undefined); // os erros são tratados em flush()
    this.publisher = new EventPublisher(this.redis);
    this.timer = setInterval(() => void this.flush(), INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flushing?.catch(() => undefined);
    this.redis?.disconnect();
  }

  /** Pede uma publicação imediata (sem esperar pelo próximo ciclo). */
  kick(): void {
    void this.flush();
  }

  /** Publica o que estiver pendente. Devolve quantos eventos publicou. */
  flush(): Promise<number> {
    if (!this.publisher) return Promise.resolve(0);
    // Um flush de cada vez nesta instância; o seguinte espera pelo atual.
    this.flushing ??= this.doFlush().finally(() => (this.flushing = null));
    return this.flushing;
  }

  private async doFlush(): Promise<number> {
    const publisher = this.publisher!;
    return this.db.transaction(async (em) => {
      const rows: PendingRow[] = await em.query(
        `SELECT id, type, payload, occurred_at FROM outbox_events
          WHERE published_at IS NULL ORDER BY occurred_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [BATCH],
      );
      const published: string[] = [];
      for (const row of rows) {
        try {
          await publisher.publish({
            id: row.id,
            type: row.type,
            occurredAt: new Date(row.occurred_at).toISOString(),
            payload: row.payload as never,
          });
          published.push(row.id);
        } catch (err) {
          // Redis em baixo: guarda o erro e pára o lote. O evento continua pendente.
          await em.query(
            `UPDATE outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
            [row.id, String((err as Error).message).slice(0, 500)],
          );
          this.logger.warn(
            `Não foi possível publicar ${row.type} (${row.id}); nova tentativa em breve.`,
          );
          break;
        }
      }
      if (published.length) {
        await em.query(
          `UPDATE outbox_events SET published_at = now() WHERE id = ANY($1)`,
          [published],
        );
      }
      return published.length;
    });
  }
}
