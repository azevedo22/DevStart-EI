import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vagas recolhidas do ITJobs.pt (partilhadas por todos os utilizadores: a
 * análise de uma vaga é igual para todos) e a última visita de cada
 * utilizador à secção, para saber o que é novo.
 */
export class AddJobBoard1730220000000 implements MigrationInterface {
  name = 'AddJobBoard1730220000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "job_listings" (
        "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "source"                  varchar(16)  NOT NULL,
        "source_id"               varchar(32)  NOT NULL,
        "title"                   varchar(200) NOT NULL,
        "company_name"            varchar(160) NOT NULL,
        "company_logo"            varchar(500) NULL,
        "url"                     varchar(500) NOT NULL,
        "locations"               text[]       NOT NULL DEFAULT '{}',
        "location_ids"            int[]        NOT NULL DEFAULT '{}',
        "work_mode"               varchar(16)  NULL,
        "contract_ids"            int[]        NOT NULL DEFAULT '{}',
        "body"                    text         NOT NULL,
        "summary"                 varchar(400) NOT NULL,
        "published_at"            timestamptz  NOT NULL,
        "seniority"               varchar(16)  NOT NULL,
        "years_required"          smallint     NULL,
        "accessibility"           varchar(16)  NOT NULL,
        "mislabeled_junior"       boolean      NOT NULL DEFAULT false,
        "competency_ids"          text[]       NOT NULL DEFAULT '{}',
        "experience_requirements" text[]       NOT NULL DEFAULT '{}',
        "analysis_source"         varchar(16)  NOT NULL,
        "analyzed_at"             timestamptz  NOT NULL DEFAULT now(),
        "first_seen_at"           timestamptz  NOT NULL DEFAULT now(),
        "last_seen_at"            timestamptz  NOT NULL DEFAULT now(),
        "closed_at"               timestamptz  NULL,
        CONSTRAINT "uq_job_listings_source" UNIQUE ("source", "source_id"),
        CONSTRAINT "ck_job_listings_analysis" CHECK ("analysis_source" IN ('keywords', 'ai'))
      )`);
    await q.query(
      `CREATE INDEX "ix_job_listings_open" ON "job_listings" ("published_at" DESC) WHERE "closed_at" IS NULL`,
    );
    await q.query(`
      CREATE TABLE "job_feed_visits" (
        "user_id"        uuid        PRIMARY KEY,
        "last_visit_at"  timestamptz NOT NULL,
        "query"          jsonb       NOT NULL DEFAULT '{}'
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "job_feed_visits"`);
    await q.query(`DROP TABLE "job_listings"`);
  }
}
