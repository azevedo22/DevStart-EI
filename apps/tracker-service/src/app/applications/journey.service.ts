import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { JourneyStats } from '@devstart/shared-types';
import { DataSource, EntityManager } from 'typeorm';

interface JourneyRow {
  applications_sent: number;
  interviews: number;
  first_applied_on: string | null;
  first_yes_on: string | null;
  first_yes_company: string | null;
  yes_applications: number | null;
  yes_interviews: number | null;
  yes_days: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "O teu caminho até ao primeiro sim", uma curiosidade em "A minha conta".
 * Os contadores só aumentam: apagar uma candidatura não muda o que já foi
 * enviado. O primeiro sim (a primeira proposta) fica gravado uma vez; só se
 * anula se o cartão sair de "Proposta" no mesmo dia (engano ao arrastar).
 *
 * A linha de cada pessoa nasce na primeira vez que é precisa, a partir do que
 * já está no quadro, para quem já usava a app antes desta funcionalidade.
 */
@Injectable()
export class JourneyService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Cria a linha a partir do quadro atual, se ainda não existir. Chamar antes de mudar o quadro. */
  async ensure(em: EntityManager, userId: string): Promise<void> {
    // Quase sempre a linha já existe: a consulta de arranque (pesada) só corre uma vez.
    const exists: unknown[] = await em.query(
      `SELECT 1 FROM user_journey WHERE user_id = $1`,
      [userId],
    );
    if (exists.length) return;
    await em.query(
      `INSERT INTO user_journey (user_id, applications_sent, interviews, first_applied_on,
                                 first_yes_on, first_yes_company, first_yes_application_id,
                                 yes_applications, yes_interviews, yes_days)
       SELECT $1,
              (SELECT count(*) FROM applications WHERE user_id = $1 AND status <> 'SAVED'),
              (SELECT count(*) FROM interviews i JOIN applications a ON a.id = i.application_id
                WHERE a.user_id = $1),
              (SELECT min(applied_at) FROM applications WHERE user_id = $1 AND status <> 'SAVED'),
              y.on_day, y.company_name, y.id, y.apps, y.ints, y.days
         FROM (SELECT 1) one
         LEFT JOIN LATERAL (
           -- Quem já tinha uma proposta: o primeiro sim é a mais antiga ida para "Proposta".
           SELECT h.changed_at::date AS on_day, a.company_name, a.id,
                  (SELECT count(*) FROM applications x WHERE x.user_id = $1
                     AND x.status <> 'SAVED' AND x.applied_at <= h.changed_at::date) AS apps,
                  (SELECT count(*) FROM interviews i JOIN applications x ON x.id = i.application_id
                     WHERE x.user_id = $1 AND i.created_at <= h.changed_at) AS ints,
                  h.changed_at::date - (SELECT min(applied_at) FROM applications
                     WHERE user_id = $1 AND status <> 'SAVED')::date AS days
             FROM application_status_history h
             JOIN applications a ON a.id = h.application_id
            WHERE a.user_id = $1 AND h.to_status = 'OFFER'
            ORDER BY h.changed_at
            LIMIT 1
         ) y ON true
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }

  /** Uma candidatura enviada (criada fora de "Por candidatar", ou que saiu de lá). */
  async applied(
    em: EntityManager,
    userId: string,
    appliedOn: string,
  ): Promise<void> {
    await em.query(
      `UPDATE user_journey
          SET applications_sent = applications_sent + 1,
              first_applied_on = LEAST(COALESCE(first_applied_on, $2::date), $2::date)
        WHERE user_id = $1`,
      [userId, appliedOn],
    );
  }

  async interviewRegistered(userId: string): Promise<void> {
    await this.db.transaction(async (em) => {
      await this.ensure(em, userId);
      await em.query(
        `UPDATE user_journey SET interviews = interviews + 1 WHERE user_id = $1`,
        [userId],
      );
    });
  }

  /** Entrou em "Proposta": se for a primeira vez, grava o marco com os números de agora. */
  async offer(
    em: EntityManager,
    userId: string,
    applicationId: string,
    companyName: string,
  ): Promise<void> {
    await em.query(
      `UPDATE user_journey
          SET first_yes_on = $3::date,
              first_yes_company = $4,
              first_yes_application_id = $2,
              yes_applications = applications_sent,
              yes_interviews = interviews,
              yes_days = $3::date - COALESCE(first_applied_on, $3::date)
        WHERE user_id = $1 AND first_yes_on IS NULL`,
      [userId, applicationId, today(), companyName],
    );
  }

  /** Saiu de "Proposta" no mesmo dia em que foi o primeiro sim: foi engano, anula. */
  async leftOffer(
    em: EntityManager,
    userId: string,
    applicationId: string,
  ): Promise<void> {
    await em.query(
      `UPDATE user_journey
          SET first_yes_on = NULL, first_yes_company = NULL,
              first_yes_application_id = NULL, yes_applications = NULL,
              yes_interviews = NULL, yes_days = NULL
        WHERE user_id = $1 AND first_yes_application_id = $2
          AND first_yes_on = $3::date`,
      [userId, applicationId, today()],
    );
  }

  async get(userId: string): Promise<JourneyStats> {
    const [row] = (await this.db.transaction(async (em) => {
      await this.ensure(em, userId);
      return em.query(
        `SELECT applications_sent, interviews, first_applied_on::text AS first_applied_on,
                first_yes_on::text AS first_yes_on, first_yes_company,
                yes_applications, yes_interviews, yes_days
           FROM user_journey WHERE user_id = $1`,
        [userId],
      );
    })) as JourneyRow[];
    return {
      applicationsSent: row.applications_sent,
      interviews: row.interviews,
      firstAppliedOn: row.first_applied_on,
      firstYes: row.first_yes_on
        ? {
            on: row.first_yes_on,
            companyName: row.first_yes_company ?? '',
            applications: row.yes_applications ?? 0,
            interviews: row.yes_interviews ?? 0,
            days: row.yes_days ?? 0,
          }
        : null,
    };
  }

  /** Apagar a conta apaga também o caminho. */
  async removeFor(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM user_journey WHERE user_id = $1`, [
      userId,
    ]);
  }
}
