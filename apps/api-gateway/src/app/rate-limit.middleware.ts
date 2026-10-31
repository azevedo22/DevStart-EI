import { FixedWindowLimiter } from '@devstart/backend-common';
import { USER_ID_HEADER } from '@devstart/shared-types';
import type { NextFunction, Request, Response } from 'express';
import { isApiRoute } from './access-policy';

export interface RateLimitOptions {
  limiter: FixedWindowLimiter;
  /** Pedidos por minuto por pessoa. 0 desliga. */
  perMinute: number;
}

const MINUTE = 60_000;

/**
 * Limite geral da API, à porta: por utilizador quando há sessão (corre depois
 * da autenticação, que põe o x-user-id), senão por IP. É uma rede de segurança
 * contra scripts e ciclos no frontend; os limites finos (login, IA) ficam nos
 * serviços.
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (
      options.perMinute <= 0 ||
      req.method === 'OPTIONS' ||
      !isApiRoute(req.path)
    ) {
      return next();
    }
    const userId = req.headers[USER_ID_HEADER];
    const key =
      typeof userId === 'string' ? `api:user:${userId}` : `api:ip:${req.ip}`;
    const result = await options.limiter.hit(key, options.perMinute, MINUTE);
    if (result.allowed) return next();

    const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Demasiados pedidos seguidos. Espera ${seconds} s e tenta de novo.`,
      retryAfterSeconds: seconds,
    });
  };
}
