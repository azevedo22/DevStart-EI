/** Contratos do Application Tracker Service. */
import type { Accessibility, Seniority } from '../jobs/job-analysis';

/** Colunas do Kanban, por ordem. */
export const APPLICATION_STATUSES = [
  'APPLIED',
  'TECHNICAL_TEST',
  'HR_INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'OFFER',
  'REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Candidatado',
  TECHNICAL_TEST: 'Teste Técnico',
  HR_INTERVIEW: 'Entrevista RH',
  TECHNICAL_INTERVIEW: 'Entrevista Técnica',
  OFFER: 'Proposta',
  REJECTED: 'Rejeitado',
};

/** Estados finais: o processo acabou, com ou sem sucesso. */
export const CLOSED_STATUSES: readonly ApplicationStatus[] = [
  'OFFER',
  'REJECTED',
];

export type WorkMode = 'ONSITE' | 'HYBRID' | 'REMOTE';

export const WORK_MODES: readonly WorkMode[] = ['ONSITE', 'HYBRID', 'REMOTE'];

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'Presencial',
  HYBRID: 'Híbrido',
  REMOTE: 'Remoto',
};

export interface JobApplication {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  location: string | null;
  workMode: WorkMode;
  status: ApplicationStatus;
  position: number; // ordem dentro da coluna (0 = topo)
  requiredCompetencyIds: string[]; // ids do catálogo do Profile Service
  yearsRequired: number | null;
  /** Que experiência a vaga pede, por palavras do anúncio. */
  experienceRequirements: string[];
  seniority: Seniority;
  /** Calculada pelo servidor a partir de yearsRequired e seniority; nunca enviada pelo cliente. */
  accessibility: Accessibility;
  mislabeledJunior: boolean;
  appliedAt: string; // data (AAAA-MM-DD)
  notes: string | null;
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
  companyName: string;
  jobTitle: string;
  jobUrl?: string | null;
  location?: string | null;
  workMode: WorkMode;
  requiredCompetencyIds: string[];
  yearsRequired?: number | null;
  experienceRequirements?: string[];
  seniority: Seniority;
  appliedAt: string;
  notes?: string | null;
  /** Só na criação: coluna onde a candidatura começa (por omissão, APPLIED). */
  status?: ApplicationStatus;
}

export interface MoveApplicationRequest {
  status: ApplicationStatus;
  position: number;
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
  total: number;
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
  applicationsPerUser: 500,
  interviewsPerApplication: 20,
  questions: 30,
  questionLength: 300,
  feedbackText: 2000,
} as const;
