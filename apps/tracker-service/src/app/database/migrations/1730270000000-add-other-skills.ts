import { MigrationInterface, QueryRunner } from 'typeorm';

/** Competências que a vaga pede e não existem no catálogo (preenchido pela análise com IA). */
export class AddOtherSkills1730270000000 implements MigrationInterface {
  name = 'AddOtherSkills1730270000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications"
         ADD COLUMN "other_skills" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "applications" DROP COLUMN "other_skills"`);
  }
}
