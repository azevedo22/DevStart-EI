import {
  ActivityEvent,
  ActivityKind,
  ActivityRange,
  PROFILE_LIMITS,
  Project,
  SaveProjectRequest,
} from '@devstart/shared-types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import { SaveProjectDto } from './dto/project.dto';
import { ProjectCompetencyEntity, ProjectEntity } from './project.entities';

const NOT_FOUND = 'Projeto não encontrado.';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectCompetencyEntity)
    private readonly links: Repository<ProjectCompetencyEntity>,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Para o relatório semanal: o dia em que cada projeto foi criado e, se foi
   * mexido noutro dia, o da última atualização (só se guarda a última). Datas
   * no fuso do utilizador.
   */
  async activity(
    userId: string,
    range: ActivityRange,
  ): Promise<ActivityEvent[]> {
    const rows: { date: string; kind: ActivityKind; subject: string }[] =
      await this.projects.query(
        `WITH p AS (
           SELECT title,
                  (created_at AT TIME ZONE $4)::date AS created_day,
                  (updated_at AT TIME ZONE $4)::date AS updated_day
             FROM projects WHERE user_id = $1
         )
         SELECT created_day::text AS date, 'PROJECT_CREATED' AS kind, title AS subject
           FROM p WHERE created_day BETWEEN $2::date AND $3::date
         UNION ALL
         SELECT updated_day::text, 'PROJECT_UPDATED', title
           FROM p WHERE updated_day > created_day
            AND updated_day BETWEEN $2::date AND $3::date
         ORDER BY 1, 2, 3`,
        [userId, range.from, range.to, range.tz],
      );
    return rows.map((r) => ({
      date: r.date,
      kind: r.kind,
      subject: r.subject,
    }));
  }

  async list(userId: string): Promise<Project[]> {
    const rows = await this.projects.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return rows.map(toProject);
  }

  async get(userId: string, id: string): Promise<Project> {
    return toProject(await this.findOwned(userId, id));
  }

  async create(userId: string, dto: SaveProjectDto): Promise<Project> {
    this.catalog.assertCompetenciesExist(dto.competencyIds);
    if (
      (await this.projects.countBy({ userId })) >=
      PROFILE_LIMITS.projectsPerUser
    ) {
      throw new ConflictException(
        `Chegaste ao limite de ${PROFILE_LIMITS.projectsPerUser} projetos.`,
      );
    }
    const saved = await this.projects.save(
      this.projects.create({ userId, ...toProjectFields(dto) }),
    );
    return toProject(saved);
  }

  /** PUT: substitui o projeto inteiro, incluindo a lista de competências. */
  async update(
    userId: string,
    id: string,
    dto: SaveProjectDto,
  ): Promise<Project> {
    this.catalog.assertCompetenciesExist(dto.competencyIds);
    await this.findOwned(userId, id);

    // Numa transação: ou muda tudo (dados + competências) ou não muda nada.
    await this.projects.manager.transaction(async (em) => {
      const { competencies, ...columns } = toProjectFields(dto);
      // updatedAt explícito: a alteração pode ser só nas competências (outra tabela).
      await em.update(
        ProjectEntity,
        { id, userId },
        { ...columns, updatedAt: new Date() },
      );
      await em.delete(ProjectCompetencyEntity, { projectId: id });
      if (competencies?.length) {
        await em.insert(
          ProjectCompetencyEntity,
          competencies.map((c) => ({
            projectId: id,
            competencyId: c.competencyId,
          })),
        );
      }
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.projects.delete({ id, userId });
    if (!affected) throw new NotFoundException(NOT_FOUND);
  }

  /** Ids das competências que aparecem em pelo menos um projeto do utilizador. */
  async competenciesWithProjects(userId: string): Promise<Set<string>> {
    const rows = await this.links
      .createQueryBuilder('pc')
      .select('DISTINCT pc.competency_id', 'competencyId')
      .innerJoin('pc.project', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawMany<{ competencyId: string }>();
    return new Set(rows.map((r) => r.competencyId));
  }

  /**
   * Procura sempre por id E dono. Um projeto de outra pessoa dá 404, não 403,
   * para não revelar que esse id existe.
   */
  private async findOwned(userId: string, id: string): Promise<ProjectEntity> {
    const project = await this.projects.findOneBy({ id, userId });
    if (!project) throw new NotFoundException(NOT_FOUND);
    return project;
  }
}

function toProject(p: ProjectEntity): Project {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    repositoryUrl: p.repositoryUrl,
    liveUrl: p.liveUrl,
    origin: p.origin,
    academicContext: p.academicContext,
    competencyIds: (p.competencies ?? []).map((c) => c.competencyId).sort(),
    practices: p.practices,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Campos de um projeto a partir do pedido. Exportado para os dados de demonstração. */
export function toProjectFields(
  dto: SaveProjectRequest,
): DeepPartial<ProjectEntity> {
  return {
    title: dto.title,
    description: dto.description,
    repositoryUrl: dto.repositoryUrl ?? null,
    liveUrl: dto.liveUrl ?? null,
    origin: dto.origin,
    // O contexto académico só faz sentido em projetos académicos.
    academicContext:
      dto.origin === 'ACADEMIC' ? (dto.academicContext ?? null) : null,
    practices: dto.practices,
    competencies: dto.competencyIds.map((competencyId) => ({ competencyId })),
  };
}
