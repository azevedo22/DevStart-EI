import { MigrationInterface, QueryRunner } from 'typeorm';

/** Nova coluna do Kanban: "Por candidatar" (vagas guardadas para depois). */
export class AddSavedStatus1730210000000 implements MigrationInterface {
  name = 'AddSavedStatus1730210000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "ck_applications_status"`,
    );
    await q.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "ck_applications_status" CHECK ("status" IN
         ('SAVED', 'APPLIED', 'TECHNICAL_TEST', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'REJECTED'))`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // As guardadas voltam a "Candidatado", no fim da coluna.
    await q.query(
      `UPDATE "applications" a SET "status" = 'APPLIED',
              "position" = (SELECT count(*) FROM "applications" b
                             WHERE b.user_id = a.user_id AND b.status = 'APPLIED') + a.position
        WHERE a.status = 'SAVED'`,
    );
    await q.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "ck_applications_status"`,
    );
    await q.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "ck_applications_status" CHECK ("status" IN
         ('APPLIED', 'TECHNICAL_TEST', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'REJECTED'))`,
    );
  }
}
