import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial do Application Tracker Service.
 * user_id é uma referência lógica ao Auth Service (bases de dados separadas).
 */
export class CreateTrackerTables1730160000000 implements MigrationInterface {
  name = 'CreateTrackerTables1730160000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "applications" (
        "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"                 uuid          NOT NULL,
        "company_name"            varchar(120)  NOT NULL,
        "job_title"               varchar(150)  NOT NULL,
        "job_url"                 varchar(500)  NULL,
        "location"                varchar(120)  NULL,
        "work_mode"               varchar(16)   NOT NULL,
        "status"                  varchar(24)   NOT NULL,
        "position"                int           NOT NULL,
        "required_competency_ids" text[]        NOT NULL DEFAULT '{}',
        "years_required"          smallint      NULL,
        "seniority"               varchar(16)   NOT NULL,
        "accessibility"           varchar(16)   NOT NULL,
        "mislabeled_junior"       boolean       NOT NULL DEFAULT false,
        "applied_at"              date          NOT NULL,
        "notes"                   varchar(4000) NULL,
        "created_at"              timestamptz   NOT NULL DEFAULT now(),
        "updated_at"              timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "ck_applications_status" CHECK ("status" IN
          ('APPLIED', 'TECHNICAL_TEST', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'REJECTED')),
        CONSTRAINT "ck_applications_work_mode" CHECK ("work_mode" IN ('ONSITE', 'HYBRID', 'REMOTE')),
        CONSTRAINT "ck_applications_position" CHECK ("position" >= 0),
        CONSTRAINT "ck_applications_years" CHECK ("years_required" IS NULL OR "years_required" BETWEEN 0 AND 30)
      )
    `);
    // O quadro lê sempre "candidaturas deste utilizador, por coluna, por ordem".
    await q.query(
      `CREATE INDEX "ix_applications_board" ON "applications" ("user_id", "status", "position")`,
    );

    await q.query(`
      CREATE TABLE "application_status_history" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "application_id" uuid        NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "from_status"    varchar(24) NULL,
        "to_status"      varchar(24) NOT NULL,
        "changed_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX "ix_status_history_application" ON "application_status_history" ("application_id", "changed_at")`,
    );

    await q.query(`
      CREATE TABLE "interviews" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "application_id"  uuid          NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "type"            varchar(16)   NOT NULL,
        "scheduled_at"    timestamptz   NULL,
        "completed"       boolean       NOT NULL DEFAULT false,
        "rating"          smallint      NULL,
        "outcome"         varchar(16)   NOT NULL DEFAULT 'PENDING',
        "questions_asked" text[]        NOT NULL DEFAULT '{}',
        "strengths"       varchar(2000) NULL,
        "improvements"    varchar(2000) NULL,
        "created_at"      timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "ck_interviews_type" CHECK ("type" IN ('HR', 'TECHNICAL', 'TEST')),
        CONSTRAINT "ck_interviews_outcome" CHECK ("outcome" IN ('PASSED', 'FAILED', 'PENDING')),
        CONSTRAINT "ck_interviews_rating" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5)
      )
    `);
    await q.query(
      `CREATE INDEX "ix_interviews_application" ON "interviews" ("application_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "interviews"`);
    await q.query(`DROP TABLE "application_status_history"`);
    await q.query(`DROP TABLE "applications"`);
  }
}
