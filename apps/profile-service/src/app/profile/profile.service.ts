import { Profile, ProfileCompetency } from '@devstart/shared-types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundService } from '../background/background.service';
import { CatalogService } from '../catalog/catalog.service';
import { DeclareCompetencyDto, UpdateProfileDto } from './dto/profile.dto';
import { ProfileCompetencyEntity, ProfileEntity } from './profile.entities';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(ProfileCompetencyEntity)
    private readonly competencies: Repository<ProfileCompetencyEntity>,
    private readonly catalog: CatalogService,
    private readonly background: BackgroundService,
  ) {}

  /** Um utilizador novo ainda não tem linha em `profiles`: devolve-se um perfil vazio, sem o criar. */
  async get(userId: string): Promise<Profile> {
    const [row, competencies, education, experience, languages] =
      await Promise.all([
        this.profiles.findOneBy({ userId }),
        this.listCompetencies(userId),
        this.background.listEducation(userId),
        this.background.listExperience(userId),
        this.background.listLanguages(userId),
      ]);
    return {
      userId,
      headline: row?.headline ?? null,
      location: row?.location ?? null,
      university: row?.university ?? null,
      graduationYear: row?.graduationYear ?? null,
      bio: row?.bio ?? null,
      linkedinUrl: row?.linkedinUrl ?? null,
      githubUrl: row?.githubUrl ?? null,
      portfolioUrl: row?.portfolioUrl ?? null,
      competencies,
      education,
      experience,
      languages,
      updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
    };
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    // Só os campos presentes no pedido; undefined não apaga nada.
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    await this.profiles.upsert({ userId, ...changes }, ['userId']);
    return this.get(userId);
  }

  async listCompetencies(userId: string): Promise<ProfileCompetency[]> {
    const rows = await this.competencies.find({
      where: { userId },
      order: { declaredAt: 'ASC' },
    });
    return rows.map((r) => ({
      competencyId: r.competencyId,
      level: r.level,
      declaredAt: r.declaredAt.toISOString(),
    }));
  }

  /** Declarar de novo a mesma competência só muda o nível (idempotente). */
  async declareCompetency(
    userId: string,
    competencyId: string,
    dto: DeclareCompetencyDto,
  ): Promise<ProfileCompetency[]> {
    this.catalog.assertCompetenciesExist([competencyId]);
    await this.competencies.upsert({ userId, competencyId, level: dto.level }, [
      'userId',
      'competencyId',
    ]);
    return this.listCompetencies(userId);
  }

  async removeCompetency(userId: string, competencyId: string): Promise<void> {
    const { affected } = await this.competencies.delete({
      userId,
      competencyId,
    });
    if (!affected)
      throw new NotFoundException('Essa competência não está no teu perfil.');
  }
}
