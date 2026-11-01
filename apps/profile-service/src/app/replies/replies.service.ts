import { ReplyDraft } from '@devstart/shared-types';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiQuota } from '../ai/ai-quota';
import { LlmUnavailableError, STRUCTURED_LLM, StructuredLlm } from '../ai/llm';
import { AnalyzeReplyDto } from './dto/analyze-reply.dto';
import {
  REPLY_EXTRACTION_SCHEMA,
  REPLY_SYSTEM_PROMPT,
  replyUserMessage,
} from './reply-extraction.schema';
import { keywordReply, normalizeReply } from './reply-normalize';

/**
 * Lê a resposta de uma empresa (o email colado pela pessoa) e devolve o que
 * mudar no quadro. Não grava nada e não guarda o texto: o frontend mostra a
 * proposta e só a aplica quando a pessoa confirma.
 */
@Injectable()
export class RepliesService {
  private readonly logger = new Logger(RepliesService.name);
  /** Uma análise de cada vez por utilizador. */
  private readonly analyzing = new Set<string>();

  constructor(
    @Inject(STRUCTURED_LLM) private readonly llm: StructuredLlm,
    private readonly quota: AiQuota,
  ) {}

  async analyze(userId: string, dto: AnalyzeReplyDto): Promise<ReplyDraft> {
    if (this.analyzing.has(userId)) {
      throw new HttpException(
        'Já estou a analisar uma resposta tua. Espera que termine.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.quota.consume(userId);
    this.analyzing.add(userId);
    try {
      const { text, candidates, today } = dto;
      try {
        const raw = await this.llm.chatJson({
          system: REPLY_SYSTEM_PROMPT,
          user: replyUserMessage(text, candidates, today),
          schema: REPLY_EXTRACTION_SCHEMA,
          name: 'company_reply',
          what: 'Resposta',
        });
        return {
          source: 'ai',
          analyzedBy: this.llm.label,
          sentToExternalService: this.llm.remote,
          ...normalizeReply(raw, text, candidates, today),
        };
      } catch (err) {
        if (!(err instanceof LlmUnavailableError)) throw err;
        this.logger.warn(`Resposta analisada sem IA: ${err.message}`);
        return {
          source: 'keywords',
          analyzedBy: null,
          sentToExternalService: this.llm.remote,
          ...keywordReply(text, candidates, today, err.message),
        };
      }
    } finally {
      this.analyzing.delete(userId);
    }
  }
}
