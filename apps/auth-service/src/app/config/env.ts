import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** Segredo só para desenvolvimento local. Em produção o arranque falha sem JWT_ACCESS_SECRET. */
export const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  AUTH_SERVICE_PORT = 3001;

  @IsString()
  AUTH_DATABASE_URL =
    'postgres://devstart:devstart@localhost:5432/devstart_auth';

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET precisa de pelo menos 32 caracteres',
  })
  JWT_ACCESS_SECRET = DEV_JWT_SECRET;

  /** Validade do access token, em segundos. Curta de propósito: o refresh renova-o. */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TOKEN_TTL_DAYS = 7;

  /** Caminho do cookie tal como o browser o vê (através do gateway). */
  @IsString()
  REFRESH_COOKIE_PATH = '/api/v1/auth';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_ROUNDS = 12;

  /**
   * Redis partilhado: eventos entre serviços e contadores do rate limiting.
   * Vazio desliga ambos (o rate limiting passa a ser em memória, por instância).
   */
  @IsString()
  REDIS_URL = 'redis://localhost:6379';
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const detail = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    throw new Error(`Configuração inválida do auth-service: ${detail}`);
  }
  if (
    env.NODE_ENV === 'production' &&
    env.JWT_ACCESS_SECRET === DEV_JWT_SECRET
  ) {
    throw new Error('Define JWT_ACCESS_SECRET em produção.');
  }
  return env;
}
