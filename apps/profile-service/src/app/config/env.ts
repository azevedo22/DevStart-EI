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
   * Que IA lê os CVs:
   * - ollama: modelo local, gratuito, o CV não sai do computador.
   * - xai: API da xAI (Grok), compatível com a da OpenAI. Mais rápida e melhor,
   *   mas paga e o CV é enviado para a xAI.
   */
  @IsIn(['ollama', 'xai'])
  LLM_PROVIDER: 'ollama' | 'xai' = 'ollama';

  /** Chave da API da xAI. Fica só no .env (nunca no Git). */
  @IsString()
  XAI_API_KEY = '';

  /** Modelo da xAI. A lista de modelos disponíveis está em GET {XAI_BASE_URL}/models. */
  @IsString()
  XAI_MODEL = 'grok-4-fast-non-reasoning';

  @IsString()
  XAI_BASE_URL = 'https://api.x.ai/v1';

  @Type(() => Number)
  @IsInt()
  @Min(5_000)
  @Max(600_000)
  XAI_TIMEOUT_MS = 60_000;

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
