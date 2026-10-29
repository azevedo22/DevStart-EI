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
import { DemoApplicationsSeeder } from '../demo/demo-applications.seeder';

/**
 * Ouve eventos sobre utilizadores publicados pelo Auth Service.
 * user.deleted      → apaga candidaturas (o histórico e as entrevistas vão em cascata).
 * user.demo-created → preenche a conta de demonstração com candidaturas de exemplo.
 */
@Injectable()
export class UserEventsSubscriber extends EventSubscriber {
  protected readonly group = 'tracker-service';
  private readonly log = new Logger(UserEventsSubscriber.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly demo: DemoApplicationsSeeder,
  ) {
    super();
  }

  protected redisUrl(): string | null {
    return this.config.get('REDIS_URL', { infer: true }) || null;
  }

  protected handlers(): EventHandlers {
    return {
      'user.deleted': (e) => this.onUserDeleted(e),
      'user.demo-created': (e) => this.demo.seed(e.payload.userId),
    };
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
