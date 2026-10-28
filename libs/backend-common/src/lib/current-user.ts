import { USER_ID_HEADER } from '@devstart/shared-types';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Este serviço não valida JWTs: confia no gateway, que valida o token e escreve
 * o x-user-id (apagando qualquer valor vindo do cliente). Por isso o serviço
 * só pode ser acessível dentro da rede interna, nunca exposto diretamente.
 */
@Injectable()
export class RequireUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.headers[USER_ID_HEADER];
    if (typeof userId !== 'string' || !UUID.test(userId)) {
      throw new UnauthorizedException('Pedido sem identidade de utilizador.');
    }
    return true;
  }
}

/** Id do utilizador autenticado (usar só em rotas protegidas por RequireUserGuard). */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest<Request>().headers[
      USER_ID_HEADER
    ] as string;
  },
);
