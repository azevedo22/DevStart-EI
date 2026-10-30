import { JobPostingDraft } from '@devstart/shared-types';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { COMPETENCIES } from '../catalog/seed/competencies.seed';
import { LlmUnavailableError, STRUCTURED_LLM, StructuredLlm } from '../cv/llm';
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
      this.logger.warn(`Anúncio analisado sem IA: ${err.message}`);
      return {
        ...keywordJobDraft(text, COMPETENCIES, err.message),
        sentToExternalService: this.llm.remote,
      };
    } finally {
      this.analyzing.delete(userId);
    }
  }
}
