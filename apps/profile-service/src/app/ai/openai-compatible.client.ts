import { Logger } from '@nestjs/common';
import {
  LlmRateLimitError,
  LlmUnavailableError,
  StructuredChatRequest,
  StructuredLlm,
} from './llm';

/** Definições de um fornecedor compatível com a API da OpenAI. */
export interface OpenAiCompatibleSettings {
  /** Nome para mensagens, ex.: "xAI", "Groq". */
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** Variáveis do .env, para as mensagens de erro dizerem o que mudar. */
  keyVar: string;
  modelVar: string;
  /** Onde se gera uma chave. */
  consoleUrl: string;
  /** Prefixo das chaves deste fornecedor (ex.: "xai-", "gsk_"), para detetar trocas. */
  keyPrefix: string;
}

/** Prefixos conhecidos: uma chave de um fornecedor usada noutro é um erro comum. */
const KNOWN_PREFIXES: Record<string, string> = {
  'xai-': 'xAI (LLM_PROVIDER=xai, XAI_API_KEY)',
  gsk_: 'Groq (LLM_PROVIDER=groq, GROQ_API_KEY)',
  'sk-': 'OpenAI',
};

/**
 * Cliente para APIs compatíveis com a da OpenAI (POST /chat/completions), com
 * saída estruturada (response_format: json_schema, modo estrito). Serve a xAI
 * (Grok) e a Groq; outro fornecedor compatível é só mais um conjunto de
 * definições.
 *
 * Se o modelo não suportar json_schema, repete uma vez em modo json_object,
 * com o esquema nas instruções: a resposta é validada depois na mesma.
 */
export class OpenAiCompatibleClient implements StructuredLlm {
  readonly remote = true;
  private readonly logger: Logger;

  constructor(private readonly s: OpenAiCompatibleSettings) {
    this.logger = new Logger(`IA:${s.name}`);
  }

  get provider(): string {
    return this.s.name;
  }

  get label(): string {
    return `${this.s.name} · ${this.s.model}`;
  }

  private get baseUrl(): string {
    return this.s.baseUrl.replace(/\/$/, '');
  }

  async chatJson(req: StructuredChatRequest): Promise<unknown> {
    this.assertKey();
    const strict = {
      type: 'json_schema',
      json_schema: {
        name: req.name,
        strict: true,
        schema: toStrictSchema(req.schema),
      },
    };
    let res = await this.post(req.system, req.user, strict);

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      if (
        res.status === 400 &&
        /json_schema|response_format|structured/i.test(detail)
      ) {
        this.logger.warn(
          `${this.s.model} não aceita json_schema; a repetir em modo json_object.`,
        );
        const system = `${req.system}\n\nResponde APENAS com um objeto JSON que siga este JSON Schema:\n${JSON.stringify(req.schema)}`;
        res = await this.post(system, req.user, { type: 'json_object' });
        if (!res.ok)
          throw await this.explain(
            res.status,
            await res.text().catch(() => ''),
          );
      } else {
        throw await this.explain(res.status, detail);
      }
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string; refusal?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = body.choices?.[0]?.message;
    this.logger.log(
      `${req.what} lido por ${this.s.model} (${body.usage?.prompt_tokens ?? '?'} + ` +
        `${body.usage?.completion_tokens ?? '?'} tokens).`,
    );
    if (message?.refusal) {
      throw new LlmUnavailableError(`A IA recusou-se a ler este ${req.what}.`);
    }
    try {
      return JSON.parse(message?.content ?? '');
    } catch {
      throw new LlmUnavailableError('A IA devolveu uma resposta inválida.');
    }
  }

  /** Confirma a chave e o modelo sem enviar nenhum CV (usado no arranque). */
  async checkReady(): Promise<void> {
    this.assertKey();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/models`, {
        headers: { authorization: `Bearer ${this.s.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new LlmUnavailableError(
        `não foi possível ligar à API da ${this.s.name} (${this.baseUrl}).`,
      );
    }
    if (!res.ok) {
      throw await this.explain(res.status, await res.text().catch(() => ''));
    }
    const models = await this.modelsFrom(res);
    if (models.length && !models.includes(this.s.model)) {
      throw new LlmUnavailableError(
        `o modelo "${this.s.model}" não existe na ${this.s.name}. ` +
          `Modelos disponíveis: ${models.slice(0, 15).join(', ')}. Define ${this.s.modelVar} no .env.`,
      );
    }
  }

  // ── Auxiliares ──────────────────────────────────────────────

  private post(system: string, user: string, responseFormat: object) {
    return fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.s.apiKey}`,
      },
      signal: AbortSignal.timeout(this.s.timeoutMs),
      body: JSON.stringify({
        model: this.s.model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: responseFormat,
        // Os gpt-oss raciocinam antes de responder, e o raciocínio conta para
        // o limite de tokens por minuto. Para extrair dados, "low" chega.
        ...(/^openai\/gpt-oss/.test(this.s.model) && {
          reasoning_effort: 'low',
        }),
      }),
    }).catch((err: Error) => {
      throw new LlmUnavailableError(
        err.name === 'TimeoutError'
          ? `A ${this.s.name} demorou demasiado a responder.`
          : `Não foi possível ligar à API da ${this.s.name} (${this.baseUrl}).`,
      );
    });
  }

  /** Falta de chave, ou chave de outro fornecedor: erro claro antes de qualquer pedido. */
  private assertKey(): void {
    if (!this.s.apiKey) {
      throw new LlmUnavailableError(
        `falta a chave da ${this.s.name}: define ${this.s.keyVar} no .env.`,
      );
    }
    if (!this.s.apiKey.startsWith(this.s.keyPrefix)) {
      const owner = Object.entries(KNOWN_PREFIXES).find(([p]) =>
        this.s.apiKey.startsWith(p),
      )?.[1];
      if (owner) {
        throw new LlmUnavailableError(
          `esta chave parece ser da ${owner}, não da ${this.s.name}. ` +
            `As chaves da ${this.s.name} começam por "${this.s.keyPrefix}".`,
        );
      }
    }
  }

  /** Transforma a resposta de erro numa mensagem que diz o que fazer. */
  private async explain(
    status: number,
    detail: string,
  ): Promise<LlmUnavailableError> {
    // Nunca se regista o corpo do pedido (tem o CV) nem a chave.
    this.logger.warn(`respondeu ${status}: ${detail.slice(0, 300)}`);

    // A xAI responde 400 (e não 401) a uma chave errada: decide-se também pelo texto.
    if (
      status === 401 ||
      status === 403 ||
      /api[ _-]?key|unauthori[sz]ed|authenticat/i.test(detail)
    ) {
      return new LlmUnavailableError(
        `A chave da ${this.s.name} foi recusada. Confirma ${this.s.keyVar} no .env ` +
          `(sem aspas nem espaços) ou gera uma nova em ${this.s.consoleUrl}.`,
      );
    }
    if (status === 429) {
      return new LlmRateLimitError(
        `A ${this.s.name} recusou o pedido por limite de utilização ou falta de saldo.`,
        retryAfterMs(detail),
      );
    }
    if (
      /model/i.test(detail) &&
      /not (found|exist)|invalid|does not|decommissioned/i.test(detail)
    ) {
      const models = await this.listModels();
      return new LlmUnavailableError(
        `O modelo "${this.s.model}" não existe na ${this.s.name}.` +
          (models.length
            ? ` Modelos disponíveis: ${models.slice(0, 15).join(', ')}.`
            : '') +
          ` Define ${this.s.modelVar} no .env.`,
      );
    }
    return new LlmUnavailableError(
      `A ${this.s.name} respondeu com erro ${status}${providerMessage(detail)}.`,
    );
  }

  private async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { authorization: `Bearer ${this.s.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      return this.modelsFrom(res);
    } catch {
      return [];
    }
  }

  private async modelsFrom(res: Response): Promise<string[]> {
    const body = (await res.json().catch(() => ({}))) as {
      data?: { id: string }[];
    };
    return (body.data ?? []).map((m) => m.id).sort();
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

/**
 * Quanto esperar, pela mensagem do fornecedor: "Please try again in 10.7175s",
 * "in 1m2.5s" ou "in 450ms". null se não disser (ex.: falta de saldo).
 */
export function retryAfterMs(detail: string): number | null {
  const m = /try again in\s+(?:(\d+)m(?!s))?\s*(?:([\d.]+)(ms|s))?/i.exec(
    detail,
  );
  if (!m || (!m[1] && !m[2])) return null;
  const minutes = Number(m[1] ?? 0);
  const value = Number(m[2] ?? 0);
  const ms = minutes * 60_000 + (m[3] === 'ms' ? value : value * 1000);
  return Number.isFinite(ms) ? Math.ceil(ms) : null;
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
