import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ficha alargada: localização e links no perfil, formação, experiência e línguas.
 * Os CHECK repetem as regras dos DTOs, como no resto do esquema.
 */
export class AddBackground1730190000000 implements MigrationInterface {
  name = 'AddBackground1730190000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "location"      varchar(120) NULL,
        ADD COLUMN "linkedin_url"  varchar(300) NULL,
        ADD COLUMN "github_url"    varchar(300) NULL,
        ADD COLUMN "portfolio_url" varchar(300) NULL
    `);
    await q.query(`
      CREATE TABLE "profile_education" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid         NOT NULL,
        "institution"    varchar(160) NOT NULL,
        "degree"         varchar(160) NOT NULL,
        "field_of_study" varchar(120) NULL,
        "start_year"     smallint     NULL,
        "end_year"       smallint     NULL,
        "created_at"     timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "ck_education_years" CHECK ("end_year" IS NULL OR "start_year" IS NULL OR "end_year" >= "start_year")
      )
    `);
    await q.query(
      `CREATE INDEX "ix_profile_education_user" ON "profile_education" ("user_id")`,
    );
    await q.query(`
      CREATE TABLE "profile_experience" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid          NOT NULL,
        "organization" varchar(160)  NOT NULL,
        "role"         varchar(120)  NOT NULL,
        "kind"         varchar(16)   NOT NULL,
        "start_date"   varchar(7)    NULL,
        "end_date"     varchar(7)    NULL,
        "description"  varchar(1500) NULL,
        "created_at"   timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "ck_experience_kind" CHECK ("kind" IN ('JOB', 'INTERNSHIP', 'VOLUNTEER', 'OTHER')),
        CONSTRAINT "ck_experience_start" CHECK ("start_date" IS NULL OR "start_date" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
        CONSTRAINT "ck_experience_end" CHECK ("end_date" IS NULL OR "end_date" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
        -- AAAA-MM compara-se bem como texto.
        CONSTRAINT "ck_experience_dates" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date")
      )
    `);
    await q.query(
      `CREATE INDEX "ix_profile_experience_user" ON "profile_experience" ("user_id")`,
    );
    await q.query(`
      CREATE TABLE "profile_languages" (
        "user_id"  uuid        NOT NULL,
        "language" varchar(40) NOT NULL,
        "level"    varchar(8)  NOT NULL,
        "position" smallint    NOT NULL DEFAULT 0,
        PRIMARY KEY ("user_id", "language"),
        CONSTRAINT "ck_language_level" CHECK ("level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'))
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "profile_languages"`);
    await q.query(`DROP TABLE "profile_experience"`);
    await q.query(`DROP TABLE "profile_education"`);
    await q.query(`
      ALTER TABLE "profiles"
        DROP COLUMN "location",
        DROP COLUMN "linkedin_url",
        DROP COLUMN "github_url",
        DROP COLUMN "portfolio_url"
    `);
  }
}
