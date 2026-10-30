/**
 * Percurso do utilizador: formação, experiência e línguas.
 * Normalmente vem do CV (importação com IA), mas também se edita à mão.
 */

export interface Education {
  id: string;
  institution: string;
  degree: string; // ex.: "Licenciatura em Engenharia Informática"
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null; // null = em curso
}

export type ExperienceKind = 'JOB' | 'INTERNSHIP' | 'VOLUNTEER' | 'OTHER';

export const EXPERIENCE_KINDS: readonly ExperienceKind[] = [
  'JOB',
  'INTERNSHIP',
  'VOLUNTEER',
  'OTHER',
];

export const EXPERIENCE_KIND_LABELS: Record<ExperienceKind, string> = {
  JOB: 'Emprego',
  INTERNSHIP: 'Estágio',
  VOLUNTEER: 'Voluntariado',
  OTHER: 'Outra',
};

export interface Experience {
  id: string;
  organization: string;
  role: string;
  kind: ExperienceKind;
  /** Mês no formato AAAA-MM; os CVs raramente têm o dia. */
  startDate: string | null;
  endDate: string | null; // null = atual
  description: string | null;
}

/** Quadro Europeu Comum de Referência, mais língua materna. */
export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'NATIVE';

export const LANGUAGE_LEVELS: readonly LanguageLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'NATIVE',
];

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  A1: 'A1 · Iniciante',
  A2: 'A2 · Elementar',
  B1: 'B1 · Intermédio',
  B2: 'B2 · Intermédio superior',
  C1: 'C1 · Avançado',
  C2: 'C2 · Proficiente',
  NATIVE: 'Língua materna',
};

export interface LanguageSkill {
  language: string; // ex.: "Inglês"
  level: LanguageLevel;
}

export type SaveEducationRequest = Omit<Education, 'id'>;
export type SaveExperienceRequest = Omit<Experience, 'id'>;

/** Mês AAAA-MM (01 a 12). */
export const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const BACKGROUND_LIMITS = {
  institution: 160,
  degree: 160,
  fieldOfStudy: 120,
  organization: 160,
  role: 120,
  experienceDescription: 1500,
  language: 40,
  educationPerUser: 20,
  experiencePerUser: 30,
  languagesPerUser: 15,
  location: 120,
} as const;
