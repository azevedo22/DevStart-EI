import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Candidaturas espontâneas: o CV enviado a uma empresa sem vaga aberta.
 * Guardam por onde foram enviadas, a quem, e os dias em que foram reenviadas.
 */
export class AddSpontaneous1730290000000 implements MigrationInterface {
  name = 'AddSpontaneous1730290000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "applications"
        ADD COLUMN "kind" varchar(12) NOT NULL DEFAULT 'JOB',
        ADD COLUMN "channel" varchar(12) NULL,
        ADD COLUMN "contact" varchar(200) NULL,
        ADD COLUMN "resent_on" text[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT "ck_applications_kind" CHECK ("kind" IN ('JOB', 'SPONTANEOUS')),
        ADD CONSTRAINT "ck_applications_channel" CHECK (
          "channel" IS NULL OR "channel" IN ('EMAIL', 'LINKEDIN', 'WEBSITE', 'IN_PERSON'))
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "applications"
        DROP CONSTRAINT "ck_applications_channel",
        DROP CONSTRAINT "ck_applications_kind",
        DROP COLUMN "resent_on",
        DROP COLUMN "contact",
        DROP COLUMN "channel",
        DROP COLUMN "kind"
    `);
  }
}
