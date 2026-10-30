/**
 * Contrato comum aos fornecedores de IA que leem CVs (Ollama local, xAI...).
 * O CvService só conhece isto; o fornecedor escolhe-se com LLM_PROVIDER.
 */

/** A IA não está disponível (desligada, parada, chave inválida, modelo em falta, timeout). */
export class LlmUnavailableError extends Error {}

export interface StructuredChatRequest {
  system: string;
  user: string;
  /** JSON Schema da resposta: o fornecedor obriga o modelo a respeitá-lo. */
  schema: object;
}

export interface StructuredLlm {
  /** Para mostrar ao utilizador quem leu o CV, ex.: "Ollama · qwen2.5:7b". */
  readonly label: string;
  /** true se o CV sai do computador (fornecedor na cloud). */
  readonly remote: boolean;
  chatJson(req: StructuredChatRequest): Promise<unknown>;
  /** Confirma que a IA está pronta (ligação, chave, modelo) sem enviar dados. */
  checkReady(): Promise<void>;
}

export const STRUCTURED_LLM = Symbol('STRUCTURED_LLM');
