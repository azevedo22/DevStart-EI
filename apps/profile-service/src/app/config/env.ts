import { createEnvValidator } from '@devstart/backend-common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  PROFILE_SERVICE_PORT = 3002;

  @IsString()
  PROFILE_DATABASE_URL =
    'postgres://devstart:devstart@localhost:5432/devstart_profile';

  /** Redis partilhado, para ouvir eventos de outros serviços. Vazio desliga o consumidor. */
  @IsString()
  REDIS_URL = 'redis://localhost:6379';

  /**
   * Ollama (modelo de linguagem local) para ler CVs. Vazio desliga a IA: a
   * importação passa a detetar só competências e links por palavras-chave.
   */
  @IsString()
  OLLAMA_URL = 'http://localhost:11434';

  /** Modelo usado para ler os CVs (tem de estar instalado: `ollama pull <modelo>`). */
  @IsString()
  OLLAMA_MODEL = 'qwen2.5:7b';

  /** Num CPU sem GPU, um CV pode levar mais de um minuto. */
  @Type(() => Number)
  @IsInt()
  @Min(5_000)
  @Max(600_000)
  OLLAMA_TIMEOUT_MS = 180_000;
}

export const validateEnv = createEnvValidator(Env, 'profile-service');
