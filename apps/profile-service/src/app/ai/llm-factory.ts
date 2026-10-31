import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { StructuredLlm } from './llm';
import { OllamaClient } from './ollama.client';
import { OpenAiCompatibleClient } from './openai-compatible.client';

/** Escolhe a IA que lê os CVs a partir do .env (LLM_PROVIDER). */
export function createLlm(
  config: ConfigService<Env, true>,
  ollama: OllamaClient,
): StructuredLlm {
  const get = <K extends keyof Env>(key: K) =>
    config.get(key, { infer: true }) as Env[K];
  const timeoutMs = get('CLOUD_LLM_TIMEOUT_MS');

  switch (get('LLM_PROVIDER')) {
    case 'groq':
      return new OpenAiCompatibleClient({
        name: 'Groq',
        baseUrl: get('GROQ_BASE_URL'),
        apiKey: get('GROQ_API_KEY'),
        model: get('GROQ_MODEL'),
        timeoutMs,
        keyVar: 'GROQ_API_KEY',
        modelVar: 'GROQ_MODEL',
        consoleUrl: 'https://console.groq.com/keys',
        keyPrefix: 'gsk_',
      });
    case 'xai':
      return new OpenAiCompatibleClient({
        name: 'xAI',
        baseUrl: get('XAI_BASE_URL'),
        apiKey: get('XAI_API_KEY'),
        model: get('XAI_MODEL'),
        timeoutMs,
        keyVar: 'XAI_API_KEY',
        modelVar: 'XAI_MODEL',
        consoleUrl: 'https://console.x.ai',
        keyPrefix: 'xai-',
      });
    default:
      return ollama;
  }
}
