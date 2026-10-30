/**
 * Relatório semanal: o que aconteceu em cada dia, de segunda a domingo.
 *
 * Os serviços devolvem eventos já com a data no fuso do utilizador (o tracker
 * as candidaturas, respostas e entrevistas; o profile os projetos). Esta
 * função pura junta-os, conta por dia e por semana, e compara com a semana
 * anterior. O fim de semana é para ler isto com calma.
 */
import type {
  ApplicationStatus,
  InterviewType,
} from '../applications/application.types';
import {
  addDays,
  DAILY_APPLICATIONS_GOAL,
  GoalDefinition,
  GoalTier,
  tierFor,
  weekday,
} from './daily-goals';

// ── Eventos ─────────────────────────────────────────────────────

export const ACTIVITY_KINDS = [
  'APPLIED',
  'RESPONSE_POSITIVE',
  'OFFER',
  'REJECTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Nome de cada tipo de evento, singular e plural, para frases como "2 candidaturas". */
export const ACTIVITY_LABELS: Record<
  ActivityKind,
  { one: string; many: string }
> = {
  APPLIED: { one: 'candidatura', many: 'candidaturas' },
  RESPONSE_POSITIVE: {
    one: 'resposta positiva',
    many: 'respostas positivas',
  },
  OFFER: { one: 'proposta', many: 'propostas' },
  REJECTED: { one: 'rejeição', many: 'rejeições' },
  INTERVIEW_SCHEDULED: {
    one: 'entrevista marcada',
    many: 'entrevistas marcadas',
  },
  INTERVIEW: { one: 'entrevista', many: 'entrevistas' },
  PROJECT_CREATED: { one: 'projeto novo', many: 'projetos novos' },
  PROJECT_UPDATED: { one: 'projeto atualizado', many: 'projetos atualizados' },
};

/**
 * Uma coisa que aconteceu num dia:
 * - APPLIED: candidatura enviada (data da candidatura)
 * - RESPONSE_POSITIVE: a candidatura avançou de fase no Kanban (`status` é a nova)
 * - OFFER / REJECTED: proposta recebida / candidatura rejeitada
 * - INTERVIEW_SCHEDULED: entrevista registada, para um dia posterior (`at`)
 * - INTERVIEW: o dia da entrevista; `round` é a 1.ª, 2.ª… desse processo
 * - PROJECT_CREATED / PROJECT_UPDATED: projeto do portefólio
 */
export interface ActivityEvent {
  /** AAAA-MM-DD no fuso do utilizador. */
  date: string;
  kind: ActivityKind;
  /** Empresa (candidaturas) ou título (projetos). */
  subject: string;
  /** Vaga, nos eventos de candidaturas. */
  jobTitle?: string | null;
  status?: ApplicationStatus;
  interviewType?: InterviewType;
  round?: number;
  /** Data e hora da entrevista (ISO), quando marcada. */
  at?: string | null;
}

// ── Intervalo pedido aos serviços ───────────────────────────────

export const ACTIVITY_LIMITS = {
  /** Duas semanas e mais um pouco: a semana e a anterior, para comparar. */
  maxDays: 62,
} as const;

export interface ActivityRange {
  from: string;
  to: string;
  /** Fuso IANA, ex.: "Europe/Lisbon". */
  tz: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida o intervalo de um pedido de atividade. Devolve o intervalo, ou a
 * mensagem de erro para um 400. Sem fuso, usa UTC.
 */
export function parseActivityRange(q: {
  from?: string;
  to?: string;
  tz?: string;
}): ActivityRange | { error: string } {
  const { from, to } = q;
  if (!from || !to || !isDate(from) || !isDate(to))
    return { error: 'Indica from e to no formato AAAA-MM-DD.' };
  if (to < from) return { error: 'O fim (to) é anterior ao início (from).' };
  if (daysBetween(from, to) + 1 > ACTIVITY_LIMITS.maxDays)
    return {
      error: `O intervalo tem mais de ${ACTIVITY_LIMITS.maxDays} dias.`,
    };
  const tz = q.tz?.trim() || 'UTC';
  if (!isTimeZone(tz)) return { error: 'Fuso horário (tz) desconhecido.' };
  return { from, to, tz };
}

function isDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  return addDays(s, 0) === s; // rejeita 2026-02-31
}

function isTimeZone(tz: string): boolean {
  if (tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

// ── Séries do gráfico ───────────────────────────────────────────

export type ReportSeriesId =
  'applications' | 'positive' | 'rejected' | 'interviews' | 'projects';

/** O que se desenha no gráfico: alguns tipos juntam-se numa só barra. */
export const REPORT_SERIES: readonly {
  id: ReportSeriesId;
  label: string;
  kinds: readonly ActivityKind[];
}[] = [
  { id: 'applications', label: 'Candidaturas', kinds: ['APPLIED'] },
  {
    id: 'positive',
    label: 'Respostas positivas',
    kinds: ['RESPONSE_POSITIVE', 'OFFER'],
  },
  { id: 'rejected', label: 'Rejeições', kinds: ['REJECTED'] },
  { id: 'interviews', label: 'Entrevistas', kinds: ['INTERVIEW'] },
  {
    id: 'projects',
    label: 'Projetos',
    kinds: ['PROJECT_CREATED', 'PROJECT_UPDATED'],
  },
];

export type SeriesCounts = Record<ReportSeriesId, number>;
export type KindCounts = Record<ActivityKind, number>;

// ── Relatório ───────────────────────────────────────────────────

export interface ReportDay {
  date: string;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** Ainda não chegou (semana atual). */
  future: boolean;
  /** Dia útil, com objetivo diário. */
  active: boolean;
  /** Patamar do objetivo diário; null ao fim de semana ou se não chegou lá. */
  goalTier: GoalTier | null;
  kinds: KindCounts;
  series: SeriesCounts;
  /** Os eventos do dia, pela ordem de ACTIVITY_KINDS. */
  events: ActivityEvent[];
}

export interface WeeklyGoal {
  id: 'applications' | 'goal-days' | 'projects';
  title: string;
  value: number;
  target: number;
  done: boolean;
}

export interface WeeklyReport {
  /** Segunda-feira. */
  start: string;
  /** Domingo. */
  end: string;
  /** A semana de hoje (ainda a decorrer). */
  current: boolean;
  days: ReportDay[];
  kinds: KindCounts;
  series: SeriesCounts;
  /** A semana anterior, para comparar. */
  previous: { kinds: KindCounts; series: SeriesCounts };
  goals: WeeklyGoal[];
  /** O maior valor de uma barra, para a escala do gráfico. */
  peak: number;
}

/**
 * @param events eventos da semana e da anterior (o resto ignora-se)
 * @param start  a segunda-feira da semana
 * @param today  hoje, no fuso do utilizador
 */
export function weeklyReport(
  events: readonly ActivityEvent[],
  start: string,
  today: string,
  goal: GoalDefinition = DAILY_APPLICATIONS_GOAL,
): WeeklyReport {
  const end = addDays(start, 6);
  const prevStart = addDays(start, -7);
  const byDate = new Map<string, ActivityEvent[]>();
  const previousKinds = emptyKinds();

  for (const e of events) {
    if (e.date >= start && e.date <= end) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    } else if (e.date >= prevStart && e.date < start) {
      previousKinds[e.kind]++;
    }
  }

  const order = (k: ActivityKind) => ACTIVITY_KINDS.indexOf(k);
  const days: ReportDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const dayEvents = (byDate.get(date) ?? [])
      .slice()
      .sort((a, b) => order(a.kind) - order(b.kind));
    const kinds = emptyKinds();
    for (const e of dayEvents) kinds[e.kind]++;
    const wd = weekday(date);
    const active = goal.activeWeekdays.includes(wd);
    return {
      date,
      weekday: wd,
      future: date > today,
      active,
      goalTier: active ? tierFor(kinds.APPLIED, goal) : null,
      kinds,
      series: toSeries(kinds),
      events: dayEvents,
    };
  });

  const kinds = emptyKinds();
  for (const d of days) for (const k of ACTIVITY_KINDS) kinds[k] += d.kinds[k];
  const series = toSeries(kinds);

  // Objetivos da semana: o diário vezes os dias úteis, e pelo menos um projeto.
  const activeDays = days.filter((d) => d.active).length;
  const dailyTop = goal.tiers[goal.tiers.length - 1].target;
  const applicationsTarget = dailyTop * activeDays;
  const goalDays = days.filter((d) => d.goalTier !== null).length;
  const goals: WeeklyGoal[] = [
    {
      id: 'applications',
      title: 'Candidaturas na semana',
      value: kinds.APPLIED,
      target: applicationsTarget,
      done: kinds.APPLIED >= applicationsTarget,
    },
    {
      id: 'goal-days',
      title: 'Dias úteis com objetivo cumprido',
      value: goalDays,
      target: activeDays,
      done: goalDays >= activeDays,
    },
    {
      id: 'projects',
      title: 'Projeto novo ou atualizado',
      value: series.projects,
      target: 1,
      done: series.projects >= 1,
    },
  ];

  const peak = Math.max(
    0,
    ...days.flatMap((d) => REPORT_SERIES.map((s) => d.series[s.id])),
  );

  return {
    start,
    end,
    current: today >= start && today <= end,
    days,
    kinds,
    series,
    previous: { kinds: previousKinds, series: toSeries(previousKinds) },
    goals,
    peak,
  };
}

/**
 * Resumo de um dia numa frase: "2 candidaturas · 1 resposta positiva".
 * Vazio se nada aconteceu.
 */
export function describeDay(kinds: KindCounts): string {
  return ACTIVITY_KINDS.filter((k) => kinds[k] > 0)
    .map((k) => {
      const n = kinds[k];
      return `${n} ${n === 1 ? ACTIVITY_LABELS[k].one : ACTIVITY_LABELS[k].many}`;
    })
    .join(' · ');
}

function emptyKinds(): KindCounts {
  return Object.fromEntries(ACTIVITY_KINDS.map((k) => [k, 0])) as KindCounts;
}

function toSeries(kinds: KindCounts): SeriesCounts {
  return Object.fromEntries(
    REPORT_SERIES.map((s) => [
      s.id,
      s.kinds.reduce((sum, k) => sum + kinds[k], 0),
    ]),
  ) as SeriesCounts;
}
