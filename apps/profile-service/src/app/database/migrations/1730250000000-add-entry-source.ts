import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * De onde veio cada entrada de formação, experiência e projeto: 'cv' (de uma
 * importação, ainda não editada) ou 'manual'. Importar um CV novo substitui só
 * as 'cv'. O que já existe fica 'manual': não se sabe de onde veio, e é mais
 * seguro não o deixar ser substituído.
 */
const TABLES = ['profile_education', 'profile_experience', 'projects'];

export class AddEntrySource1730250000000 implements MigrationInterface {
  name = 'AddEntrySource1730250000000';

  async up(q: QueryRunner): Promise<void> {
    for (const t of TABLES) {
      await q.query(`
        ALTER TABLE "${t}"
          ADD COLUMN "source" varchar(8) NOT NULL DEFAULT 'manual',
          ADD CONSTRAINT "ck_${t}_source" CHECK ("source" IN ('cv', 'manual'))`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of TABLES) {
      await q.query(
        `ALTER TABLE "${t}" DROP CONSTRAINT "ck_${t}_source", DROP COLUMN "source"`,
      );
    }
  }
}
