import {
  APPLICATION_STATUSES,
  ApplicationBoard,
  CLOSED_STATUSES,
  JobApplication,
  hasResponse,
  isApplied,
  weekStart,
} from '@devstart/shared-types';

// ── Listas por trás dos números do topo ────────────────────────

export type StatList = 'total' | 'active' | 'responses' | 'interviews';

export const STAT_LISTS: Record<
  StatList,
  { title: string; hint: string; empty: string }
> = {
  total: {
    title: 'Candidaturas',
    hint: 'Todas as vagas a que te candidataste (as guardadas em "Por candidatar" não contam).',
    empty: 'Ainda não te candidataste a nenhuma vaga.',
  },
  active: {
    title: 'Em processo',
    hint: 'Candidaturas ainda em aberto: sem proposta, sem rejeição e sem estarem arquivadas em "Sem resposta".',
    empty: 'Nenhuma candidatura em aberto.',
  },
  responses: {
    title: 'Com resposta',
    hint: 'Contam as que estão agora numa coluna de resposta: teste técnico, entrevista, proposta ou rejeição.',
    empty: 'Ainda nenhuma empresa respondeu. É normal demorar: continua.',
  },
  interviews: {
    title: 'Com entrevistas',
    hint: 'Candidaturas com pelo menos uma entrevista ou teste registado.',
    empty: 'Ainda sem entrevistas registadas.',
  },
};

const newestFirst = (a: JobApplication, b: JobApplication) =>
  b.appliedAt.localeCompare(a.appliedAt) ||
  a.companyName.localeCompare(b.companyName, 'pt');

/** As candidaturas que entram em cada número, das mais recentes para as mais antigas. */
export function statList(
  board: ApplicationBoard | null,
  kind: StatList,
): JobApplication[] {
  if (!board) return [];
  const all = APPLICATION_STATUSES.flatMap((s) => board[s]).filter((a) =>
    isApplied(a.status),
  );
  const keep: Record<StatList, (a: JobApplication) => boolean> = {
    total: () => true,
    active: (a) => !CLOSED_STATUSES.includes(a.status),
    responses: (a) => hasResponse(a.status),
    interviews: (a) => a.interviewCount > 0,
  };
  return all.filter(keep[kind]).sort(newestFirst);
}

// ── "Candidatado": esta semana à vista, as anteriores recolhidas ──

/** Divide uma coluna em candidaturas desta semana e de semanas anteriores (pela ordem da coluna). */
export function splitByWeek(
  cards: JobApplication[],
  today: string,
): { recent: JobApplication[]; older: JobApplication[] } {
  const monday = weekStart(today);
  return {
    recent: cards.filter((c) => c.appliedAt >= monday),
    older: cards.filter((c) => c.appliedAt < monday),
  };
}

/**
 * Posição real numa coluna quando só parte dela está à vista: o cartão fica
 * antes do cartão visível que estava no sítio onde foi largado, ou logo a
 * seguir ao último visível. Sem cartões escondidos, é o próprio índice.
 */
export function realPosition(
  full: JobApplication[],
  shown: JobApplication[],
  movedId: string,
  index: number,
): number {
  if (shown.length === full.length) return index;
  const fullWithout = full.filter((c) => c.id !== movedId);
  const shownWithout = shown.filter((c) => c.id !== movedId);
  const neighbour = shownWithout[index];
  if (neighbour) return fullWithout.findIndex((c) => c.id === neighbour.id);
  const last = shownWithout[shownWithout.length - 1];
  return last ? fullWithout.findIndex((c) => c.id === last.id) + 1 : 0;
}
