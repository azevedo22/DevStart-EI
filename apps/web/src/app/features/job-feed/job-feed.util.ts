import {
  APPLICATION_LIMITS,
  ApplicationStatus,
  JOB_LOCATIONS,
  JobFeedItem,
  JobFeedQuery,
  SENIORITY_LABELS,
  SaveApplicationRequest,
} from '@devstart/shared-types';

/** Os distritos mais procurados aparecem primeiro na lista. */
const MAIN_LOCATIONS = [18, 14, 4, 8, 1];

/** Os locais pela ordem do filtro: os principais primeiro, depois os outros. */
export const ORDERED_LOCATIONS = [
  ...JOB_LOCATIONS.filter((l) => MAIN_LOCATIONS.includes(l.id)).sort(
    (a, b) => MAIN_LOCATIONS.indexOf(a.id) - MAIN_LOCATIONS.indexOf(b.id),
  ),
  ...JOB_LOCATIONS.filter((l) => !MAIN_LOCATIONS.includes(l.id)),
];

/** "há 3 dias", "hoje", "ontem". */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return minutes <= 1 ? 'agora mesmo' : `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  return days < 30 ? `há ${days} dias` : `há ${Math.floor(days / 30)} meses`;
}

/** O cartão do Kanban a partir de uma vaga do feed. */
export function toApplication(
  job: JobFeedItem,
  status: ApplicationStatus,
  today: string,
): SaveApplicationRequest {
  return {
    companyName: job.companyName.slice(0, APPLICATION_LIMITS.companyName),
    jobTitle: job.title.slice(0, APPLICATION_LIMITS.jobTitle),
    jobUrl: job.url,
    location:
      job.locations.join(', ').slice(0, APPLICATION_LIMITS.location) || null,
    workMode: job.workMode ?? 'ONSITE',
    requiredCompetencyIds: job.competencyIds.slice(
      0,
      APPLICATION_LIMITS.competencies,
    ),
    otherSkills: (job.otherSkills ?? []).slice(
      0,
      APPLICATION_LIMITS.otherSkills,
    ),
    yearsRequired: job.yearsRequired,
    experienceRequirements: job.experienceRequirements.slice(
      0,
      APPLICATION_LIMITS.experienceItems,
    ),
    seniority: job.seniority,
    appliedAt: today,
    notes: 'Vaga encontrada no ITJobs.pt através da DevStart EI.',
    status,
  };
}

/** "Júnior · sem experiência", "Estágio", "2+ anos de experiência". */
export function levelText(j: JobFeedItem): string {
  const parts: string[] = [];
  if (j.seniority !== 'UNKNOWN') parts.push(SENIORITY_LABELS[j.seniority]);
  if (j.yearsRequired !== null)
    parts.push(
      j.yearsRequired === 0
        ? 'sem experiência'
        : `${j.yearsRequired}+ anos de experiência`,
    );
  return parts.join(' · ');
}

/** Há algum filtro escolhido? */
export function filtersActive(q: JobFeedQuery): boolean {
  return !!(
    q.locations?.length ||
    q.remote ||
    q.contracts?.length ||
    q.stackId ||
    q.includeUnrealistic
  );
}

/** Tira os filtros vazios: a query guardada e o pedido ficam limpos. */
export function compact(q: JobFeedQuery): JobFeedQuery {
  const out: JobFeedQuery = {};
  if (q.locations?.length)
    out.locations = [...q.locations].sort((a, b) => a - b);
  if (q.remote) out.remote = true;
  if (q.contracts?.length)
    out.contracts = [...q.contracts].sort((a, b) => a - b);
  if (q.stackId) out.stackId = q.stackId;
  if (q.includeUnrealistic) out.includeUnrealistic = true;
  return out;
}
