import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "O teu caminho até ao primeiro sim": contadores que só aumentam (apagar uma
 * candidatura não os baixa) e o marco do primeiro sim, gravado uma vez.
 * Uma linha por utilizador, criada na primeira vez que é precisa.
 */
export class AddUserJourney1730300000000 implements MigrationInterface {
  name = 'AddUserJourney1730300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "user_journey" (
        "user_id" uuid PRIMARY KEY,
        "applications_sent" integer NOT NULL DEFAULT 0,
        "interviews" integer NOT NULL DEFAULT 0,
        "first_applied_on" date NULL,
        "first_yes_on" date NULL,
        "first_yes_company" varchar(120) NULL,
        "first_yes_application_id" uuid NULL,
        "yes_applications" integer NULL,
        "yes_interviews" integer NULL,
        "yes_days" integer NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "user_journey"`);
  }
}
