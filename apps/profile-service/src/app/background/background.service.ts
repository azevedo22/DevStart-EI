import {
  BACKGROUND_LIMITS,
  Education,
  EntrySource,
  Experience,
  LanguageSkill,
  SaveEducationRequest,
  SaveExperienceRequest,
} from '@devstart/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  EducationEntity,
  ExperienceEntity,
  LanguageEntity,
} from './background.entities';

const NOT_FOUND = 'Registo não encontrado.';

/**
 * Formação, experiência e línguas do utilizador.
 * Os métodos aceitam um EntityManager opcional para poderem correr dentro da
 * transação da importação do CV.
 */
@Injectable()
export class BackgroundService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── Leitura ─────────────────────────────────────────────────

  /** O mais recente primeiro; o que está em curso (sem fim) vem antes de tudo. */
  async listEducation(userId: string): Promise<Education[]> {
    const rows = await this.db
      .getRepository(EducationEntity)
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.end_year', 'DESC', 'NULLS FIRST')
      .addOrderBy('e.start_year', 'DESC', 'NULLS LAST')
      .addOrderBy('e.created_at', 'DESC')
      .getMany();
    return rows.map(toEducation);
  }

  async listExperience(userId: string): Promise<Experience[]> {
    const rows = await this.db
      .getRepository(ExperienceEntity)
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.end_date', 'DESC', 'NULLS FIRST')
      .addOrderBy('e.start_date', 'DESC', 'NULLS LAST')
      .addOrderBy('e.created_at', 'DESC')
      .getMany();
    return rows.map(toExperience);
  }

  async listLanguages(userId: string): Promise<LanguageSkill[]> {
    const rows = await this.db.getRepository(LanguageEntity).find({
      where: { userId },
      order: { position: 'ASC', language: 'ASC' },
    });
    return rows.map(({ language, level }) => ({ language, level }));
  }

  // ── Formação ────────────────────────────────────────────────

  async addEducation(
    userId: string,
    dto: SaveEducationRequest,
    em: EntityManager = this.db.manager,
    source: EntrySource = 'manual',
  ): Promise<Education> {
    checkYears(dto);
    if (
      (await em.countBy(EducationEntity, { userId })) >=
      BACKGROUND_LIMITS.educationPerUser
    ) {
      throw new ConflictException(
        `No máximo ${BACKGROUND_LIMITS.educationPerUser} formações.`,
      );
    }
    const saved = await em.save(
      em.create(EducationEntity, { userId, source, ...educationFields(dto) }),
    );
    return toEducation(saved);
  }

  async updateEducation(
    userId: string,
    id: string,
    dto: SaveEducationRequest,
  ): Promise<Education> {
    checkYears(dto);
    const row = await this.ownedEducation(userId, id);
    // Editada pela pessoa: um CV importado depois já não a substitui.
    Object.assign(row, educationFields(dto), { source: 'manual' });
    return toEducation(await this.db.manager.save(row));
  }

  async removeEducation(userId: string, id: string): Promise<void> {
    const { affected } = await this.db
      .getRepository(EducationEntity)
      .delete({ id, userId });
    if (!affected) throw new NotFoundException(NOT_FOUND);
  }

  // ── Experiência ─────────────────────────────────────────────

  async addExperience(
    userId: string,
    dto: SaveExperienceRequest,
    em: EntityManager = this.db.manager,
    source: EntrySource = 'manual',
  ): Promise<Experience> {
    checkDates(dto);
    if (
      (await em.countBy(ExperienceEntity, { userId })) >=
      BACKGROUND_LIMITS.experiencePerUser
    ) {
      throw new ConflictException(
        `No máximo ${BACKGROUND_LIMITS.experiencePerUser} experiências.`,
      );
    }
    const saved = await em.save(
      em.create(ExperienceEntity, { userId, source, ...experienceFields(dto) }),
    );
    return toExperience(saved);
  }

  async updateExperience(
    userId: string,
    id: string,
    dto: SaveExperienceRequest,
  ): Promise<Experience> {
    checkDates(dto);
    const row = await this.ownedExperience(userId, id);
    // Editada pela pessoa: um CV importado depois já não a substitui.
    Object.assign(row, experienceFields(dto), { source: 'manual' });
    return toExperience(await this.db.manager.save(row));
  }

  async removeExperience(userId: string, id: string): Promise<void> {
    const { affected } = await this.db
      .getRepository(ExperienceEntity)
      .delete({ id, userId });
    if (!affected) throw new NotFoundException(NOT_FOUND);
  }

  // ── Línguas ─────────────────────────────────────────────────

  /** Substitui a lista inteira: é pequena e editada de uma vez. */
  async replaceLanguages(
    userId: string,
    languages: LanguageSkill[],
  ): Promise<LanguageSkill[]> {
    await this.db.transaction(async (em) => {
      await em.delete(LanguageEntity, { userId });
      await this.mergeLanguages(userId, languages, em);
    });
    return this.listLanguages(userId);
  }

  /**
   * Junta línguas à lista existente. Uma língua já presente (sem distinguir
   * maiúsculas) fica com o nível novo; as outras entram no fim.
   */
  async mergeLanguages(
    userId: string,
    languages: LanguageSkill[],
    em: EntityManager,
  ): Promise<void> {
    const existing = await em.find(LanguageEntity, { where: { userId } });
    const byKey = new Map(existing.map((l) => [l.language.toLowerCase(), l]));
    let position = existing.length;

    for (const { language, level } of dedupeLanguages(languages)) {
      const name = capitalize(language.trim());
      const current = byKey.get(name.toLowerCase());
      if (current) {
        await em.update(
          LanguageEntity,
          { userId, language: current.language },
          { level },
        );
      } else {
        if (byKey.size >= BACKGROUND_LIMITS.languagesPerUser) {
          throw new ConflictException(
            `No máximo ${BACKGROUND_LIMITS.languagesPerUser} línguas.`,
          );
        }
        const row = em.create(LanguageEntity, {
          userId,
          language: name,
          level,
          position: position++,
        });
        await em.insert(LanguageEntity, row);
        byKey.set(name.toLowerCase(), row);
      }
    }
  }

  // ── Auxiliares ──────────────────────────────────────────────

  private async ownedEducation(userId: string, id: string) {
    const row = await this.db
      .getRepository(EducationEntity)
      .findOneBy({ id, userId });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  private async ownedExperience(userId: string, id: string) {
    const row = await this.db
      .getRepository(ExperienceEntity)
      .findOneBy({ id, userId });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }
}

function checkYears(dto: SaveEducationRequest): void {
  if (dto.startYear && dto.endYear && dto.endYear < dto.startYear) {
    throw new BadRequestException(
      'O ano de conclusão não pode ser anterior ao de início.',
    );
  }
}

function checkDates(dto: SaveExperienceRequest): void {
  if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
    throw new BadRequestException(
      'A data de fim não pode ser anterior à de início.',
    );
  }
}

function educationFields(dto: SaveEducationRequest) {
  return {
    institution: dto.institution,
    degree: dto.degree,
    fieldOfStudy: dto.fieldOfStudy ?? null,
    startYear: dto.startYear ?? null,
    endYear: dto.endYear ?? null,
  };
}

function experienceFields(dto: SaveExperienceRequest) {
  return {
    organization: dto.organization,
    role: dto.role,
    kind: dto.kind,
    startDate: dto.startDate ?? null,
    endDate: dto.endDate ?? null,
    description: dto.description ?? null,
  };
}

function toEducation(e: EducationEntity): Education {
  return {
    id: e.id,
    source: e.source,
    institution: e.institution,
    degree: e.degree,
    fieldOfStudy: e.fieldOfStudy,
    startYear: e.startYear,
    endYear: e.endYear,
  };
}

function toExperience(e: ExperienceEntity): Experience {
  return {
    id: e.id,
    source: e.source,
    organization: e.organization,
    role: e.role,
    kind: e.kind,
    startDate: e.startDate,
    endDate: e.endDate,
    description: e.description,
  };
}

/** A última ocorrência de cada língua ganha (ex.: "inglês B1" e depois "Inglês C1"). */
function dedupeLanguages(languages: LanguageSkill[]): LanguageSkill[] {
  const map = new Map<string, LanguageSkill>();
  for (const l of languages) map.set(l.language.trim().toLowerCase(), l);
  return [...map.values()];
}

const capitalize = (s: string) =>
  s.charAt(0).toLocaleUpperCase('pt-PT') + s.slice(1);
