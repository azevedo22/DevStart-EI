import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import {
  DomainEvent,
  EVENTS_STREAM,
  EventPayloads,
  EventType,
} from './events.types';

/** Limite aproximado do stream: os eventos antigos (já consumidos) são descartados. */
const MAX_STREAM_LENGTH = 10_000;

export function createEvent<T extends EventType>(
  type: T,
  payload: EventPayloads[T],
  id = randomUUID(),
): DomainEvent<T> {
  return { id, type, occurredAt: new Date().toISOString(), payload };
}

/**
 * Publica eventos no stream. Para eventos que nascem de uma escrita na base de
 * dados, não se chama diretamente: usa-se o outbox, para o evento nunca se perder
 * se o Redis estiver em baixo no momento da escrita.
 */
export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(event: DomainEvent): Promise<string> {
    const entryId = await this.redis.xadd(
      EVENTS_STREAM,
      'MAXLEN',
      '~',
      MAX_STREAM_LENGTH,
      '*',
      'id',
      event.id,
      'type',
      event.type,
      'occurredAt',
      event.occurredAt,
      'payload',
      JSON.stringify(event.payload),
    );
    return entryId as string;
  }
}
