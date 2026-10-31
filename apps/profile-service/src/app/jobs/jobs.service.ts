import { JobPostingDraft } from '@devstart/shared-types';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { COMPETENCIES } from '../catalog/seed/competencies.seed';
import {
  LlmRateLimitError,
  LlmUnavailableError,
  STRUCTURED_LLM,
  StructuredLlm,
} from '../ai/llm';
import {
  JOB_EXTRACTION_SCHEMA,
  JOB_SYSTEM_PROMPT,
} from './job-extraction.schema';
import { keywordJobDraft, normalizeJobExtraction } from './job-normalize';

/**
 * Lê um anúncio de emprego com a mesma IA que lê os CVs e devolve um rascunho
 * para o formulário da candidatura. Não grava nada e não guarda o texto.
 * Se a IA não responder, a análise segue por palavras-chave.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  /** Uma análise de cada vez por utilizador. */
  private readonly analyzing = new Set<string>();

  constructor(@Inject(STRUCTURED_LLM) private readonly llm: StructuredLlm) {}

  async analyze(userId: string, text: string): Promise<JobPostingDraft> {
    if (this.analyzing.has(userId)) {
      throw new HttpException(
        'Já estou a analisar um anúncio teu. Espera que termine.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.analyzing.add(userId);
    try {
      // Se a IA estiver ocupada (ex.: a recolha de vagas), espera um pouco uma vez.
      return await this.read(text, { maxWaitMs: 20_000, maxRetries: 1 });
    } finally {
      this.analyzing.delete(userId);
    }
  }

  /**
   * Lê um anúncio com a IA; se ela não responder, por palavras-chave.
   * Usado também pela recolha de vagas do ITJobs.
   *
   * Limite por minuto (HTTP 429 com "try again in Xs"): espera o tempo pedido
   * e repete, até maxRetries vezes e se a espera não passar de maxWaitMs.
   */
  async read(
    text: string,
    opts: { maxWaitMs?: number; maxRetries?: number } = {},
  ): Promise<JobPostingDraft> {
    const { maxWaitMs = 0, maxRetries = 0 } = opts;
    for (let attempt = 0; ; attempt++) {
      try {
        const raw = await this.llm.chatJson({
          system: JOB_SYSTEM_PROMPT,
          user: `Anúncio:\n"""\n${text}\n"""`,
          schema: JOB_EXTRACTION_SCHEMA,
          name: 'job_posting',
          what: 'Anúncio',
        });
        return {
          ...normalizeJobExtraction(raw, text, COMPETENCIES),
          analyzedBy: this.llm.label,
          sentToExternalService: this.llm.remote,
        };
      } catch (err) {
        if (!(err instanceof LlmUnavailableError)) throw err;
        const wait = err instanceof LlmRateLimitError ? err.retryAfterMs : null;
        if (wait !== null && wait <= maxWaitMs && attempt < maxRetries) {
          // Meio segundo de folga: o limite reabre exatamente nesse instante.
          this.logger.log(
            `Limite por minuto da IA: a esperar ${((wait + 500) / 1000).toFixed(1)} s.`,
          );
          await sleep(wait + 500);
          continue;
        }
        this.logger.warn(`Anúncio analisado sem IA: ${err.message}`);
        return {
          ...keywordJobDraft(text, COMPETENCIES, err.message),
          sentToExternalService: this.llm.remote,
        };
      }
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
