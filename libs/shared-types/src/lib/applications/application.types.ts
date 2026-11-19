/** Contratos do Application Tracker Service. */
import type { Accessibility, Seniority } from '../jobs/job-analysis';

/** Colunas do Kanban, por ordem. */
export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'TECHNICAL_TEST',
  'HR_INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'OFFER',
  'REJECTED',
  'NO_RESPONSE',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: 'Por candidatar',
  APPLIED: 'Candidatado',
  TECHNICAL_TEST: 'Teste Técnico',
  HR_INTERVIEW: 'Entrevista RH',
  TECHNICAL_INTERVIEW: 'Entrevista Técnica',
  OFFER: 'Proposta',
  REJECTED: 'Rejeitado',
  NO_RESPONSE: 'Sem resposta',
};

/**
 * Vagas guardadas para depois: ainda não são candidaturas. Não contam para o
 * objetivo diário, o relatório semanal, a taxa de resposta nem os totais.
 * Ao sair desta coluna, a data da candidatura passa a ser esse dia.
 */
export const NOT_APPLIED_STATUSES: readonly ApplicationStatus[] = ['SAVED'];

export function isApplied(status: ApplicationStatus): boolean {
  return !NOT_APPLIED_STATUSES.includes(status);
}

/**
 * Estados finais: o processo acabou, com ou sem sucesso. "Sem resposta" é o
 * silêncio da empresa: não é uma rejeição (não conta como tal no relatório),
 * mas também já não está ativo. Se a empresa responder, o cartão sai daqui.
 */
export const CLOSED_STATUSES: readonly ApplicationStatus[] = [
  'OFFER',
  'REJECTED',
  'NO_RESPONSE',
];

/**
 * Colunas que são uma resposta da empresa: um teste, uma entrevista, uma
 * proposta ou uma rejeição. Conta a coluna onde a candidatura está agora, e não
 * o histórico: um cartão movido por engano e posto de volta não é uma resposta.
 */
export const RESPONSE_STATUSES: readonly ApplicationStatus[] = [
  'TECHNICAL_TEST',
  'HR_INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'OFFER',
  'REJECTED',
];

export function hasResponse(status: ApplicationStatus): boolean {
  return RESPONSE_STATUSES.includes(status);
}

export type WorkMode = 'ONSITE' | 'HYBRID' | 'REMOTE';

export const WORK_MODES: readonly WorkMode[] = ['ONSITE', 'HYBRID', 'REMOTE'];

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'Presencial',
  HYBRID: 'Híbrido',
  REMOTE: 'Remoto',
};

/**
 * Vaga: candidatura a um anúncio. Espontânea: o CV enviado a uma empresa sem
 * vaga aberta; não tem anúncio, por isso não tem competências nem percentagem.
 */
export const APPLICATION_KINDS = ['JOB', 'SPONTANEOUS'] as const;
export type ApplicationKind = (typeof APPLICATION_KINDS)[number];

/** Por onde se enviou uma candidatura espontânea. */
export const SPONTANEOUS_CHANNELS = [
  'EMAIL',
  'LINKEDIN',
  'WEBSITE',
  'IN_PERSON',
] as const;
export type SpontaneousChannel = (typeof SPONTANEOUS_CHANNELS)[number];

export const SPONTANEOUS_CHANNEL_LABELS: Record<SpontaneousChannel, string> = {
  EMAIL: 'E-mail',
  LINKEDIN: 'LinkedIn',
  WEBSITE: 'Formulário do site',
  IN_PERSON: 'Presencialmente',
};

export interface JobApplication {
  id: string;
  kind: ApplicationKind;
  companyName: string;
  /** Na espontânea, a área ou função procurada (pode ficar vazia). */
  jobTitle: string;
  jobUrl: string | null;
  location: string | null;
  workMode: WorkMode;
  status: ApplicationStatus;
  position: number; // ordem dentro da coluna (0 = topo)
  requiredCompetencyIds: string[]; // ids do catálogo do Profile Service
  /**
   * Competências que a vaga pede e não existem no catálogo (ex.: C/C++,
   * microcontroladores). Não se podem declarar no perfil, por isso contam como
   * em falta na compatibilidade: sem elas, uma vaga pareceria 100% compatível.
   */
  otherSkills: string[];
  yearsRequired: number | null;
  /** Que experiência a vaga pede, por palavras do anúncio. */
  experienceRequirements: string[];
  seniority: Seniority;
  /** Calculada pelo servidor a partir de yearsRequired e seniority; nunca enviada pelo cliente. */
  accessibility: Accessibility;
  mislabeledJunior: boolean;
  appliedAt: string; // data (AAAA-MM-DD)
  notes: string | null;
  /** Só nas espontâneas: por onde foi enviada. */
  channel: SpontaneousChannel | null;
  /** Só nas espontâneas: a pessoa ou o e-mail a quem se enviou. */
  contact: string | null;
  /** Só nas espontâneas: dias em que se voltou a enviar (AAAA-MM-DD, por ordem). */
  resentOn: string[];
  interviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChange {
  from: ApplicationStatus | null; // null = criação
  to: ApplicationStatus;
  changedAt: string;
}

export interface JobApplicationDetail extends JobApplication {
  history: StatusChange[];
  interviews: Interview[];
}

export interface SaveApplicationRequest {
  /** Só conta na criação (por omissão, JOB); depois o tipo não muda. */
  kind?: ApplicationKind;
  companyName: string;
  /** Obrigatório nas vagas; opcional nas espontâneas (área ou função). */
  jobTitle?: string;
  jobUrl?: string | null;
  location?: string | null;
  /** Obrigatórios nas vagas; ignorados nas espontâneas. */
  workMode?: WorkMode;
  requiredCompetencyIds?: string[];
  otherSkills?: string[];
  yearsRequired?: number | null;
  experienceRequirements?: string[];
  seniority?: Seniority;
  channel?: SpontaneousChannel | null;
  contact?: string | null;
  appliedAt: string;
  notes?: string | null;
  /**
   * Texto do anúncio que foi analisado com IA. Guarda-se para se poder voltar a
   * medir a leitura da IA (casos de avaliação). Na edição, omitir mantém o atual.
   */
  postingText?: string | null;
  /** Só na criação: coluna onde começa (por omissão, APPLIED; SAVED para guardar para depois). */
  status?: ApplicationStatus;
}

export interface MoveApplicationRequest {
  status: ApplicationStatus;
  position: number;
  /**
   * Ao sair de "Por candidatar": o dia da candidatura no fuso do utilizador
   * (AAAA-MM-DD). Sem ele, o servidor usa o dia de hoje em UTC.
   */
  appliedAt?: string;
}

export type InterviewType = 'HR' | 'TECHNICAL' | 'TEST';

export const INTERVIEW_TYPES: readonly InterviewType[] = [
  'HR',
  'TECHNICAL',
  'TEST',
];

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  HR: 'Entrevista RH',
  TECHNICAL: 'Entrevista técnica',
  TEST: 'Teste técnico',
};

export type InterviewOutcome = 'PASSED' | 'FAILED' | 'PENDING';

export const OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  PASSED: 'Passei',
  FAILED: 'Não passei',
  PENDING: 'À espera de resposta',
};

export interface Interview {
  id: string;
  applicationId: string;
  type: InterviewType;
  scheduledAt: string | null;
  completed: boolean;
  /** Avaliação pessoal de 1 a 5, depois da entrevista. */
  rating: number | null;
  outcome: InterviewOutcome;
  questionsAsked: string[];
  strengths: string | null;
  improvements: string | null;
  createdAt: string;
}

export interface SaveInterviewRequest {
  type: InterviewType;
  scheduledAt?: string | null;
  completed: boolean;
  rating?: number | null;
  outcome: InterviewOutcome;
  questionsAsked: string[];
  strengths?: string | null;
  improvements?: string | null;
}

/** Resposta de GET /applications/board */
export type ApplicationBoard = Record<ApplicationStatus, JobApplication[]>;

/** Resposta de GET /applications/stats */
export interface ApplicationStats {
  /** Candidaturas feitas (sem as vagas guardadas em "Por candidatar"). */
  total: number;
  /** Vagas guardadas para depois. */
  saved: number;
  active: number; // ainda em processo
  byStatus: Record<ApplicationStatus, number>;
  byAccessibility: Record<Accessibility, number>;
  /** Percentagem de candidaturas que passaram da coluna "Candidatado". */
  responseRate: number | null;
  interviews: number;
  offers: number;
}

export const APPLICATION_LIMITS = {
  companyName: 120,
  jobTitle: 150,
  location: 120,
  url: 500,
  notes: 4000,
  competencies: 30,
  /** Tipos de experiência pedidos ("2 anos com APIs REST", "trabalho em equipas Agile"). */
  experienceItems: 10,
  experienceItem: 200,
  /** Competências fora do catálogo ("C/C++", "microcontroladores"). */
  otherSkills: 15,
  otherSkill: 60,
  applicationsPerUser: 500,
  interviewsPerApplication: 20,
  questions: 30,
  questionLength: 300,
  feedbackText: 2000,
  /** Igual ao máximo que a análise de anúncios aceita. */
  postingText: 20_000,
  contact: 200,
  /** Reenvios guardados por candidatura espontânea. */
  resends: 10,
} as const;

// ── Exportação para avaliação (ferramentas de desenvolvimento) ──

/** Uma candidatura com a leitura da IA e o texto do anúncio, quando existe. */
export interface ApplicationExportItem {
  id: string;
  kind: ApplicationKind;
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  status: ApplicationStatus;
  appliedAt: string;
  createdAt: string;
  workMode: WorkMode;
  location: string | null;
  seniority: Seniority;
  yearsRequired: number | null;
  accessibility: Accessibility;
  requiredCompetencyIds: string[];
  otherSkills: string[];
  experienceRequirements: string[];
  /** Texto guardado ao analisar o anúncio (null nas candidaturas antigas). */
  postingText: string | null;
}

/** Texto de uma vaga da página Vagas, procurado pelo link (exportação de avaliação). */
export interface JobListingText {
  url: string;
  title: string;
  companyName: string;
  body: string;
  /** 'ai' se a IA já leu a vaga; 'keywords' se só passou a triagem. */
  analysisSource: string;
  analyzedAt: string | null;
}

export interface JobListingTextsRequest {
  urls: string[];
}

export interface DevToolsStatus {
  /** Exportação de candidaturas ligada (DEV_TOOLS=true no servidor). */
  export: boolean;
}

/** "Reenviei hoje" numa candidatura espontânea. Sem data, conta o dia de hoje. */
export interface ResendApplicationRequest {
  date?: string;
}
