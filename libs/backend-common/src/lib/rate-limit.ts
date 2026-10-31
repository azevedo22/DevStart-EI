import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  /** Quantos pedidos já contam nesta janela (incluindo este). */
  count: number;
  /** Quanto falta para a janela recomeçar. */
  retryAfterMs: number;
}

/**
 * Conta pedidos por chave em janelas fixas (ex.: "este utilizador, esta hora").
 * Com Redis, o contador é partilhado por todas as instâncias; sem Redis, fica
 * em memória (só serve com uma instância, como em desenvolvimento).
 *
 * Se o Redis falhar, deixa passar (fail-open) e avisa uma vez por minuto: uma
 * falha do Redis não deve deitar abaixo a API. É a mesma decisão do rate
 * limiting do auth-service.
 */
export class FixedWindowLimiter {
  private readonly memory = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly logger = new Logger('RateLimit');
  private lastWarning = 0;

  constructor(
    private readonly redis: Redis | null,
    private readonly now: () => number = Date.now,
  ) {}

  async hit(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    if (!this.redis) return this.hitMemory(key, limit, windowMs);
    try {
      // INCR + PEXPIRE só na primeira vez, numa só ida ao Redis.
      const [count, ttl] = (await this.redis.eval(
        `local c = redis.call('INCR', KEYS[1])
         if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
         return {c, redis.call('PTTL', KEYS[1])}`,
        1,
        `ratelimit:${key}`,
        windowMs,
      )) as [number, number];
      return { allowed: count <= limit, count, retryAfterMs: Math.max(ttl, 0) };
    } catch (err) {
      if (this.now() - this.lastWarning > 60_000) {
        this.lastWarning = this.now();
        this.logger.warn(
          `Redis indisponível para o rate limiting; a deixar passar (${(err as Error).message}).`,
        );
      }
      return { allowed: true, count: 0, retryAfterMs: 0 };
    }
  }

  private hitMemory(
    key: string,
    limit: number,
    windowMs: number,
  ): RateLimitResult {
    const now = this.now();
    let entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.memory.set(key, entry);
      if (this.memory.size > 10_000) this.sweep(now);
    }
    entry.count++;
    return {
      allowed: entry.count <= limit,
      count: entry.count,
      retryAfterMs: entry.resetAt - now,
    };
  }

  /** Esquece as janelas já fechadas, para a memória não crescer sem fim. */
  private sweep(now: number): void {
    for (const [k, e] of this.memory)
      if (e.resetAt <= now) this.memory.delete(k);
  }
}

/** "daqui a 3 min", "daqui a 2 h": para mensagens ao utilizador. */
export function describeWait(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `daqui a ${min} min`;
  return `daqui a ${Math.ceil(min / 60)} h`;
}
