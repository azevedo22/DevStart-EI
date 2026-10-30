/**
 * Contrato comum aos fornecedores de IA (Ollama local, Groq, xAI) que leem
 * CVs e anúncios de emprego. Os serviços só conhecem isto; o fornecedor
 * escolhe-se com LLM_PROVIDER.
 */

/** A IA não está disponível (desligada, parada, chave inválida, modelo em falta, timeout). */
export class LlmUnavailableError extends Error {}

export interface StructuredChatRequest {
  system: string;
  user: string;
  /** JSON Schema da resposta: o fornecedor obriga o modelo a respeitá-lo. */
  schema: object;
  /** Nome do esquema (a API da OpenAI exige um), ex.: "cv_extraction". */
  name: string;
  /** O que se leu, para os registos: "CV", "anúncio". */
  what: string;
}

export interface StructuredLlm {
  /** Para mostrar ao utilizador quem leu o CV, ex.: "Ollama · qwen2.5:7b". */
  readonly label: string;
  /** true se o CV sai do computador (fornecedor na cloud). */
  readonly remote: boolean;
  /** Nome do fornecedor, ex.: "Groq", "Ollama". */
  readonly provider: string;
  chatJson(req: StructuredChatRequest): Promise<unknown>;
  /** Confirma que a IA está pronta (ligação, chave, modelo) sem enviar dados. */
  checkReady(): Promise<void>;
}

export const STRUCTURED_LLM = Symbol('STRUCTURED_LLM');
