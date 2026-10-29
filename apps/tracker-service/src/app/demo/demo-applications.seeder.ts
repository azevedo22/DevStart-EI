import { ApplicationStatus } from '@devstart/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ApplicationEntity,
  InterviewEntity,
  StatusHistoryEntity,
} from '../applications/application.entities';
import { toApplicationFields } from '../applications/applications.service';
import { toInterviewFields } from '../interviews/interviews.service';
import { DEMO_APPLICATIONS } from './demo-applications.data';

const DAY = 86_400_000;

/**
 * Preenche uma conta de demonstração com candidaturas de exemplo.
 *
 * Tudo numa transação: o visitante vê o quadro completo ou vazio, nunca a meio.
 * Os campos passam pelas mesmas funções que a API usa (a acessibilidade é
 * calculada, não escrita à mão). Cada candidatura fica com o histórico de
 * colunas por onde passou, com datas entre a candidatura e hoje.
 */
@Injectable()
export class DemoApplicationsSeeder {
  private readonly logger = new Logger(DemoApplicationsSeeder.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Idempotente: se o utilizador já tem candidaturas, o evento já foi tratado. */
  async seed(userId: string, today = new Date()): Promise<void> {
    const seeded = await this.db.transaction(async (em) => {
      // O mesmo bloqueio por utilizador que as escritas no Kanban usam.
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
      if (await em.existsBy(ApplicationEntity, { userId })) return false;

      const nextPosition = new Map<ApplicationStatus, number>();
      // Das mais recentes para as mais antigas: as mais recentes ficam no topo.
      const ordered = [...DEMO_APPLICATIONS].sort(
        (a, b) => a.daysAgo - b.daysAgo,
      );

      for (const demo of ordered) {
        const appliedAt = new Date(today.getTime() - demo.daysAgo * DAY);
        const steps: ApplicationStatus[] = ['APPLIED', ...demo.path];
        const status = steps[steps.length - 1];
        const position = nextPosition.get(status) ?? 0;
        nextPosition.set(status, position + 1);

        const app = await em.save(
          em.create(ApplicationEntity, {
            userId,
            ...toApplicationFields({
              ...demo.application,
              appliedAt: appliedAt.toISOString().slice(0, 10),
            }),
            status,
            position,
          }),
        );

        await em.insert(
          StatusHistoryEntity,
          steps.map((to, i) => {
            const at = new Date(
              appliedAt.getTime() +
                ((today.getTime() - appliedAt.getTime()) * i) / steps.length,
            );
            at.setUTCHours(9 + i, 0, 0, 0);
            return {
              applicationId: app.id,
              fromStatus: i === 0 ? null : steps[i - 1],
              toStatus: to,
              changedAt: at,
            };
          }),
        );

        for (const { inDays, ...interview } of demo.interviews) {
          const at = new Date(today.getTime() + inDays * DAY);
          at.setUTCHours(10, 0, 0, 0);
          await em.insert(InterviewEntity, {
            applicationId: app.id,
            ...toInterviewFields({
              ...interview,
              scheduledAt: at.toISOString(),
            }),
          });
        }
      }
      return true;
    });
    if (seeded) this.logger.log(`Conta de demonstração ${userId} preenchida.`);
  }
}
