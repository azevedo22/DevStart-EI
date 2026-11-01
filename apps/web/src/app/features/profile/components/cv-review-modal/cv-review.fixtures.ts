import { CvDraft, Profile } from '@devstart/shared-types';

/** Dados de teste da revisão do CV: um rascunho e um perfil que já tem algumas coisas. */
export const DRAFT: CvDraft = {
  fields: {
    headline: 'Desenvolvedor Júnior',
    location: 'Braga',
    university: null,
    graduationYear: 2025,
    bio: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
  },
  education: [
    {
      institution: 'Universidade do Minho',
      degree: 'Licenciatura em EI',
      fieldOfStudy: null,
      startYear: 2022,
      endYear: 2025,
    },
  ],
  experience: [],
  languages: [{ language: 'Inglês', level: 'C1' }],
  competencies: [
    { competencyId: 'java', level: 'INTERMEDIATE', evidence: 'Java' },
    { competencyId: 'angular', level: 'BASIC', evidence: 'Angular' },
  ],
  unmatchedSkills: [],
  projects: [],
  source: 'ai',
  analyzedBy: 'Ollama · teste',
  sentToExternalService: false,
  warnings: [],
};

export const PROFILE = {
  headline: 'O meu título',
  location: null,
  competencies: [
    { competencyId: 'angular', level: 'ADVANCED', declaredAt: '' },
  ],
  education: [
    {
      id: '1',
      institution: 'universidade do minho',
      degree: 'Licenciatura em EI',
      fieldOfStudy: null,
      startYear: 2022,
      endYear: 2025,
    },
  ],
  experience: [],
  languages: [],
} as unknown as Profile;
