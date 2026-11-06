import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O que cada vaga pede fora do catálogo (ex.: "C/C++"), lido pela IA. Conta
 * como em falta na compatibilidade, para não haver 100% falsos.
 */
export class AddJobOtherSkills1730270000000 implements MigrationInterface {
  name = 'AddJobOtherSkills1730270000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "job_listings" ADD COLUMN "other_skills" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_listings" DROP COLUMN "other_skills"`);
  }
}
