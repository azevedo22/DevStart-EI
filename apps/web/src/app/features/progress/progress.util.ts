import {
  ActivityEvent,
  InterviewType,
  ReportSeriesId,
  STATUS_LABELS,
  WeeklyReport,
} from '@devstart/shared-types';

/** "segunda-feira, 26 de out." */
export function longDay(date: string): string {
  const text = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "26 de out." */
export function shortDate(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Uma linha por evento, para a lista do dia. */
export function describeEvent(e: ActivityEvent): {
  icon: string;
  text: string;
} {
  const job = e.jobTitle ? ` (${e.jobTitle})` : '';
  switch (e.kind) {
    case 'APPLIED':
      return { icon: 'bi-send', text: `Candidatura: ${e.subject}${job}` };
    case 'RESPONSE_POSITIVE':
      return {
        icon: 'bi-hand-thumbs-up',
        text: `Resposta positiva: ${e.subject} passou a ${e.status ? STATUS_LABELS[e.status] : 'outra fase'}`,
      };
    case 'OFFER':
      return { icon: 'bi-trophy', text: `Proposta: ${e.subject}${job}` };
    case 'REJECTED':
      return { icon: 'bi-x-circle', text: `Rejeição: ${e.subject}${job}` };
    case 'INTERVIEW_SCHEDULED': {
      const when = e.at
        ? new Intl.DateTimeFormat('pt-PT', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(e.at))
        : null;
      return {
        icon: 'bi-calendar-plus',
        text: `Entrevista marcada: ${e.subject}${typeLabel(e)}${when ? `, ${when}` : ''}`,
      };
    }
    case 'INTERVIEW':
      return {
        icon: 'bi-people',
        text: `${e.round ? `${e.round}.ª entrevista` : 'Entrevista'}: ${e.subject}${typeLabel(e)}`,
      };
    case 'PROJECT_CREATED':
      return { icon: 'bi-plus-square', text: `Projeto novo: ${e.subject}` };
    case 'PROJECT_UPDATED':
      return {
        icon: 'bi-arrow-repeat',
        text: `Projeto atualizado: ${e.subject}`,
      };
  }
}

const INTERVIEW_SHORT: Record<InterviewType, string> = {
  HR: 'RH',
  TECHNICAL: 'técnica',
  TEST: 'teste técnico',
};

function typeLabel(e: ActivityEvent): string {
  return e.interviewType ? ` (${INTERVIEW_SHORT[e.interviewType]})` : '';
}

/**
 * Pontos para refletir no fim da semana: frases curtas tiradas dos números,
 * sem julgamentos. A semana a decorrer só tem estas notas ao fim de semana.
 */
export function reflections(r: WeeklyReport): string[] {
  const out: string[] = [];
  const apps = r.goals.find((g) => g.id === 'applications');
  const days = r.goals.find((g) => g.id === 'goal-days');
  if (!apps || !days) return out;

  if (apps.done) {
    out.push(`Objetivo da semana cumprido: ${apps.value} candidaturas.`);
  } else if (apps.value > 0) {
    const missing = apps.target - apps.value;
    out.push(
      `${apps.value} de ${apps.target} candidaturas: ${missing === 1 ? 'faltou 1' : `faltaram ${missing}`} para o objetivo da semana.`,
    );
  } else {
    out.push(
      'Nenhuma candidatura esta semana. Para a próxima, começa com 1 por dia útil.',
    );
  }

  if (days.value > 0 && !days.done)
    out.push(
      `Cumpriste o objetivo diário em ${days.value} de ${days.target} dias úteis.`,
    );

  const best = r.days
    .filter((d) => d.series.applications > 0)
    .sort((a, b) => b.series.applications - a.series.applications)[0];
  if (best && r.series.applications > 1)
    out.push(
      `O dia mais produtivo foi ${longDay(best.date).split(',')[0].toLowerCase()}, com ${best.series.applications} ${best.series.applications === 1 ? 'candidatura' : 'candidaturas'}.`,
    );

  if (r.series.positive > 0)
    out.push(
      `${r.series.positive === 1 ? 'Tiveste 1 resposta positiva' : `Tiveste ${r.series.positive} respostas positivas`}: prepara as próximas fases.`,
    );
  if (r.series.rejected > 0)
    out.push(
      `${r.series.rejected === 1 ? '1 rejeição' : `${r.series.rejected} rejeições`}: faz parte. Vê se há competências em comum nessas vagas.`,
    );
  if (r.series.projects === 0)
    out.push(
      'Nenhum projeto mexido: uma melhoria pequena num projeto também mostra trabalho.',
    );
  return out;
}

/** "+2 face à semana anterior", "igual à semana anterior". */
export function delta(r: WeeklyReport, id: ReportSeriesId): string {
  const diff = r.series[id] - r.previous.series[id];
  if (diff === 0) return 'igual à semana anterior';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} face à semana anterior`;
}

/** Percentagem para uma barra de progresso, nunca acima de 100. */
export function percent(value: number, target: number): number {
  return target ? Math.min(100, (value / target) * 100) : 0;
}
