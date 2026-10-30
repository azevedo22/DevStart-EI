import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import {
  LlmUnavailableError,
  StructuredChatRequest,
  StructuredLlm,
} from './llm';

/**
 * Cliente mínimo da API do Ollama (POST /api/chat), com saída estruturada.
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */
@Injectable()
export class OllamaClient implements StructuredLlm {
  readonly remote = false;

  private readonly logger = new Logger(OllamaClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get label(): string {
    return `Ollama · ${this.model}`;
  }

  get model(): string {
    return this.config.get('OLLAMA_MODEL', { infer: true });
  }

  async chatJson(req: StructuredChatRequest): Promise<unknown> {
    const base = this.config.get('OLLAMA_URL', { infer: true });
    if (!base)
      throw new LlmUnavailableError('A IA está desligada (OLLAMA_URL vazio).');

    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${base.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(
          this.config.get('OLLAMA_TIMEOUT_MS', { infer: true }),
        ),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: req.schema,
          // Temperatura 0: extração de dados, não escrita criativa.
          options: { temperature: 0, num_ctx: 8192 },
          keep_alive: '10m',
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
      });
    } catch (err) {
      const e = err as Error;
      if (e.name === 'TimeoutError') {
        throw new LlmUnavailableError(
          'A IA demorou demasiado a responder. Tenta outra vez ou usa um modelo mais pequeno.',
        );
      }
      throw new LlmUnavailableError(
        `Não foi possível ligar ao Ollama em ${base}. Confirma que está a correr.`,
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      if (res.status === 404 && /not found/i.test(detail)) {
        throw new LlmUnavailableError(
          `O modelo "${this.model}" não está instalado no Ollama. Corre: ollama pull ${this.model}`,
        );
      }
      throw new LlmUnavailableError(
        `O Ollama respondeu com erro ${res.status}.`,
      );
    }

    const body = (await res.json()) as { message?: { content?: string } };
    this.logger.log(
      `CV lido por ${this.model} em ${((Date.now() - started) / 1000).toFixed(1)} s.`,
    );
    try {
      return JSON.parse(body.message?.content ?? '');
    } catch {
      throw new LlmUnavailableError('A IA devolveu uma resposta inválida.');
    }
  }

  /** Confirma que o Ollama responde e que o modelo está instalado. */
  async checkReady(): Promise<void> {
    const base = this.config.get('OLLAMA_URL', { infer: true });
    if (!base)
      throw new LlmUnavailableError('a IA está desligada (OLLAMA_URL vazio).');
    let tags: { models?: { name: string }[] };
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      tags = (await res.json()) as typeof tags;
    } catch {
      throw new LlmUnavailableError(`o Ollama não está a correr em ${base}.`);
    }
    const names = (tags.models ?? []).map((m) => m.name);
    // "qwen2.5:7b" também pode estar instalado como "qwen2.5:7b-instruct...": aceita o prefixo.
    const wanted = this.model.includes(':')
      ? this.model
      : `${this.model}:latest`;
    if (!names.some((n) => n === wanted || n.startsWith(this.model))) {
      throw new LlmUnavailableError(
        `o modelo "${this.model}" não está instalado. Corre: ollama pull ${this.model}` +
          (names.length ? ` (instalados: ${names.join(', ')})` : ''),
      );
    }
  }
}
