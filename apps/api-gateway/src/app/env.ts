import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Tem de ser igual ao do auth-service. Fica duplicado de propósito em vez de ir
 * para libs/shared-types, que também é importada pelo frontend.
 */
export const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

export class GatewayEnv {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  GATEWAY_PORT = 3000;

  @IsString()
  WEB_ORIGIN = 'http://localhost:4200';

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET precisa de pelo menos 32 caracteres',
  })
  JWT_ACCESS_SECRET = DEV_JWT_SECRET;

  @IsString()
  JWT_ISSUER = 'devstart-auth';

  /** Redis partilhado: o gateway lê daqui os utilizadores revogados. Vazio desliga. */
  @IsString()
  REDIS_URL = 'redis://localhost:6379';

  /**
   * Quantos proxies estão à frente do gateway, para saber o IP real de quem
   * pede (rate limiting sem sessão). 0 = nenhum (desenvolvimento); 1 = nginx
   * (docker compose); 2 = Caddy + nginx (produção).
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS = 0;

  /** Pedidos à API por minuto, por utilizador (ou IP, sem sessão). 0 desliga. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  API_RATE_LIMIT_PER_MINUTE = 300;
}

export function validateGatewayEnv(raw: Record<string, unknown>): GatewayEnv {
  const env = plainToInstance(GatewayEnv, raw, { exposeDefaultValues: true });
  const errors = validateSync(env);
  if (errors.length) {
    const detail = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    throw new Error(`Configuração inválida do api-gateway: ${detail}`);
  }
  if (
    env.NODE_ENV === 'production' &&
    env.JWT_ACCESS_SECRET === DEV_JWT_SECRET
  ) {
    throw new Error(
      'Falta JWT_ACCESS_SECRET no .env. É obrigatória fora do desenvolvimento local (ver .env.example).',
    );
  }
  return env;
}
