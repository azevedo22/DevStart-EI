import { MigrationInterface, QueryRunner } from 'typeorm';

/** Contas de demonstração: data a partir da qual a conta é apagada automaticamente. */
export class AddDemoAccounts1730180000000 implements MigrationInterface {
  name = 'AddDemoAccounts1730180000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN "demo_expires_at" timestamptz NULL`,
    );
    // A limpeza e o limite de contas ativas só olham para contas de demonstração.
    await q.query(
      `CREATE INDEX "ix_users_demo_expires_at" ON "users" ("demo_expires_at") WHERE "demo_expires_at" IS NOT NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "ix_users_demo_expires_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "demo_expires_at"`);
  }
}
