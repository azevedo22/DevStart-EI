import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import {
  LlmUnavailableError,
  StructuredChatRequest,
  StructuredLlm,
} from './llm';

/**
 * Cliente para APIs compatíveis com a da OpenAI (POST /chat/completions), com
 * saída estruturada via response_format: json_schema. Usado para a xAI (Grok);
 * o mesmo código serve outros fornecedores compatíveis mudando o URL base.
 */
@Injectable()
export class OpenAiCompatibleClient implements StructuredLlm {
  readonly remote = true;
  private readonly logger = new Logger(OpenAiCompatibleClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get label(): string {
    return `xAI · ${this.model}`;
  }

  private get model(): string {
    return this.config.get('XAI_MODEL', { infer: true });
  }

  private get baseUrl(): string {
    return this.config.get('XAI_BASE_URL', { infer: true }).replace(/\/$/, '');
  }

  async chatJson(req: StructuredChatRequest): Promise<unknown> {
    const key = this.config.get('XAI_API_KEY', { infer: true });
    if (!key) {
      throw new LlmUnavailableError(
        'Falta a chave da xAI: define XAI_API_KEY no .env.',
      );
    }

    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(
          this.config.get('XAI_TIMEOUT_MS', { infer: true }),
        ),
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'cv_extraction',
              strict: true,
              schema: toStrictSchema(req.schema),
            },
          },
        }),
      });
    } catch (err) {
      if ((err as Error).name === 'TimeoutError') {
        throw new LlmUnavailableError('A xAI demorou demasiado a responder.');
      }
      throw new LlmUnavailableError(
        `Não foi possível ligar à API da xAI (${this.baseUrl}).`,
      );
    }

    if (!res.ok) throw await this.explain(res, key);

    const body = (await res.json()) as {
      choices?: { message?: { content?: string; refusal?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = body.choices?.[0]?.message;
    this.logger.log(
      `CV lido por ${this.model} em ${((Date.now() - started) / 1000).toFixed(1)} s ` +
        `(${body.usage?.prompt_tokens ?? '?'} + ${body.usage?.completion_tokens ?? '?'} tokens).`,
    );
    if (message?.refusal) {
      throw new LlmUnavailableError('A IA recusou-se a ler este documento.');
    }
    try {
      return JSON.parse(message?.content ?? '');
    } catch {
      throw new LlmUnavailableError('A IA devolveu uma resposta inválida.');
    }
  }

  /** Transforma a resposta de erro numa mensagem que diz o que fazer. */
  private async explain(
    res: Response,
    key: string,
  ): Promise<LlmUnavailableError> {
    const detail = await res.text().catch(() => '');
    // Nunca se regista o corpo do pedido (tem o CV) nem a chave.
    this.logger.warn(`xAI respondeu ${res.status}: ${detail.slice(0, 300)}`);

    // A xAI responde 400 (e não 401) a uma chave errada: decide-se pelo texto.
    if (
      res.status === 401 ||
      res.status === 403 ||
      /api[ _-]?key|unauthori[sz]ed|authenticat/i.test(detail)
    ) {
      return new LlmUnavailableError(
        'A chave da xAI foi recusada. Confirma XAI_API_KEY no .env (sem aspas nem espaços) ou gera uma nova em https://console.x.ai.',
      );
    }
    if (res.status === 429) {
      return new LlmUnavailableError(
        'A xAI recusou o pedido por limite de utilização ou falta de saldo.',
      );
    }
    if (
      /model/i.test(detail) &&
      /not (found|exist)|invalid|does not/i.test(detail)
    ) {
      const models = await this.listModels(key);
      return new LlmUnavailableError(
        `O modelo "${this.model}" não existe na xAI.` +
          (models.length
            ? ` Modelos disponíveis: ${models.join(', ')}. Define XAI_MODEL no .env.`
            : ' Define XAI_MODEL no .env.'),
      );
    }
    return new LlmUnavailableError(
      `A xAI respondeu com erro ${res.status}${providerMessage(detail)}.`,
    );
  }

  /** Confirma a chave e o modelo sem enviar nenhum CV (usado no arranque). */
  async checkReady(): Promise<void> {
    const key = this.config.get('XAI_API_KEY', { infer: true });
    if (!key) {
      throw new LlmUnavailableError('falta XAI_API_KEY no .env.');
    }
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/models`, {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new LlmUnavailableError(
        `não foi possível ligar à API da xAI (${this.baseUrl}).`,
      );
    }
    if (!res.ok) throw await this.explain(res, key);
    const body = (await res.json()) as { data?: { id: string }[] };
    const models = (body.data ?? []).map((m) => m.id);
    if (models.length && !models.includes(this.model)) {
      throw new LlmUnavailableError(
        `o modelo "${this.model}" não existe na xAI. Modelos disponíveis: ${models
          .slice(0, 12)
          .join(', ')}. Define XAI_MODEL no .env.`,
      );
    }
  }

  private async listModels(key: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => m.id).slice(0, 12);
    } catch {
      return [];
    }
  }
}

/**
 * O modo "strict" das APIs compatíveis com a OpenAI exige que todas as
 * propriedades sejam obrigatórias e que não haja propriedades extra. As
 * opcionais do esquema já aceitam null, por isso basta marcá-las obrigatórias.
 */
export function toStrictSchema(schema: object): object {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = visit(v);
    if (out['type'] === 'object' && out['properties']) {
      out['required'] = Object.keys(out['properties'] as object);
      out['additionalProperties'] = false;
    }
    return out;
  };
  return visit(schema) as object;
}

/** A mensagem de erro do fornecedor, se vier no formato habitual ({ error }). */
function providerMessage(detail: string): string {
  try {
    const body = JSON.parse(detail) as {
      error?: string | { message?: string };
    };
    const text =
      typeof body.error === 'string' ? body.error : body.error?.message;
    return text ? `: ${text.slice(0, 200)}` : '';
  } catch {
    return '';
  }
}
