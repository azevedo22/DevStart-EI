/** Contratos do Application Tracker Service. */

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

export type WorkMode = 'ONSITE' | 'HYBRID' | 'REMOTE';

export interface JobApplication {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  location: string | null;
  workMode: WorkMode;
  status: ApplicationStatus;
  position: number; // ordem dentro da coluna
  requiredCompetencyIds: string[]; // cruza com o Profile Service
  appliedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationRequest {
  companyName: string;
  jobTitle: string;
  jobUrl?: string;
  location?: string;
  workMode: WorkMode;
  requiredCompetencyIds?: string[];
  appliedAt?: string;
  notes?: string;
}

export interface MoveApplicationRequest {
  status: ApplicationStatus;
  position: number;
}

export type InterviewType = 'HR' | 'TECHNICAL' | 'TEST';

export interface Interview {
  id: string;
  applicationId: string;
  type: InterviewType;
  scheduledAt: string | null;
  completed: boolean;
  feedback: InterviewFeedback | null;
}

export interface InterviewFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  strengths: string | null;
  weaknesses: string | null;
  questionsAsked: string[];
  outcome: 'PASSED' | 'FAILED' | 'PENDING';
}

/** Resposta de GET /applications/board */
export type ApplicationBoard = Record<ApplicationStatus, JobApplication[]>;
