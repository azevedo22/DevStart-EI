import {
  DomainEvent,
  EventHandlers,
  EventSubscriber,
} from '@devstart/backend-common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Env } from '../config/env';

/**
 * Ouve eventos sobre utilizadores publicados pelo Auth Service.
 * user.deleted → apaga candidaturas (o histórico e as entrevistas vão em cascata).
 */
@Injectable()
export class UserEventsSubscriber extends EventSubscriber {
  protected readonly group = 'tracker-service';
  private readonly log = new Logger(UserEventsSubscriber.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDataSource() private readonly db: DataSource,
  ) {
    super();
  }

  protected redisUrl(): string | null {
    return this.config.get('REDIS_URL', { infer: true }) || null;
  }

  protected handlers(): EventHandlers {
    return { 'user.deleted': (e) => this.onUserDeleted(e) };
  }

  /** Idempotente: um segundo evento igual não encontra nada e termina sem erro. */
  async onUserDeleted(event: DomainEvent<'user.deleted'>): Promise<void> {
    const { userId } = event.payload;
    const [, count] = await this.db.query(
      `DELETE FROM applications WHERE user_id = $1`,
      [userId],
    );
    this.log.log(`user.deleted ${userId}: ${count} candidaturas apagadas.`);
  }
}
