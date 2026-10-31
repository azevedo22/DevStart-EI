import {
  createRedis,
  describeWait,
  FixedWindowLimiter,
} from '@devstart/backend-common';
import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Env } from '../config/env';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/**
 * Quota de leituras com IA pedidas por utilizadores (CV e anúncios), contra o
 * custo de uma API paga numa app aberta: as contas de demonstração criam-se
 * sem registo, por isso o limite por utilizador não chega sozinho e há também
 * um teto global por dia. A recolha de vagas do ITJobs não conta: tem o seu
 * próprio limite (JOB_SYNC_AI_PER_RUN).
 *
 * Com Redis, os contadores são partilhados entre instâncias; se o Redis falhar,
 * deixa passar (o limite de uma análise de cada vez por utilizador continua).
 */
@Injectable()
export class AiQuota implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly limiter: FixedWindowLimiter;
  private readonly perUserPerHour: number;
  private readonly perDay: number;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    this.redis = url ? createRedis(url, 'profile-service:ai-quota') : null;
    this.redis?.on('error', () => undefined); // tratado no limiter (fail-open)
    this.limiter = new FixedWindowLimiter(this.redis);
    this.perUserPerHour = config.get('AI_USER_HOURLY_LIMIT', { infer: true });
    this.perDay = config.get('AI_DAILY_LIMIT', { infer: true });
  }

  /** Conta uma leitura; lança 429 com uma mensagem clara se passar do limite. */
  async consume(userId: string): Promise<void> {
    if (this.perUserPerHour > 0) {
      const user = await this.limiter.hit(
        `ai:user:${userId}`,
        this.perUserPerHour,
        HOUR,
      );
      if (!user.allowed) {
        throw tooMany(
          `Chegaste ao limite de ${this.perUserPerHour} leituras com IA por hora. ` +
            `Podes tentar outra vez ${describeWait(user.retryAfterMs)}, ou preencher à mão.`,
          user.retryAfterMs,
        );
      }
    }
    if (this.perDay > 0) {
      const all = await this.limiter.hit('ai:all', this.perDay, DAY);
      if (!all.allowed) {
        throw tooMany(
          `A IA do DevStart chegou ao limite de utilização de hoje. ` +
            `Volta a estar disponível ${describeWait(all.retryAfterMs)}; entretanto, podes preencher à mão.`,
          all.retryAfterMs,
        );
      }
    }
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}

function tooMany(message: string, retryAfterMs: number): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
