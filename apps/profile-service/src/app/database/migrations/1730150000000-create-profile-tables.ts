import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial do Profile & Skill Service.
 * user_id é uma referência lógica ao Auth Service (bases de dados separadas, sem FK entre serviços).
 * Os CHECK repetem na base de dados as regras dos DTOs: se alguém escrever por fora da API,
 * os dados continuam válidos.
 */
export class CreateProfileTables1730150000000 implements MigrationInterface {
  name = 'CreateProfileTables1730150000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "profiles" (
        "user_id"         uuid PRIMARY KEY,
        "headline"        varchar(120)  NULL,
        "university"      varchar(120)  NULL,
        "graduation_year" smallint      NULL,
        "bio"             varchar(1000) NULL,
        "updated_at"      timestamptz   NOT NULL DEFAULT now()
      )
    `);
    await q.query(`
      CREATE TABLE "profile_competencies" (
        "user_id"       uuid        NOT NULL,
        "competency_id" varchar(64) NOT NULL,
        "level"         varchar(16) NOT NULL,
        "declared_at"   timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "competency_id"),
        CONSTRAINT "ck_profile_competencies_level" CHECK ("level" IN ('BASIC', 'INTERMEDIATE', 'ADVANCED'))
      )
    `);
    await q.query(`
      CREATE TABLE "projects" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"          uuid          NOT NULL,
        "title"            varchar(100)  NOT NULL,
        "description"      varchar(2000) NOT NULL,
        "repository_url"   varchar(300)  NULL,
        "live_url"         varchar(300)  NULL,
        "origin"           varchar(16)   NOT NULL,
        "academic_context" varchar(160)  NULL,
        "practices"        text[]        NOT NULL DEFAULT '{}',
        "created_at"       timestamptz   NOT NULL DEFAULT now(),
        "updated_at"       timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "ck_projects_origin" CHECK ("origin" IN ('ACADEMIC', 'PERSONAL', 'PROFESSIONAL'))
      )
    `);
    await q.query(
      `CREATE INDEX "ix_projects_user_id" ON "projects" ("user_id")`,
    );
    await q.query(`
      CREATE TABLE "project_competencies" (
        "project_id"    uuid        NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "competency_id" varchar(64) NOT NULL,
        PRIMARY KEY ("project_id", "competency_id")
      )
    `);
    await q.query(
      `CREATE INDEX "ix_project_competencies_competency" ON "project_competencies" ("competency_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "project_competencies"`);
    await q.query(`DROP TABLE "projects"`);
    await q.query(`DROP TABLE "profile_competencies"`);
    await q.query(`DROP TABLE "profiles"`);
  }
}
