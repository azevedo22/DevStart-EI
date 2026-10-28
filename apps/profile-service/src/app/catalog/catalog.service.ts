import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Competency,
  CompetencyCategory,
  SkillGapResult,
  TargetStack,
  UserCompetencyLevel,
  calculateSkillGap,
} from '@devstart/shared-types';
import { COMPETENCIES } from './seed/competencies.seed';
import { TARGET_STACKS } from './seed/target-stacks.seed';

const COMPETENCY_IDS = new Set(COMPETENCIES.map((c) => c.id));

/**
 * Catálogo em memória (seed). Quando entrar a base de dados,
 * só esta classe muda: os controllers mantêm o mesmo contrato.
 */
@Injectable()
export class CatalogService {
  findCompetencies(
    filter: { category?: CompetencyCategory; q?: string } = {},
  ): Competency[] {
    const q = filter.q?.trim().toLowerCase();
    return COMPETENCIES.filter(
      (c) => !filter.category || c.category === filter.category,
    ).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        c.aliases.some((a) => a.includes(q)),
    );
  }

  findCompetency(id: string): Competency {
    const competency = COMPETENCIES.find((c) => c.id === id);
    if (!competency)
      throw new NotFoundException(`Competência '${id}' não existe`);
    return competency;
  }

  /**
   * Garante que todos os ids existem no catálogo. Sem esta validação, um id
   * inventado ficaria guardado e nunca apareceria em nenhuma stack.
   */
  assertCompetenciesExist(ids: string[]): void {
    const unknown = ids.filter((id) => !COMPETENCY_IDS.has(id));
    if (unknown.length) {
      throw new BadRequestException(
        `Competência desconhecida: ${unknown.join(', ')}`,
      );
    }
  }

  findStacks(): TargetStack[] {
    return TARGET_STACKS;
  }

  findStack(id: string): TargetStack {
    const stack = TARGET_STACKS.find((s) => s.id === id);
    if (!stack) throw new NotFoundException(`Stack '${id}' não existe`);
    return stack;
  }

  /** Pré-visualização sem perfil guardado (útil antes de existir base de dados). */
  previewGap(
    stackId: string,
    competencies: UserCompetencyLevel[],
    withProjects: string[] = [],
  ): SkillGapResult {
    return calculateSkillGap(
      this.findStack(stackId),
      competencies,
      new Set(withProjects),
    );
  }
}
