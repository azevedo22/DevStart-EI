import { createEnvValidator } from '@devstart/backend-common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString } from 'class-validator';

export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  PROFILE_SERVICE_PORT = 3002;

  @IsString()
  PROFILE_DATABASE_URL =
    'postgres://devstart:devstart@localhost:5432/devstart_profile';
}

export const validateEnv = createEnvValidator(Env, 'profile-service');
