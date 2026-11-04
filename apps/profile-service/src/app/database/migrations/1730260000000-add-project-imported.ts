import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projetos que entraram por uma importação do CV. Ao contrário de "source"
 * (que passa a 'manual' quando a pessoa edita), isto não muda: um projeto
 * importado já existia antes, por isso a sua criação não conta como atividade
 * da semana. Editá-lo depois conta, como qualquer atualização.
 */
export class AddProjectImported1730260000000 implements MigrationInterface {
  name = 'AddProjectImported1730260000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN "imported" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `UPDATE "projects" SET "imported" = true WHERE "source" = 'cv'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "projects" DROP COLUMN "imported"`);
  }
}
