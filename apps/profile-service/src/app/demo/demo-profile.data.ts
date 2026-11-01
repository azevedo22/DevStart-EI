import {
  DeclareCompetencyRequest,
  LanguageSkill,
  SaveEducationRequest,
  SaveExperienceRequest,
  SaveProjectRequest,
  UpdateProfileRequest,
} from '@devstart/shared-types';

const YEAR = new Date().getFullYear();

/**
 * Perfil de exemplo das contas de demonstração ("Experimentar sem registo").
 *
 * Pensado para o diagnóstico da stack "Junior Fullstack — Angular / Node"
 * mostrar os quatro casos: competências com projeto, sem projeto (NestJS, testes),
 * abaixo do nível (REST) e em falta (ORM, JWT, Docker).
 *
 * Os dados são fictícios. Para mostrar um perfil real, basta trocar este ficheiro.
 */
export const DEMO_PROFILE: UpdateProfileRequest = {
  headline: 'Recém-licenciado em Engenharia Informática · Full-stack júnior',
  university: 'Universidade Exemplo',
  graduationYear: YEAR,
  bio:
    'Gosto de construir aplicações web do princípio ao fim. Procuro a primeira ' +
    'oportunidade numa equipa onde possa aprender com pessoas mais experientes. ' +
    '(Perfil de demonstração: os dados são fictícios.)',
};

export const DEMO_COMPETENCIES: (DeclareCompetencyRequest & {
  competencyId: string;
})[] = [
  { competencyId: 'typescript', level: 'INTERMEDIATE' },
  { competencyId: 'angular', level: 'INTERMEDIATE' },
  { competencyId: 'rxjs', level: 'BASIC' },
  { competencyId: 'html-css', level: 'ADVANCED' },
  { competencyId: 'bootstrap', level: 'INTERMEDIATE' },
  { competencyId: 'nodejs', level: 'BASIC' },
  { competencyId: 'nestjs', level: 'BASIC' },
  { competencyId: 'rest-api', level: 'BASIC' },
  { competencyId: 'sql', level: 'INTERMEDIATE' },
  { competencyId: 'postgresql', level: 'INTERMEDIATE' },
  { competencyId: 'git', level: 'INTERMEDIATE' },
  { competencyId: 'unit-testing', level: 'BASIC' },
  { competencyId: 'java', level: 'INTERMEDIATE' },
  { competencyId: 'python', level: 'INTERMEDIATE' },
  { competencyId: 'fastapi', level: 'BASIC' },
  { competencyId: 'llm-integration', level: 'BASIC' },
];

export const DEMO_PROJECTS: SaveProjectRequest[] = [
  {
    title: 'Gestor de despesas partilhadas',
    description:
      'Aplicação web para dividir despesas entre colegas de casa: grupos, saldos ' +
      'e acertos de contas. SPA em Angular com uma API em Node.js e PostgreSQL.',
    repositoryUrl: null,
    liveUrl: null,
    origin: 'PERSONAL',
    academicContext: null,
    competencyIds: [
      'typescript',
      'angular',
      'rxjs',
      'html-css',
      'bootstrap',
      'nodejs',
      'postgresql',
      'git',
    ],
    practices: ['CI_CD'],
  },
  {
    title: 'Plataforma de reserva de salas',
    description:
      'Sistema de reservas de salas de estudo para a biblioteca, feito em grupo ' +
      'de quatro. Backend em Java com base de dados relacional e regras de conflito.',
    repositoryUrl: null,
    liveUrl: null,
    origin: 'ACADEMIC',
    academicContext: 'Engenharia de Software, 3.º ano',
    competencyIds: ['java', 'sql', 'postgresql', 'git', 'html-css'],
    practices: ['CLEAN_ARCHITECTURE'],
  },
  {
    title: 'Assistente de estudo com IA',
    description:
      'API que gera perguntas de revisão a partir dos apontamentos de uma ' +
      'unidade curricular, usando um modelo de linguagem.',
    repositoryUrl: null,
    liveUrl: null,
    origin: 'PERSONAL',
    academicContext: null,
    competencyIds: ['python', 'fastapi', 'llm-integration', 'git'],
    practices: ['API_DOCS'],
  },
];

/** Formação, experiência e línguas: o topo do perfil não fica vazio na demonstração. */
export const DEMO_EDUCATION: SaveEducationRequest[] = [
  {
    institution: 'Universidade Exemplo',
    degree: 'Licenciatura em Engenharia Informática',
    fieldOfStudy: null,
    startYear: YEAR - 3,
    endYear: YEAR,
  },
];

export const DEMO_EXPERIENCE: SaveExperienceRequest[] = [
  {
    organization: 'Serviços de Informática da Universidade Exemplo',
    role: 'Estagiário de desenvolvimento web',
    kind: 'INTERNSHIP',
    startDate: `${YEAR}-02`,
    endDate: `${YEAR}-06`,
    description:
      'Formulários em Angular para o portal dos estudantes e testes com Jest.',
  },
  {
    organization: 'Núcleo de Estudantes de Informática',
    role: 'Organização de workshops',
    kind: 'VOLUNTEER',
    startDate: `${YEAR - 2}-10`,
    endDate: `${YEAR - 1}-06`,
    description: 'Workshops de Git e de introdução à programação web.',
  },
];

export const DEMO_LANGUAGES: LanguageSkill[] = [
  { language: 'Português', level: 'NATIVE' },
  { language: 'Inglês', level: 'C1' },
  { language: 'Espanhol', level: 'B1' },
];
