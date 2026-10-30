import type { WorkMode } from '../applications/application.types';
import type { Seniority } from './job-analysis';

/** Limites da análise de um anúncio colado pelo utilizador. */
export const JOB_POSTING_LIMITS = {
  minText: 40,
  /** Um anúncio longo tem 5–8 mil caracteres; 20 mil chega com folga. */
  maxText: 20_000,
} as const;

export interface AnalyzeJobPostingRequest {
  text: string;
}

/**
 * O que a análise do anúncio encontrou, para preencher o formulário da
 * candidatura. Nada é gravado: o utilizador revê e guarda.
 */
export interface JobPostingDraft {
  /** 'ai' se a IA leu o anúncio; 'keywords' se foi só por palavras-chave. */
  source: 'ai' | 'keywords';
  /** Quem leu, ex.: "Groq · openai/gpt-oss-20b"; null sem IA. */
  analyzedBy: string | null;
  /** O texto foi enviado para um serviço externo. */
  sentToExternalService: boolean;
  /** Avisos para o utilizador (ex.: a IA não respondeu). */
  warnings: string[];

  companyName: string | null;
  jobTitle: string | null;
  seniority: Seniority;
  yearsRequired: number | null;
  /** Tipos de experiência pedidos, curtos e pelas palavras do anúncio. */
  experienceRequirements: string[];
  /** Competências do catálogo. */
  competencyIds: string[];
  /** Pedidas no anúncio mas sem correspondência no catálogo (só para mostrar). */
  otherSkills: string[];
  workMode: WorkMode | null;
  location: string | null;
}
