import { createEvent } from '@devstart/backend-common';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Env } from '../config/env';
import { OutboxEvent } from '../outbox/outbox-event.entity';
import { OutboxRelay } from '../outbox/outbox-relay';
import { AccountRemovalService } from '../users/account-removal.service';
import { User } from '../users/user.entity';
import { AuthService, AuthSession } from './auth.service';

const CLEANUP_INTERVAL_MS = 10 * 60_000;
const CLEANUP_BATCH = 100;

/**
 * "Experimentar sem registo": cada visitante recebe uma conta só sua, já com
 * dados de exemplo, que é apagada automaticamente ao fim de DEMO_TTL_HOURS.
 *
 * Uma conta por visitante, e não uma conta partilhada: ninguém vê nem estraga
 * o que outro visitante fez, e não é preciso repor dados.
 *
 * O Auth Service não conhece os dados de exemplo. Publica `user.demo-created` e
 * cada serviço preenche a sua parte. Na expiração, a conta é apagada pelo mesmo
 * caminho que uma eliminação normal (user.deleted).
 */
@Injectable()
export class DemoAccountsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DemoAccountsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly auth: AuthService,
    private readonly removal: AccountRemovalService,
    private readonly outbox: OutboxRelay,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (
      !this.enabled ||
      this.config.get('NODE_ENV', { infer: true }) === 'test'
    )
      return;
    const run = () =>
      void this.purgeExpired().catch((err) =>
        this.logger.warn(
          `Falhou a limpeza das contas de demonstração: ${(err as Error).message}`,
        ),
      );
    run();
    this.timer = setInterval(run, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async create(): Promise<AuthSession> {
    if (!this.enabled) throw new NotFoundException();

    // Limite aproximado: dois pedidos simultâneos podem passá-lo por uma ou duas
    // contas. Serve para conter abusos, não precisa de ser exato.
    const [{ active }] = await this.db.query(
      `SELECT count(*)::int AS active FROM users WHERE demo_expires_at > now()`,
    );
    if (active >= this.config.get('DEMO_MAX_ACTIVE', { infer: true })) {
      throw new ServiceUnavailableException(
        'Há demasiadas demonstrações a decorrer. Tenta daqui a pouco ou cria uma conta.',
      );
    }

    const ttlHours = this.config.get('DEMO_TTL_HOURS', { infer: true });
    const id = randomUUID();
    const event = createEvent('user.demo-created', { userId: id });
    // Password aleatória que ninguém conhece: só se entra pela sessão que abrimos aqui.
    const passwordHash = await bcrypt.hash(
      randomBytes(32).toString('base64url'),
      this.config.get('BCRYPT_ROUNDS', { infer: true }),
    );

    const user = await this.db.transaction(async (em) => {
      const saved = await em.save(
        em.create(User, {
          id,
          email: `demo-${id}@demo.devstart.invalid`,
          passwordHash,
          fullName: 'Visitante Demo',
          demoExpiresAt: new Date(Date.now() + ttlHours * 3_600_000),
        }),
      );
      await em.insert(OutboxEvent, {
        id: event.id,
        type: event.type,
        payload: event.payload,
        occurredAt: new Date(event.occurredAt),
        publishedAt: null,
      });
      return saved;
    });
    this.outbox.kick();
    this.logger.log(`Conta de demonstração ${id} criada.`);
    return this.auth.startSession(user);
  }

  /**
   * Apaga as contas de demonstração expiradas, em lotes. FOR UPDATE SKIP LOCKED:
   * com várias instâncias do serviço, cada conta é apagada por uma só.
   */
  async purgeExpired(): Promise<number> {
    let total = 0;
    for (;;) {
      const ids = await this.db.transaction(async (em) => {
        const rows: { id: string }[] = await em.query(
          `SELECT id FROM users
            WHERE demo_expires_at <= now()
            ORDER BY demo_expires_at
            LIMIT $1
            FOR UPDATE SKIP LOCKED`,
          [CLEANUP_BATCH],
        );
        const batch = rows.map((r) => r.id);
        await this.removal.removeWithin(em, batch);
        return batch;
      });
      await this.removal.afterCommit(ids);
      total += ids.length;
      if (ids.length < CLEANUP_BATCH) break;
    }
    if (total)
      this.logger.log(
        `${total} conta(s) de demonstração expirada(s) apagada(s).`,
      );
    return total;
  }

  private get enabled(): boolean {
    return this.config.get('DEMO_MAX_ACTIVE', { infer: true }) > 0;
  }
}
