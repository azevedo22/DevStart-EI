import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nova coluna do Kanban: "Sem resposta" (a empresa nunca respondeu). Não é uma
 * rejeição: fica de fora das rejeições do relatório e da taxa de resposta.
 */
export class AddNoResponseStatus1730240000000 implements MigrationInterface {
  name = 'AddNoResponseStatus1730240000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "ck_applications_status"`,
    );
    await q.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "ck_applications_status" CHECK ("status" IN
         ('SAVED', 'APPLIED', 'TECHNICAL_TEST', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'REJECTED', 'NO_RESPONSE'))`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // As sem resposta voltam a "Candidatado", no fim da coluna.
    await q.query(
      `UPDATE "applications" a SET "status" = 'APPLIED',
              "position" = (SELECT count(*) FROM "applications" b
                             WHERE b.user_id = a.user_id AND b.status = 'APPLIED') + a.position
        WHERE a.status = 'NO_RESPONSE'`,
    );
    await q.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "ck_applications_status"`,
    );
    await q.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "ck_applications_status" CHECK ("status" IN
         ('SAVED', 'APPLIED', 'TECHNICAL_TEST', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'REJECTED'))`,
    );
  }
}
