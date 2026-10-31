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
   * - groq: API da Groq (modelos abertos, muito rápida). Paga/limitada; o CV é enviado.
   * - xai: API da xAI (Grok). Paga; o CV é enviado.
   * Atenção: Groq (com q) e Grok (com k, da xAI) são coisas diferentes.
   */
  @IsIn(['ollama', 'groq', 'xai'])
  LLM_PROVIDER: 'ollama' | 'groq' | 'xai' = 'ollama';

  /** Tempo máximo de resposta das IAs na cloud (Groq, xAI). */
  @Type(() => Number)
  @IsInt()
  @Min(5_000)
  @Max(600_000)
  CLOUD_LLM_TIMEOUT_MS = 60_000;

  // Groq. As chaves começam por "gsk_". Modelos: GET {GROQ_BASE_URL}/models.
  @IsString()
  GROQ_API_KEY = '';

  @IsString()
  GROQ_MODEL = 'openai/gpt-oss-20b';

  @IsString()
  GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

  // xAI (Grok). As chaves começam por "xai-". Modelos: GET {XAI_BASE_URL}/models.
  @IsString()
  XAI_API_KEY = '';

  @IsString()
  XAI_MODEL = 'grok-4-fast-non-reasoning';

  @IsString()
  XAI_BASE_URL = 'https://api.x.ai/v1';

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

  // ── Vagas (ITJobs.pt) ──────────────────────────────────────
  /** Chave da API do ITJobs.pt (https://itjobs.pt/api). Vazia desliga a recolha de vagas. */
  @IsString()
  ITJOBS_API_KEY = '';

  @IsString()
  ITJOBS_BASE_URL = 'https://api.itjobs.pt';

  /** De quantos em quantos minutos se vão buscar vagas. 0 desliga a recolha automática. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  JOB_SYNC_INTERVAL_MINUTES = 180;

  /** Quantas vagas novas a IA lê em cada recolha (as restantes ficam para a seguinte). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  JOB_SYNC_AI_PER_RUN = 10;

  // ── Limites da IA (custo) ──────────────────────────────────
  /** Leituras com IA (CV e anúncios) por utilizador, por hora. 0 desliga. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  AI_USER_HOURLY_LIMIT = 20;

  /** Leituras com IA de todos os utilizadores juntos, por dia. 0 desliga. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  AI_DAILY_LIMIT = 300;
}

export const validateEnv = createEnvValidator(Env, 'profile-service');
