import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
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
    throw new Error('Define JWT_ACCESS_SECRET em produção.');
  }
  return env;
}
