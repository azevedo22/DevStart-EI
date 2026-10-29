import type Redis from 'ioredis';
import {
  DEAD_LETTER_STREAM,
  DomainEvent,
  EVENTS_STREAM,
  EventHandlers,
  EventType,
} from './events.types';

export interface ConsumerLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface EventConsumerOptions {
  /** Ligação dedicada: XREADGROUP com BLOCK ocupa a ligação enquanto espera. */
  redis: Redis;
  /** Um grupo por serviço: cada serviço recebe todos os eventos uma vez. */
  group: string;
  /** Nome desta instância dentro do grupo (várias instâncias dividem o trabalho). */
  consumer: string;
  handlers: EventHandlers;
  logger: ConsumerLogger;
  /** Ao fim de quantas entregas falhadas um evento vai para a dead-letter. */
  maxDeliveries?: number;
  /** Tempo sem confirmação após o qual um evento é tentado de novo. */
  retryAfterMs?: number;
  blockMs?: number;
}

type StreamEntry = [id: string, fields: string[]];

/**
 * Consumidor de Redis Streams com consumer groups:
 *
 * - Entrega pelo menos uma vez: um evento só sai da lista de pendentes com XACK,
 *   depois de o handler terminar. Se o serviço cair a meio, o evento volta a ser entregue.
 * - Por isso os handlers têm de ser idempotentes (apagar duas vezes = apagar uma).
 * - Um evento que falha `maxDeliveries` vezes vai para a dead-letter e é confirmado,
 *   para não bloquear para sempre os que vêm a seguir.
 */
export class EventConsumer {
  private running = false;
  private loop: Promise<void> | null = null;
  private readonly maxDeliveries: number;
  private readonly retryAfterMs: number;
  private readonly blockMs: number;

  constructor(private readonly opts: EventConsumerOptions) {
    this.maxDeliveries = opts.maxDeliveries ?? 5;
    this.retryAfterMs = opts.retryAfterMs ?? 30_000;
    this.blockMs = opts.blockMs ?? 5_000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.run();
  }

  async stop(): Promise<void> {
    this.running = false;
    // Desliga a ligação para interromper um XREADGROUP bloqueado.
    this.opts.redis.disconnect();
    await this.loop?.catch(() => undefined);
  }

  /** Uma iteração completa: repete os que estavam pendentes e lê os novos. Usado nos testes. */
  async processOnce(blockMs = 100): Promise<number> {
    await this.ensureGroup();
    let processed = 0;
    for (const entry of await this.claimStale())
      processed += await this.handle(entry);
    for (const entry of await this.readNew(blockMs))
      processed += await this.handle(entry);
    return processed;
  }

  private async run(): Promise<void> {
    let backoff = 1_000;
    while (this.running) {
      try {
        await this.processOnce(this.blockMs);
        backoff = 1_000;
      } catch (err) {
        if (!this.running) break;
        this.opts.logger.warn(
          `Erro a ler eventos (${(err as Error).message}); nova tentativa em ${backoff / 1000}s.`,
        );
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30_000);
      }
    }
  }

  private async ensureGroup(): Promise<void> {
    try {
      // '0': um serviço novo processa também os eventos que já estavam no stream.
      await this.opts.redis.xgroup(
        'CREATE',
        EVENTS_STREAM,
        this.opts.group,
        '0',
        'MKSTREAM',
      );
    } catch (err) {
      if (!String((err as Error).message).includes('BUSYGROUP')) throw err;
    }
  }

  private async readNew(blockMs: number): Promise<StreamEntry[]> {
    const res = (await this.opts.redis.xreadgroup(
      'GROUP',
      this.opts.group,
      this.opts.consumer,
      'COUNT',
      20,
      'BLOCK',
      blockMs,
      'STREAMS',
      EVENTS_STREAM,
      '>',
    )) as [string, StreamEntry[]][] | null;
    return res?.[0]?.[1] ?? [];
  }

  /** Eventos entregues há mais de `retryAfterMs` sem confirmação (handler falhou ou instância caiu). */
  private async claimStale(): Promise<StreamEntry[]> {
    const res = (await this.opts.redis.xautoclaim(
      EVENTS_STREAM,
      this.opts.group,
      this.opts.consumer,
      this.retryAfterMs,
      '0-0',
      'COUNT',
      20,
    )) as [string, StreamEntry[]];
    // Entradas já apagadas do stream (MAXLEN) vêm como null.
    return (res?.[1] ?? []).filter((e) => e && e[1]);
  }

  private async handle([entryId, fields]: StreamEntry): Promise<number> {
    const event = parse(fields);
    const handler = event
      ? (this.opts.handlers[event.type] as
          ((e: DomainEvent) => Promise<void>) | undefined)
      : undefined;

    // Evento malformado ou que este serviço não trata: confirma e segue.
    if (!event || !handler) {
      await this.ack(entryId);
      return 0;
    }

    try {
      await handler(event);
      await this.ack(entryId);
      return 1;
    } catch (err) {
      const deliveries = await this.deliveryCount(entryId);
      const reason = (err as Error).message;
      if (deliveries >= this.maxDeliveries) {
        this.opts.logger.error(
          `Evento ${event.type} (${event.id}) falhou ${deliveries} vezes; enviado para a dead-letter: ${reason}`,
        );
        await this.opts.redis.xadd(
          DEAD_LETTER_STREAM,
          '*',
          ...fields,
          'group',
          this.opts.group,
          'error',
          reason,
          'entryId',
          entryId,
        );
        await this.ack(entryId);
      } else {
        this.opts.logger.warn(
          `Evento ${event.type} (${event.id}) falhou (tentativa ${deliveries}); será repetido: ${reason}`,
        );
      }
      return 0;
    }
  }

  private async deliveryCount(entryId: string): Promise<number> {
    const res = (await this.opts.redis.xpending(
      EVENTS_STREAM,
      this.opts.group,
      entryId,
      entryId,
      1,
    )) as [string, string, number, number][];
    return res?.[0]?.[3] ?? 1;
  }

  private ack(entryId: string): Promise<number> {
    return this.opts.redis.xack(EVENTS_STREAM, this.opts.group, entryId);
  }
}

function parse(fields: string[]): DomainEvent | null {
  const map = new Map<string, string>();
  for (let i = 0; i < fields.length; i += 2) map.set(fields[i], fields[i + 1]);
  const id = map.get('id');
  const type = map.get('type') as EventType | undefined;
  const occurredAt = map.get('occurredAt');
  const payload = map.get('payload');
  if (!id || !type || !occurredAt || !payload) return null;
  try {
    return { id, type, occurredAt, payload: JSON.parse(payload) };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
