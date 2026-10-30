import {
  ActivityEvent,
  ActivityKind,
  ActivityRange,
  ApplicationStatus,
  InterviewType,
} from '@devstart/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface Row {
  date: string;
  kind: ActivityKind;
  subject: string;
  job_title: string | null;
  status: ApplicationStatus | null;
  interview_type: InterviewType | null;
  round: number | null;
  at: Date | null;
}

/**
 * Atividade por dia para o relatório semanal: candidaturas enviadas, respostas
 * (mudanças de coluna no Kanban) e entrevistas. As datas vêm no fuso do
 * utilizador ($4), calculadas no PostgreSQL com AT TIME ZONE: uma resposta às
 * 23h30 em Lisboa conta nesse dia, mesmo que em UTC já seja o seguinte.
 *
 * Respostas: só os movimentos que contam como notícia. Sair de "Candidatado"
 * para uma fase de entrevista, ou passar de uma fase para outra, é positivo;
 * entrar em "Proposta" ou "Rejeitado" é proposta ou rejeição. Voltar a
 * "Candidatado" (correção de um engano) não conta.
 */
const ACTIVITY_SQL = `
  WITH iv AS (
    SELECT i.application_id, i.type, i.scheduled_at, a.company_name, a.job_title,
           row_number() OVER (
             PARTITION BY i.application_id
             ORDER BY coalesce(i.scheduled_at, i.created_at), i.created_at
           )::int AS round,
           (coalesce(i.scheduled_at, i.created_at) AT TIME ZONE $4)::date AS day,
           (i.created_at AT TIME ZONE $4)::date AS created_day
      FROM interviews i
      JOIN applications a ON a.id = i.application_id
     WHERE a.user_id = $1
  )
  SELECT a.applied_at::text AS date, 'APPLIED' AS kind, a.company_name AS subject,
         a.job_title, NULL AS status, NULL AS interview_type, NULL::int AS round,
         NULL::timestamptz AS at
    FROM applications a
   WHERE a.user_id = $1 AND a.applied_at BETWEEN $2::date AND $3::date

  UNION ALL
  SELECT (h.changed_at AT TIME ZONE $4)::date::text,
         CASE h.to_status WHEN 'OFFER' THEN 'OFFER'
                          WHEN 'REJECTED' THEN 'REJECTED'
                          ELSE 'RESPONSE_POSITIVE' END,
         a.company_name, a.job_title, h.to_status, NULL, NULL, NULL
    FROM application_status_history h
    JOIN applications a ON a.id = h.application_id
   WHERE a.user_id = $1
     AND h.from_status IS NOT NULL
     AND h.from_status <> h.to_status
     AND (
           h.to_status IN ('OFFER', 'REJECTED')
        OR (h.to_status IN ('TECHNICAL_TEST', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW')
            AND h.from_status NOT IN ('OFFER', 'REJECTED'))
         )
     AND (h.changed_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date

  UNION ALL
  SELECT day::text, 'INTERVIEW', company_name, job_title, NULL, type, round, scheduled_at
    FROM iv
   WHERE day BETWEEN $2::date AND $3::date

  UNION ALL
  -- Registada antes do dia: "vou ter uma entrevista".
  SELECT created_day::text, 'INTERVIEW_SCHEDULED', company_name, job_title, NULL,
         type, round, scheduled_at
    FROM iv
   WHERE scheduled_at IS NOT NULL AND day > created_day
     AND created_day BETWEEN $2::date AND $3::date

  ORDER BY 1, 2, 3
`;

@Injectable()
export class ActivityService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async activity(
    userId: string,
    range: ActivityRange,
  ): Promise<ActivityEvent[]> {
    const rows: Row[] = await this.db.query(ACTIVITY_SQL, [
      userId,
      range.from,
      range.to,
      range.tz,
    ]);
    return rows.map((r) => {
      const e: ActivityEvent = {
        date: r.date,
        kind: r.kind,
        subject: r.subject,
        jobTitle: r.job_title,
      };
      if (r.status) e.status = r.status;
      if (r.interview_type) e.interviewType = r.interview_type;
      if (r.round) e.round = r.round;
      if (r.interview_type) e.at = r.at ? new Date(r.at).toISOString() : null;
      return e;
    });
  }
}
