/** Contratos do Profile & Skill Service: competências, projetos e stacks alvo. */

export type Level = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

export const LEVELS: readonly Level[] = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];

export type CompetencyCategory =
  | 'LANGUAGE'
  | 'FRONTEND'
  | 'BACKEND'
  | 'DATABASE'
  | 'DEVOPS'
  | 'TESTING'
  | 'ARCHITECTURE'
  | 'AI_DATA';

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

export type IndustryPractice =
  'DOCKER' | 'CI_CD' | 'TESTS' | 'CLEAN_ARCHITECTURE' | 'API_DOCS';

export interface Project {
  id: string;
  userId: string;
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
  headline: string;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  competencies: ProfileCompetency[];
  updatedAt: string;
}

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
