import { MigrationInterface, QueryRunner } from 'typeorm';

/** Que experiência a vaga pede, por palavras do anúncio (preenchido pela análise com IA). */
export class AddExperienceRequirements1730200000000 implements MigrationInterface {
  name = 'AddExperienceRequirements1730200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications"
         ADD COLUMN "experience_requirements" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications" DROP COLUMN "experience_requirements"`,
    );
  }
}
