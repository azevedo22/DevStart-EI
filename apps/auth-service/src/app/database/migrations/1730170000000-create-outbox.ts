import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tabela do transactional outbox (ver OutboxEvent). */
export class CreateOutbox1730170000000 implements MigrationInterface {
  name = 'CreateOutbox1730170000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "outbox_events" (
        "id"           uuid PRIMARY KEY,
        "type"         varchar(64)  NOT NULL,
        "payload"      jsonb        NOT NULL,
        "occurred_at"  timestamptz  NOT NULL DEFAULT now(),
        "published_at" timestamptz  NULL,
        "attempts"     int          NOT NULL DEFAULT 0,
        "last_error"   varchar(500) NULL
      )
    `);
    // O relay só procura eventos por publicar: um índice parcial mantém essa leitura barata.
    await q.query(
      `CREATE INDEX "ix_outbox_unpublished" ON "outbox_events" ("occurred_at") WHERE "published_at" IS NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "outbox_events"`);
  }
}
