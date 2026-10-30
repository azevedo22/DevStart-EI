/**
 * Objetivos diários: metas pequenas para o utilizador voltar todos os dias.
 *
 * Função pura, partilhada como o cálculo do skill gap: o frontend calcula o
 * progresso no instante em que uma candidatura é criada, e as regras ficam
 * testadas num só sítio. Novos tipos de objetivo são novas definições.
 */

export type GoalTier = 'SUFFICIENT' | 'GOOD' | 'EXCELLENT';

export const GOAL_TIERS: readonly GoalTier[] = [
  'SUFFICIENT',
  'GOOD',
  'EXCELLENT',
];

export const GOAL_TIER_LABELS: Record<GoalTier, string> = {
  SUFFICIENT: 'Suficiente',
  GOOD: 'Bom',
  EXCELLENT: 'Muito bom',
};

export interface GoalDefinition {
  id: string;
  title: string;
  /** Nome da unidade, singular e plural. */
  unit: { one: string; many: string };
  /** Patamares por ordem crescente; o último é o objetivo completo. */
  tiers: readonly { tier: GoalTier; target: number }[];
}

/** Candidatar-se a vagas: 3 é suficiente, 7 é bom, 10 é muito bom. */
export const DAILY_APPLICATIONS_GOAL: GoalDefinition = {
  id: 'daily-applications',
  title: 'Candidaturas de hoje',
  unit: { one: 'candidatura', many: 'candidaturas' },
  tiers: [
    { tier: 'SUFFICIENT', target: 3 },
    { tier: 'GOOD', target: 7 },
    { tier: 'EXCELLENT', target: 10 },
  ],
};

export interface DayProgress {
  date: string; // AAAA-MM-DD
  count: number;
  tier: GoalTier | null;
}

export interface DailyGoalProgress {
  goal: GoalDefinition;
  today: DayProgress;
  /** O objetivo completo (último patamar). */
  max: number;
  /** O próximo patamar e quanto falta; null se já chegou ao máximo. */
  next: { tier: GoalTier; target: number; missing: number } | null;
  /** Os últimos 7 dias, do mais antigo até hoje. */
  week: DayProgress[];
  /**
   * Dias seguidos com pelo menos o primeiro patamar. Se hoje ainda não chegou
   * lá, a sequência conta até ontem: ainda dá para a manter hoje.
   */
  streak: number;
  /** Se hoje já conta para a sequência. */
  streakIncludesToday: boolean;
}

/** Até onde se olha para trás para contar a sequência. */
const MAX_STREAK_DAYS = 365;

export function tierFor(
  count: number,
  goal: GoalDefinition = DAILY_APPLICATIONS_GOAL,
): GoalTier | null {
  let reached: GoalTier | null = null;
  for (const { tier, target } of goal.tiers)
    if (count >= target) reached = tier;
  return reached;
}

/**
 * @param dates  a data (AAAA-MM-DD) de cada ação que conta para o objetivo,
 *               ex.: a data de cada candidatura
 * @param today  a data de hoje no fuso do utilizador (AAAA-MM-DD)
 */
export function dailyGoalProgress(
  dates: readonly string[],
  today: string,
  goal: GoalDefinition = DAILY_APPLICATIONS_GOAL,
): DailyGoalProgress {
  const perDay = new Map<string, number>();
  for (const d of dates) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  const day = (date: string): DayProgress => {
    const count = perDay.get(date) ?? 0;
    return { date, count, tier: tierFor(count, goal) };
  };

  const todayProgress = day(today);
  const nextTier = goal.tiers.find((t) => todayProgress.count < t.target);

  const week = Array.from({ length: 7 }, (_, i) => day(addDays(today, i - 6)));

  const streakIncludesToday = todayProgress.tier !== null;
  let streak = 0;
  let cursor = streakIncludesToday ? today : addDays(today, -1);
  while (streak < MAX_STREAK_DAYS && tierFor(perDay.get(cursor) ?? 0, goal)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return {
    goal,
    today: todayProgress,
    max: goal.tiers[goal.tiers.length - 1].target,
    next: nextTier
      ? {
          tier: nextTier.tier,
          target: nextTier.target,
          missing: nextTier.target - todayProgress.count,
        }
      : null,
    week,
    streak,
    streakIncludesToday,
  };
}

/** Data local (não UTC) no formato AAAA-MM-DD: "hoje" é o dia do utilizador. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Soma dias a uma data AAAA-MM-DD (em UTC, para não haver saltos de hora de verão). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
