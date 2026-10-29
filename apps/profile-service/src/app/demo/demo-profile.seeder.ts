import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import {
  ProfileCompetencyEntity,
  ProfileEntity,
} from '../profile/profile.entities';
import { ProjectEntity } from '../projects/project.entities';
import { toProjectFields } from '../projects/projects.service';
import {
  DEMO_COMPETENCIES,
  DEMO_PROFILE,
  DEMO_PROJECTS,
} from './demo-profile.data';

/**
 * Preenche uma conta de demonstração com o perfil de exemplo.
 *
 * Tudo numa transação: o visitante vê o perfil completo ou nada, nunca metade.
 * Os campos dos projetos passam pela mesma função que a API usa, e as
 * competências são validadas contra o catálogo.
 */
@Injectable()
export class DemoProfileSeeder {
  private readonly logger = new Logger(DemoProfileSeeder.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Idempotente: o evento pode chegar mais do que uma vez. O bloqueio impede
   * duas entregas em simultâneo de passarem ambas a verificação.
   */
  async seed(userId: string): Promise<void> {
    this.catalog.assertCompetenciesExist([
      ...DEMO_COMPETENCIES.map((c) => c.competencyId),
      ...DEMO_PROJECTS.flatMap((p) => p.competencyIds),
    ]);

    const seeded = await this.db.transaction(async (em) => {
      await em.query(`SELECT pg_advisory_xact_lock(hashtext('demo:' || $1))`, [
        userId,
      ]);
      if (await em.existsBy(ProfileEntity, { userId })) return false;

      // Datas explícitas: dentro de uma transação, now() é igual para todas as
      // linhas e a ordem de apresentação ficaria ao acaso.
      const now = Date.now();
      await em.insert(
        ProfileCompetencyEntity,
        DEMO_COMPETENCIES.map(({ competencyId, level }, i) => ({
          userId,
          competencyId,
          level,
          declaredAt: new Date(now - (DEMO_COMPETENCIES.length - i) * 60_000),
        })),
      );
      for (const [i, project] of DEMO_PROJECTS.entries()) {
        const saved = await em.save(
          em.create(ProjectEntity, { userId, ...toProjectFields(project) }),
        );
        // O primeiro projeto da lista fica no topo (a lista ordena por atualização).
        await em.query(
          `UPDATE projects SET updated_at = $2, created_at = $2 WHERE id = $1`,
          [saved.id, new Date(now - i * 86_400_000)],
        );
      }
      await em.insert(ProfileEntity, { userId, ...DEMO_PROFILE });
      return true;
    });
    if (seeded) this.logger.log(`Conta de demonstração ${userId} preenchida.`);
  }
}
