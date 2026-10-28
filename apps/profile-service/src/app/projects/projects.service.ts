import { PROFILE_LIMITS, Project } from '@devstart/shared-types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      this.projects.create({ userId, ...this.fields(dto) }),
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
      const { competencies, ...columns } = this.fields(dto);
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

  private fields(dto: SaveProjectDto): Partial<ProjectEntity> {
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
      competencies: dto.competencyIds.map((competencyId) =>
        this.links.create({ competencyId }),
      ),
    };
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
