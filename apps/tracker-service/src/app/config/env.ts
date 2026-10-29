import { createEnvValidator } from '@devstart/backend-common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString } from 'class-validator';

export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  TRACKER_SERVICE_PORT = 3003;

  @IsString()
  TRACKER_DATABASE_URL =
    'postgres://devstart:devstart@localhost:5432/devstart_tracker';

  /** Redis partilhado, para ouvir eventos de outros serviços. Vazio desliga o consumidor. */
  @IsString()
  REDIS_URL = 'redis://localhost:6379';
}

export const validateEnv = createEnvValidator(Env, 'tracker-service');
