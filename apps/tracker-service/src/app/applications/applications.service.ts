import {
  ACCESSIBILITIES,
  APPLICATION_LIMITS,
  APPLICATION_STATUSES,
  Accessibility,
  ApplicationBoard,
  ApplicationStats,
  ApplicationStatus,
  CLOSED_STATUSES,
  NOT_APPLIED_STATUSES,
  RESPONSE_STATUSES,
  isApplied,
  Interview,
  JobApplication,
  JobApplicationDetail,
  classifyAccessibility,
  SaveApplicationRequest,
} from '@devstart/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { MoveApplicationDto, SaveApplicationDto } from './dto/application.dto';
import {
  ApplicationEntity,
  InterviewEntity,
  StatusHistoryEntity,
} from './application.entities';

const NOT_FOUND = 'Candidatura não encontrada.';

export interface ApplicationFilter {
  accessibility?: Accessibility;
  q?: string;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(StatusHistoryEntity)
    private readonly history: Repository<StatusHistoryEntity>,
    @InjectRepository(InterviewEntity)
    private readonly interviews: Repository<InterviewEntity>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // ── Leitura ─────────────────────────────────────────────────

  async list(
    userId: string,
    filter: ApplicationFilter = {},
  ): Promise<JobApplication[]> {
    const qb = this.applications
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .orderBy('a.status')
      .addOrderBy('a.position');

    if (filter.accessibility) {
      if (!ACCESSIBILITIES.includes(filter.accessibility))
        throw new BadRequestException('Filtro de acessibilidade inválido.');
      qb.andWhere('a.accessibility = :acc', { acc: filter.accessibility });
    }
    const q = filter.q?.trim();
    if (q) {
      // ILIKE com o termo escapado: % e _ escritos pelo utilizador contam como texto.
      const term = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('a.company_name ILIKE :term', { term })
            .orWhere('a.job_title ILIKE :term', { term }),
        ),
      );
    }
    return (await withInterviewCount(qb)).map(toApplication);
  }

  async board(
    userId: string,
    filter: ApplicationFilter = {},
  ): Promise<ApplicationBoard> {
    const board = Object.fromEntries(
      APPLICATION_STATUSES.map((s) => [s, [] as JobApplication[]]),
    ) as ApplicationBoard;
    for (const app of await this.list(userId, filter))
      board[app.status].push(app);
    return board;
  }

  async detail(userId: string, id: string): Promise<JobApplicationDetail> {
    const app = await this.findOwned(userId, id);
    const [history, interviews] = await Promise.all([
      this.history.find({
        where: { applicationId: id },
        order: { changedAt: 'ASC' },
      }),
      this.interviews.find({
        where: { applicationId: id },
        order: {
          scheduledAt: { direction: 'ASC', nulls: 'LAST' },
          createdAt: 'ASC',
        },
      }),
    ]);
    return {
      ...toApplication({
        ...app,
        interviewCount: interviews.length,
      } as ApplicationEntity),
      history: history.map((h) => ({
        from: h.fromStatus,
        to: h.toStatus,
        changedAt: h.changedAt.toISOString(),
      })),
      interviews: interviews.map(toInterview),
    };
  }

  async stats(userId: string): Promise<ApplicationStats> {
    const rows = await this.applications
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('a.accessibility', 'accessibility')
      .addSelect('count(*)::int', 'count')
      .where('a.user_id = :userId', { userId })
      .groupBy('a.status')
      .addGroupBy('a.accessibility')
      .getRawMany<{
        status: ApplicationStatus;
        accessibility: Accessibility;
        count: number;
      }>();

    const byStatus = Object.fromEntries(
      APPLICATION_STATUSES.map((s) => [s, 0]),
    ) as Record<ApplicationStatus, number>;
    const byAccessibility = Object.fromEntries(
      ACCESSIBILITIES.map((a) => [a, 0]),
    ) as Record<Accessibility, number>;
    for (const r of rows) {
      byStatus[r.status] += r.count;
      // As vagas guardadas ainda não são candidaturas.
      if (isApplied(r.status)) byAccessibility[r.accessibility] += r.count;
    }
    const saved = NOT_APPLIED_STATUSES.reduce((n, s) => n + byStatus[s], 0);
    const total = rows.reduce((sum, r) => sum + r.count, 0) - saved;

    // Responderam: estão agora numa coluna de resposta (teste, entrevista,
    // proposta ou rejeição). Pela coluna atual e não pelo histórico: um cartão
    // movido por engano e posto de volta em "Candidatado" não é uma resposta.
    const responded = RESPONSE_STATUSES.reduce((n, s) => n + byStatus[s], 0);
    const [{ interviews }] = await this.db.query(
      `SELECT count(*)::int AS interviews FROM interviews i JOIN applications a ON a.id = i.application_id WHERE a.user_id = $1`,
      [userId],
    );

    return {
      total,
      saved,
      active: total - CLOSED_STATUSES.reduce((sum, s) => sum + byStatus[s], 0),
      byStatus,
      byAccessibility,
      responseRate: total ? Math.round((responded / total) * 100) : null,
      interviews,
      offers: byStatus.OFFER,
    };
  }

  // ── Escrita ─────────────────────────────────────────────────

  async create(
    userId: string,
    dto: SaveApplicationDto,
  ): Promise<JobApplication> {
    const status = dto.status ?? 'APPLIED';
    const id = await this.inUserTransaction(userId, async (em) => {
      if (
        (await em.countBy(ApplicationEntity, { userId })) >=
        APPLICATION_LIMITS.applicationsPerUser
      ) {
        throw new ConflictException(
          `Chegaste ao limite de ${APPLICATION_LIMITS.applicationsPerUser} candidaturas.`,
        );
      }
      // A nova candidatura entra no topo da coluna.
      await this.shift(em, userId, status, 0, +1);
      const saved = await em.save(
        em.create(ApplicationEntity, {
          userId,
          ...toApplicationFields(dto),
          status,
          position: 0,
        }),
      );
      await em.insert(StatusHistoryEntity, {
        applicationId: saved.id,
        fromStatus: null,
        toStatus: status,
      });
      return saved.id;
    });
    return this.get(userId, id);
  }

  /** Edita os dados da vaga. A coluna só muda por /move, para ficar sempre registada no histórico. */
  async update(
    userId: string,
    id: string,
    dto: SaveApplicationDto,
  ): Promise<JobApplication> {
    const app = await this.findOwned(userId, id);
    if (dto.status && dto.status !== app.status) {
      throw new BadRequestException(
        'Para mudar de coluna usa PATCH /applications/:id/move.',
      );
    }
    await this.applications.update({ id, userId }, toApplicationFields(dto));
    return this.get(userId, id);
  }

  /**
   * Move um cartão para (status, position), mantendo as posições de cada coluna
   * contínuas: fecha o buraco na origem e abre espaço no destino.
   */
  async move(
    userId: string,
    id: string,
    dto: MoveApplicationDto,
  ): Promise<JobApplication> {
    await this.inUserTransaction(userId, async (em) => {
      const app = await em.findOneBy(ApplicationEntity, { id, userId });
      if (!app) throw new NotFoundException(NOT_FOUND);

      const from = { status: app.status, position: app.position };
      const sameColumn = from.status === dto.status;
      const targetSize = await em.countBy(ApplicationEntity, {
        userId,
        status: dto.status,
      });
      // Posição pedida além do fim da coluna → vai para o fim.
      const maxPosition = sameColumn ? targetSize - 1 : targetSize;
      const to = Math.min(dto.position, maxPosition);

      if (sameColumn) {
        if (to === from.position) return;
        if (to > from.position) {
          await this.shiftRange(
            em,
            userId,
            from.status,
            from.position + 1,
            to,
            -1,
          );
        } else {
          await this.shiftRange(
            em,
            userId,
            from.status,
            to,
            from.position - 1,
            +1,
          );
        }
      } else {
        await this.shift(em, userId, from.status, from.position + 1, -1);
        await this.shift(em, userId, dto.status, to, +1);
        await em.insert(StatusHistoryEntity, {
          applicationId: id,
          fromStatus: from.status,
          toStatus: dto.status,
        });
      }
      // Sair de "Por candidatar" é candidatar-se: a data passa a ser esse dia.
      const applying = !isApplied(from.status) && isApplied(dto.status);
      await em.update(
        ApplicationEntity,
        { id },
        {
          status: dto.status,
          position: to,
          ...(applying && {
            appliedAt: dto.appliedAt ?? new Date().toISOString().slice(0, 10),
          }),
        },
      );
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.inUserTransaction(userId, async (em) => {
      const app = await em.findOneBy(ApplicationEntity, { id, userId });
      if (!app) throw new NotFoundException(NOT_FOUND);
      await em.delete(ApplicationEntity, { id });
      await this.shift(em, userId, app.status, app.position + 1, -1);
    });
  }

  // ── Auxiliares ──────────────────────────────────────────────

  async findOwned(userId: string, id: string): Promise<ApplicationEntity> {
    const app = await this.applications.findOneBy({ id, userId });
    if (!app) throw new NotFoundException(NOT_FOUND);
    return app;
  }

  private async get(userId: string, id: string): Promise<JobApplication> {
    const [app] = await withInterviewCount(
      this.applications
        .createQueryBuilder('a')
        .where('a.id = :id AND a.user_id = :userId', { id, userId }),
    );
    if (!app) throw new NotFoundException(NOT_FOUND);
    return toApplication(app);
  }

  /**
   * Transação com um bloqueio por utilizador: dois movimentos ao mesmo tempo
   * (dois separadores abertos, por exemplo) são aplicados um de cada vez,
   * em vez de baralharem as posições.
   */
  private inUserTransaction<T>(
    userId: string,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
      return work(em);
    });
  }

  /** Soma `delta` à posição dos cartões da coluna a partir de `fromPosition`. */
  private shift(
    em: EntityManager,
    userId: string,
    status: ApplicationStatus,
    fromPosition: number,
    delta: 1 | -1,
  ) {
    return em
      .createQueryBuilder()
      .update(ApplicationEntity)
      .set({ position: () => `position + ${delta}` })
      .where(
        'user_id = :userId AND status = :status AND position >= :fromPosition',
        { userId, status, fromPosition },
      )
      .execute();
  }

  private shiftRange(
    em: EntityManager,
    userId: string,
    status: ApplicationStatus,
    start: number,
    end: number,
    delta: 1 | -1,
  ) {
    return em
      .createQueryBuilder()
      .update(ApplicationEntity)
      .set({ position: () => `position + ${delta}` })
      .where(
        'user_id = :userId AND status = :status AND position BETWEEN :start AND :end',
        { userId, status, start, end },
      )
      .execute();
  }

  /** Campos editáveis. A acessibilidade é sempre recalculada aqui, nunca vem do cliente. */
}

/** Junta o número de entrevistas de cada candidatura numa só consulta (subconsulta de contagem). */
async function withInterviewCount(
  qb: SelectQueryBuilder<ApplicationEntity>,
): Promise<ApplicationEntity[]> {
  const { entities, raw } = await qb
    .addSelect(
      (sq) =>
        sq
          .select('count(*)::int')
          .from(InterviewEntity, 'i')
          .where('i.application_id = a.id'),
      'interview_count',
    )
    .getRawAndEntities<{ interview_count: number }>();
  return entities.map((e, i) =>
    Object.assign(e, { interviewCount: raw[i].interview_count }),
  );
}

export function toApplication(a: ApplicationEntity): JobApplication {
  return {
    id: a.id,
    companyName: a.companyName,
    jobTitle: a.jobTitle,
    jobUrl: a.jobUrl,
    location: a.location,
    workMode: a.workMode,
    status: a.status,
    position: a.position,
    requiredCompetencyIds: a.requiredCompetencyIds,
    otherSkills: a.otherSkills ?? [],
    yearsRequired: a.yearsRequired,
    experienceRequirements: a.experienceRequirements ?? [],
    seniority: a.seniority,
    accessibility: a.accessibility,
    mislabeledJunior: a.mislabeledJunior,
    appliedAt: a.appliedAt,
    notes: a.notes,
    interviewCount: a.interviewCount ?? 0,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function toInterview(i: InterviewEntity): Interview {
  return {
    id: i.id,
    applicationId: i.applicationId,
    type: i.type,
    scheduledAt: i.scheduledAt?.toISOString() ?? null,
    completed: i.completed,
    rating: i.rating,
    outcome: i.outcome,
    questionsAsked: i.questionsAsked,
    strengths: i.strengths,
    improvements: i.improvements,
    createdAt: i.createdAt.toISOString(),
  };
}

/**
 * Campos de uma candidatura a partir do pedido. A acessibilidade é sempre
 * calculada aqui, nunca aceite do cliente. Exportado para os dados de demonstração.
 */
export function toApplicationFields(
  dto: SaveApplicationRequest,
): Partial<ApplicationEntity> {
  const yearsRequired = dto.yearsRequired ?? null;
  const verdict = classifyAccessibility({
    yearsRequired,
    seniority: dto.seniority,
  });
  return {
    companyName: dto.companyName,
    jobTitle: dto.jobTitle,
    jobUrl: dto.jobUrl ?? null,
    location: dto.location ?? null,
    workMode: dto.workMode,
    requiredCompetencyIds: dto.requiredCompetencyIds,
    otherSkills: dto.otherSkills ?? [],
    yearsRequired,
    experienceRequirements: dto.experienceRequirements ?? [],
    seniority: dto.seniority,
    accessibility: verdict.accessibility,
    mislabeledJunior: verdict.mislabeledJunior,
    appliedAt: dto.appliedAt,
    notes: dto.notes ?? null,
  };
}
