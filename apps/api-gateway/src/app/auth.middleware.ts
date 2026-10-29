import {
  JwtPayload,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
} from '@devstart/shared-types';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isApiRoute, isPublicRoute } from './access-policy';

export interface AuthMiddlewareOptions {
  jwtSecret: string;
  issuer: string;
  /**
   * Diz se o utilizador foi revogado (conta apagada) depois de o token ser emitido.
   * Se lançar um erro (ex.: Redis em baixo), o pedido segue: o token expira sozinho
   * em poucos minutos e uma falha do Redis não deve deitar abaixo a API inteira.
   */
  isRevoked?: (userId: string) => Promise<boolean>;
  onRevocationCheckError?: (err: unknown) => void;
}

/**
 * Valida o access token à entrada e passa a identidade aos serviços internos
 * nos cabeçalhos x-user-id e x-user-role. Os serviços confiam nesses cabeçalhos,
 * por isso o gateway apaga-os SEMPRE do pedido original: um cliente não os pode forjar.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    delete req.headers[USER_ID_HEADER];
    delete req.headers[USER_ROLE_HEADER];

    if (!isApiRoute(req.path) || isPublicRoute(req.method, req.path))
      return next();

    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return unauthorized(res, 'Falta o token de acesso.');
    }

    let payload: JwtPayload;
    try {
      // algorithms fixo: impede ataques que trocam o algoritmo no cabeçalho (ex.: "none").
      payload = jwt.verify(token, options.jwtSecret, {
        algorithms: ['HS256'],
        issuer: options.issuer,
      }) as JwtPayload;
    } catch {
      return unauthorized(res, 'Token de acesso inválido ou expirado.');
    }

    if (options.isRevoked) {
      try {
        if (await options.isRevoked(payload.sub)) {
          return unauthorized(res, 'Esta sessão já não é válida.');
        }
      } catch (err) {
        options.onRevocationCheckError?.(err);
      }
    }

    req.headers[USER_ID_HEADER] = payload.sub;
    req.headers[USER_ROLE_HEADER] = payload.role;
    return next();
  };
}

function unauthorized(res: Response, message: string) {
  res.status(401).json({ statusCode: 401, error: 'Unauthorized', message });
}
