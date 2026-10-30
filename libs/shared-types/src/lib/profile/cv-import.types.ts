import {
  LanguageSkill,
  SaveEducationRequest,
  SaveExperienceRequest,
} from './background.types';
import { Level, SaveProjectRequest } from './profile.types';

/**
 * Importação do CV em dois passos:
 *
 * 1. POST /profile/cv/analyze (ficheiro) → CvDraft. Nada é gravado.
 * 2. O utilizador revê e escolhe o que quer, e envia POST /profile/cv/import.
 *
 * O ficheiro do CV não é guardado: só os dados que o utilizador aceitar.
 */

export interface CvCompetencySuggestion {
  competencyId: string;
  level: Level;
  /** Termo do CV que levou a esta competência (ex.: "Jest" → testes unitários). */
  evidence: string;
}

export interface CvProfileFields {
  headline: string | null;
  location: string | null;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
}

export interface CvDraft {
  fields: CvProfileFields;
  education: SaveEducationRequest[];
  experience: SaveExperienceRequest[];
  languages: LanguageSkill[];
  competencies: CvCompetencySuggestion[];
  /** Tecnologias do CV que não existem no catálogo (informativo). */
  unmatchedSkills: string[];
  projects: SaveProjectRequest[];
  /**
   * 'ai': lido pelo modelo de linguagem.
   * 'keywords': a IA não estava disponível; só se detetaram competências por palavras-chave.
   */
  source: 'ai' | 'keywords';
  /** Quem leu o CV, ex.: "Ollama · qwen2.5:7b" ou "xAI · grok-…". null sem IA. */
  analyzedBy: string | null;
  /** true se o CV foi enviado para um serviço externo (IA na cloud). */
  sentToExternalService: boolean;
  warnings: string[];
}

/** O que o utilizador escolheu importar. Campos ausentes ficam como estão. */
export interface ImportCvRequest {
  fields?: Partial<CvProfileFields>;
  education?: SaveEducationRequest[];
  experience?: SaveExperienceRequest[];
  languages?: LanguageSkill[];
  competencies?: { competencyId: string; level: Level }[];
  projects?: SaveProjectRequest[];
}

export const CV_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  /** Texto enviado ao modelo: um CV longo raramente passa disto. */
  maxTextChars: 15_000,
  acceptedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  acceptedExtensions: ['.pdf', '.docx'],
} as const;
