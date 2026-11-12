import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O texto do anúncio analisado com IA. Serve para voltar a medir a leitura da
 * IA mais tarde (casos de avaliação); as candidaturas antigas ficam a null.
 */
export class AddPostingText1730280000000 implements MigrationInterface {
  name = 'AddPostingText1730280000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications" ADD COLUMN "posting_text" text NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "applications" DROP COLUMN "posting_text"`);
  }
}
