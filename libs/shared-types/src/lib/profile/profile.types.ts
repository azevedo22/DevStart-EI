/** Contratos do Profile & Skill Service: competências, projetos e stacks alvo. */

export type Level = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

export const LEVELS: readonly Level[] = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];

export const LEVEL_LABELS: Record<Level, string> = {
  BASIC: 'Básico',
  INTERMEDIATE: 'Intermédio',
  ADVANCED: 'Avançado',
};

export type CompetencyCategory =
  | 'LANGUAGE'
  | 'FRONTEND'
  | 'BACKEND'
  | 'DATABASE'
  | 'DEVOPS'
  | 'TESTING'
  | 'ARCHITECTURE'
  | 'AI_DATA';

export const CATEGORY_LABELS: Record<CompetencyCategory, string> = {
  LANGUAGE: 'Linguagens',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DATABASE: 'Bases de dados',
  DEVOPS: 'DevOps',
  TESTING: 'Testes',
  ARCHITECTURE: 'Arquitetura',
  AI_DATA: 'IA e Dados',
};

/** Entrada do catálogo. O catálogo não guarda nível. */
export interface Competency {
  id: string; // slug estável, ex: 'angular', 'ci-cd'
  name: string;
  category: CompetencyCategory;
  aliases: string[];
}

/** Competência declarada pelo utilizador (aceite como verdade). */
export interface ProfileCompetency {
  competencyId: string;
  level: Level;
  declaredAt: string;
}

export type ProjectOrigin = 'ACADEMIC' | 'PERSONAL' | 'PROFESSIONAL';

export const PROJECT_ORIGINS: readonly ProjectOrigin[] = [
  'ACADEMIC',
  'PERSONAL',
  'PROFESSIONAL',
];

export const ORIGIN_LABELS: Record<ProjectOrigin, string> = {
  ACADEMIC: 'Académico',
  PERSONAL: 'Pessoal',
  PROFESSIONAL: 'Profissional',
};

export type IndustryPractice =
  'DOCKER' | 'CI_CD' | 'TESTS' | 'CLEAN_ARCHITECTURE' | 'API_DOCS';

export const INDUSTRY_PRACTICES: readonly IndustryPractice[] = [
  'DOCKER',
  'CI_CD',
  'TESTS',
  'CLEAN_ARCHITECTURE',
  'API_DOCS',
];

export const PRACTICE_LABELS: Record<IndustryPractice, string> = {
  DOCKER: 'Docker',
  CI_CD: 'CI/CD',
  TESTS: 'Testes automáticos',
  CLEAN_ARCHITECTURE: 'Clean Architecture',
  API_DOCS: 'Documentação da API',
};

export interface Project {
  id: string;
  title: string;
  description: string;
  repositoryUrl: string | null;
  liveUrl: string | null;
  origin: ProjectOrigin;
  academicContext: string | null; // ex: "TP de Engenharia de Software II, 2025"
  competencyIds: string[];
  practices: IndustryPractice[];
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  userId: string;
  headline: string | null;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  competencies: ProfileCompetency[];
  updatedAt: string;
}

// ── Pedidos de escrita ──────────────────────────────────────────

export interface UpdateProfileRequest {
  headline?: string | null;
  university?: string | null;
  graduationYear?: number | null;
  bio?: string | null;
}

export interface DeclareCompetencyRequest {
  level: Level;
}

export interface SaveProjectRequest {
  title: string;
  description: string;
  repositoryUrl?: string | null;
  liveUrl?: string | null;
  origin: ProjectOrigin;
  academicContext?: string | null;
  competencyIds: string[];
  practices: IndustryPractice[];
}

/** Limites partilhados entre os formulários e a validação do servidor. */
export const PROFILE_LIMITS = {
  headline: 120,
  university: 120,
  bio: 1000,
  projectTitle: 100,
  projectDescription: 2000,
  academicContext: 160,
  url: 300,
  competenciesPerProject: 15,
  projectsPerUser: 50,
  minGraduationYear: 1980,
  maxGraduationYearAhead: 6, // até 6 anos no futuro (estudantes a meio do curso)
} as const;

// ── Stacks alvo ─────────────────────────────────────────────────

export interface StackRequirement {
  competencyId: string;
  minLevel: Level;
  weight: 1 | 2 | 3 | 4 | 5; // 5 = essencial, 1-2 = diferenciador
}

export interface TargetStack {
  id: string;
  title: string;
  description: string;
  requirements: StackRequirement[];
}
