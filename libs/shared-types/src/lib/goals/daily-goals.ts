/**
 * Objetivos diários: metas pequenas para o utilizador voltar todos os dias
 * úteis. O fim de semana fica para olhar para trás (ver weekly-report.ts).
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
  /** Dias da semana em que o objetivo conta (0 = domingo … 6 = sábado). */
  activeWeekdays: readonly number[];
}

/** Segunda a sexta. */
export const WORKDAYS: readonly number[] = [1, 2, 3, 4, 5];

/**
 * Candidatar-se a vagas nos dias úteis: 1 é suficiente, 2 é bom, 3 é muito
 * bom. Pequeno de propósito: três candidaturas bem feitas por dia valem mais
 * do que dez à pressa, e um objetivo que se cumpre mantém o hábito.
 */
export const DAILY_APPLICATIONS_GOAL: GoalDefinition = {
  id: 'daily-applications',
  title: 'Candidaturas de hoje',
  unit: { one: 'candidatura', many: 'candidaturas' },
  tiers: [
    { tier: 'SUFFICIENT', target: 1 },
    { tier: 'GOOD', target: 2 },
    { tier: 'EXCELLENT', target: 3 },
  ],
  activeWeekdays: WORKDAYS,
};

export interface DayProgress {
  date: string; // AAAA-MM-DD
  count: number;
  /** Patamar atingido; sempre null num dia sem objetivo (fim de semana). */
  tier: GoalTier | null;
  /** Se o objetivo conta neste dia. */
  active: boolean;
}

export interface DailyGoalProgress {
  goal: GoalDefinition;
  today: DayProgress;
  /** O objetivo completo (último patamar). */
  max: number;
  /** O próximo patamar e quanto falta; null se já chegou ao máximo. */
  next: { tier: GoalTier; target: number; missing: number } | null;
  /** Hoje não há objetivo (fim de semana): dia de reflexão. */
  restDay: boolean;
  /** A semana de hoje, de segunda a domingo. */
  week: DayProgress[];
  /**
   * Dias úteis seguidos com pelo menos o primeiro patamar; o fim de semana
   * não parte nem soma. Se hoje ainda não chegou lá, a sequência conta até ao
   * dia útil anterior: ainda dá para a manter hoje.
   */
  streak: number;
  /** Se hoje já conta para a sequência. */
  streakIncludesToday: boolean;
}

/** Até onde se olha para trás para contar a sequência (dias de calendário). */
const MAX_STREAK_LOOKBACK = 400;

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
  const isActive = (date: string) =>
    goal.activeWeekdays.includes(weekday(date));
  const day = (date: string): DayProgress => {
    const count = perDay.get(date) ?? 0;
    const active = isActive(date);
    return { date, count, tier: active ? tierFor(count, goal) : null, active };
  };

  const todayProgress = day(today);
  const nextTier = todayProgress.active
    ? goal.tiers.find((t) => todayProgress.count < t.target)
    : undefined;

  const monday = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => day(addDays(monday, i)));

  // Sequência: só os dias úteis contam; os outros saltam-se.
  const streakIncludesToday = todayProgress.tier !== null;
  let streak = 0;
  let cursor = streakIncludesToday ? today : addDays(today, -1);
  for (let i = 0; i < MAX_STREAK_LOOKBACK; i++, cursor = addDays(cursor, -1)) {
    if (!isActive(cursor)) continue;
    if (!tierFor(perDay.get(cursor) ?? 0, goal)) break;
    streak++;
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
    restDay: !todayProgress.active,
    week,
    streak,
    streakIncludesToday,
  };
}

/** Abreviaturas dos dias, pelo índice de weekday() (0 = domingo). */
export const WEEKDAY_SHORT: readonly string[] = [
  'dom',
  'seg',
  'ter',
  'qua',
  'qui',
  'sex',
  'sáb',
];

/** Dia da semana de uma data AAAA-MM-DD: 0 = domingo … 6 = sábado. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** A segunda-feira da semana de uma data (as semanas começam à segunda). */
export function weekStart(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
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
