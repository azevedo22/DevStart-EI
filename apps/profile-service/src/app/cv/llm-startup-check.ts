import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { STRUCTURED_LLM, StructuredLlm } from './llm';

/**
 * No arranque, confirma se a IA que lê os CVs está pronta (ligação, chave,
 * modelo) e diz no terminal. Assim um erro de configuração vê-se logo, e não
 * só ao importar um CV. Não bloqueia o arranque: sem IA, a importação continua
 * a funcionar só com palavras-chave.
 */
@Injectable()
export class LlmStartupCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger('IA');

  constructor(
    @Inject(STRUCTURED_LLM) private readonly llm: StructuredLlm,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    void this.check();
  }

  async check(): Promise<boolean> {
    try {
      await this.llm.checkReady();
      this.logger.log(`IA pronta para ler CVs: ${this.llm.label}.`);
      return true;
    } catch (err) {
      this.logger.warn(
        `IA indisponível (${this.llm.label}): ${(err as Error).message} ` +
          'A importação do CV vai detetar só competências e links.',
      );
      return false;
    }
  }
}
