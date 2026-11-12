import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versão da leitura da IA em cada vaga. Quando as instruções ou as regras da
 * leitura mudam, a versão sobe e as vagas antigas podem ser relidas aos poucos
 * (JOB_SYNC_REANALYZE_PER_RUN). As vagas já lidas pela IA ficam na versão 1.
 */
export class AddJobAnalysisVersion1730280000000 implements MigrationInterface {
  name = 'AddJobAnalysisVersion1730280000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "job_listings" ADD COLUMN "analysis_version" smallint NOT NULL DEFAULT 0`,
    );
    await q.query(
      `UPDATE "job_listings" SET "analysis_version" = 1 WHERE "analysis_source" = 'ai'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_listings" DROP COLUMN "analysis_version"`);
  }
}
