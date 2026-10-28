import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial do Auth Service.
 * As migrações são escritas à mão e versionadas: o esquema nunca é
 * alterado automaticamente em produção (synchronize está desligado).
 */
export class CreateAuthTables1730140000000 implements MigrationInterface {
  name = 'CreateAuthTables1730140000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await q.query(`
      CREATE TABLE "users" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"         varchar(254) NOT NULL,
        "password_hash" varchar(72)  NOT NULL,
        "full_name"     varchar(120) NOT NULL,
        "role"          varchar(16)  NOT NULL DEFAULT 'GRADUATE',
        "created_at"    timestamptz  NOT NULL DEFAULT now(),
        "updated_at"    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "ck_users_role" CHECK ("role" IN ('GRADUATE', 'ADMIN'))
      )
    `);
    await q.query(`
      CREATE TABLE "refresh_tokens" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "family_id"  uuid        NOT NULL,
        "token_hash" char(64)    NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX "ix_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await q.query(
      `CREATE INDEX "ix_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "refresh_tokens"`);
    await q.query(`DROP TABLE "users"`);
  }
}
