/**
 * Contratos dos eventos entre serviços.
 *
 * Um evento descreve algo que JÁ aconteceu ("user.deleted"), nunca uma ordem.
 * Quem publica não sabe quem ouve: o Auth Service não conhece o Tracker.
 */

/** Stream único para todos os eventos de domínio; cada serviço lê com o seu consumer group. */
export const EVENTS_STREAM = 'devstart:events';

/** Eventos que falharam demasiadas vezes ficam aqui para análise, sem bloquear os seguintes. */
export const DEAD_LETTER_STREAM = 'devstart:events:dead-letter';

export interface EventPayloads {
  /** A conta foi apagada: cada serviço apaga os dados desse utilizador (direito ao apagamento, RGPD). */
  'user.deleted': { userId: string };
  /**
   * Foi criada uma conta de demonstração: cada serviço preenche-a com os seus
   * dados de exemplo. Quando a conta expira, segue-se um user.deleted normal.
   */
  'user.demo-created': { userId: string };
}

export type EventType = keyof EventPayloads;

export interface DomainEvent<T extends EventType = EventType> {
  /** Id único do evento (uuid), útil para idempotência e rastreio. */
  id: string;
  type: T;
  occurredAt: string; // ISO 8601
  payload: EventPayloads[T];
}

export type EventHandlers = {
  [T in EventType]?: (event: DomainEvent<T>) => Promise<void>;
};
