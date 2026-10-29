import type { EventType } from '@devstart/backend-common';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Transactional outbox: o evento é escrito na MESMA transação que a alteração
 * que o originou. Ou ficam os dois, ou nenhum. Um processo à parte (OutboxRelay)
 * publica-o depois no Redis, e volta a tentar enquanto não conseguir.
 *
 * Sem isto, apagar a conta e publicar o evento seriam dois passos: se o Redis
 * falhasse entre um e outro, os dados ficavam para sempre nos outros serviços.
 */
@Entity({ name: 'outbox_events' })
export class OutboxEvent {
  /** O mesmo id do evento publicado: os consumidores podem usá-lo para idempotência. */
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  type!: EventType;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError!: string | null;
}
