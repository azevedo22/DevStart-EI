import type { WorkMode } from '../applications/application.types';
import type { Accessibility, Seniority } from './job-analysis';

/**
 * Vagas disponíveis de momento, recolhidas do ITJobs.pt e analisadas uma vez
 * (palavras-chave para todas, IA para as mais promissoras). Cada utilizador
 * vê-as filtradas e ordenadas pela compatibilidade com o seu perfil.
 */

/** Distritos do ITJobs.pt (apêndice da API). */
export const JOB_LOCATIONS: readonly { id: number; name: string }[] = [
  { id: 1, name: 'Aveiro' },
  { id: 2, name: 'Açores' },
  { id: 3, name: 'Beja' },
  { id: 4, name: 'Braga' },
  { id: 5, name: 'Bragança' },
  { id: 6, name: 'Castelo Branco' },
  { id: 8, name: 'Coimbra' },
  { id: 9, name: 'Faro' },
  { id: 10, name: 'Évora' },
  { id: 11, name: 'Guarda' },
  { id: 12, name: 'Portalegre' },
  { id: 13, name: 'Leiria' },
  { id: 14, name: 'Lisboa' },
  { id: 15, name: 'Madeira' },
  { id: 16, name: 'Viseu' },
  { id: 17, name: 'Setúbal' },
  { id: 18, name: 'Porto' },
  { id: 20, name: 'Santarém' },
  { id: 21, name: 'Vila Real' },
  { id: 22, name: 'Viana do Castelo' },
  { id: 29, name: 'Internacional' },
];

/** Tipos de contrato do ITJobs.pt. */
export const JOB_CONTRACTS: readonly { id: number; name: string }[] = [
  { id: 2, name: 'Sem termo' },
  { id: 1, name: 'A termo' },
  { id: 3, name: 'Estágio profissional' },
  { id: 5, name: 'Estágio académico' },
  { id: 4, name: 'Prestação de serviços' },
];

/** Uma vaga, como a vê o utilizador. */
export interface JobListing {
  id: string;
  source: 'itjobs';
  title: string;
  companyName: string;
  companyLogo: string | null;
  /** O anúncio original: é para lá que o utilizador vai candidatar-se. */
  url: string;
  locations: string[];
  locationIds: number[];
  workMode: WorkMode | null;
  contractIds: number[];
  /** Início do anúncio, em texto simples (o completo está no ITJobs). */
  summary: string;
  publishedAt: string;
  /** Quando a DevStart EI a viu pela primeira vez. */
  firstSeenAt: string;

  seniority: Seniority;
  yearsRequired: number | null;
  accessibility: Accessibility;
  mislabeledJunior: boolean;
  competencyIds: string[];
  experienceRequirements: string[];
  /** 'ai' se a IA leu o anúncio; 'keywords' se só passou a triagem. */
  analyzedBy: 'ai' | 'keywords';
}

/** A vaga com a comparação com o perfil de quem a vê. */
export interface JobFeedItem extends JobListing {
  matched: string[];
  missing: string[];
  /** % das competências pedidas que o utilizador já tem; null se a vaga não indica nenhuma. */
  matchPercentage: number | null;
  /** Apareceu depois da última visita do utilizador à secção. */
  isNew: boolean;
}

export interface JobFeedQuery {
  /** Distritos (ids do ITJobs). */
  locations?: number[];
  /** Incluir vagas remotas (com ou sem distritos escolhidos). */
  remote?: boolean;
  contracts?: number[];
  /** Stack alvo do Skill Gap: só vagas que pedem competências dela. */
  stackId?: string;
  /** Mostrar também as pouco realistas. */
  includeUnrealistic?: boolean;
}

export interface JobFeedResponse {
  items: JobFeedItem[];
  /** Quantas vagas abertas existem antes dos filtros. */
  totalOpen: number;
  /** A recolha está ligada (há chave do ITJobs). */
  enabled: boolean;
  /** Última recolha bem-sucedida. */
  lastSyncAt: string | null;
}

export interface JobFeedNewCount {
  count: number;
}

export const JOB_FEED_LIMITS = {
  /** Vagas devolvidas por pedido, depois de filtradas e ordenadas. */
  maxItems: 100,
  summaryLength: 400,
} as const;
