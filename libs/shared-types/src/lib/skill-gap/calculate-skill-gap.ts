import { Level, TargetStack } from '../profile/profile.types';

/**
 * Cálculo do skill gap — função pura, partilhada entre backend e frontend
 * (o frontend pode usá-la para pré-visualizar o resultado sem pedir à API).
 *
 * Crédito por competência:
 *   nível >= mínimo  → peso completo
 *   nível <  mínimo  → crédito proporcional (ex.: BASIC num pedido INTERMEDIATE = 50%)
 *   não tem          → 0
 * Os projetos não mudam a percentagem: só organizam o resultado.
 */

const LEVEL_VALUE: Record<Level, number> = {
  BASIC: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

export interface UserCompetencyLevel {
  competencyId: string;
  level: Level;
}

export interface GapItem {
  competencyId: string;
  requiredLevel: Level;
  currentLevel: Level | null;
  weight: number;
}

export interface SkillGapResult {
  stackId: string;
  matchPercentage: number; // 0–100, ponderado pelos pesos
  coveredWithProjects: GapItem[]; // pronto a mostrar a recrutadores
  coveredWithoutProjects: GapItem[]; // sabe, mas falta um projeto que o mostre
  belowLevel: GapItem[]; // já começou, mas abaixo do nível pedido
  missing: GapItem[]; // ainda não tem
}

export function calculateSkillGap(
  stack: TargetStack,
  userCompetencies: UserCompetencyLevel[],
  competenciesWithProjects: ReadonlySet<string>,
): SkillGapResult {
  const userMap = new Map(
    userCompetencies.map((c) => [c.competencyId, c.level]),
  );

  const result: SkillGapResult = {
    stackId: stack.id,
    matchPercentage: 0,
    coveredWithProjects: [],
    coveredWithoutProjects: [],
    belowLevel: [],
    missing: [],
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const req of stack.requirements) {
    totalWeight += req.weight;
    const currentLevel = userMap.get(req.competencyId) ?? null;
    const item: GapItem = {
      competencyId: req.competencyId,
      requiredLevel: req.minLevel,
      currentLevel,
      weight: req.weight,
    };

    if (currentLevel === null) {
      result.missing.push(item);
      continue;
    }

    const ratio = Math.min(
      LEVEL_VALUE[currentLevel] / LEVEL_VALUE[req.minLevel],
      1,
    );
    earnedWeight += req.weight * ratio;

    if (ratio < 1) {
      result.belowLevel.push(item);
    } else if (competenciesWithProjects.has(req.competencyId)) {
      result.coveredWithProjects.push(item);
    } else {
      result.coveredWithoutProjects.push(item);
    }
  }

  result.matchPercentage =
    totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);

  // O mais importante aparece primeiro na checklist
  const byWeight = (a: GapItem, b: GapItem) => b.weight - a.weight;
  result.missing.sort(byWeight);
  result.belowLevel.sort(byWeight);
  result.coveredWithoutProjects.sort(byWeight);
  result.coveredWithProjects.sort(byWeight);

  return result;
}
