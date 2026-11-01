import {
  ApplicationStatus,
  SaveApplicationRequest,
  SaveInterviewRequest,
} from '@devstart/shared-types';

/**
 * Candidaturas de exemplo das contas de demonstração. Empresas fictícias.
 *
 * Cobrem todas as colunas do Kanban e os três tipos de vaga do filtro de
 * acessibilidade, incluindo uma "júnior" que pede 3 anos de experiência e uma
 * candidatura sem resposta há mais de duas semanas (aviso de follow-up).
 */
export interface DemoApplication {
  /** Há quantos dias foi a candidatura (as datas são sempre relativas a hoje). */
  daysAgo: number;
  application: Omit<SaveApplicationRequest, 'appliedAt' | 'status'>;
  /** Colunas por onde passou, por ordem, depois de "Candidatado". */
  path: ApplicationStatus[];
  interviews: (Omit<SaveInterviewRequest, 'scheduledAt'> & {
    /** Dias a partir de hoje: negativo = já aconteceu. */
    inDays: number;
  })[];
}

export const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    daysAgo: 18,
    application: {
      companyName: 'Nimbus Software',
      jobTitle: 'Junior Full-Stack Developer (Angular / Node)',
      location: 'Porto',
      workMode: 'HYBRID',
      requiredCompetencyIds: [
        'typescript',
        'angular',
        'rxjs',
        'nodejs',
        'rest-api',
        'postgresql',
        'git',
      ],
      yearsRequired: 0,
      seniority: 'JUNIOR',
      notes:
        'Equipa de 8 pessoas, produto próprio. Falaram em mentoria nos primeiros meses.',
    },
    path: ['HR_INTERVIEW', 'TECHNICAL_INTERVIEW'],
    interviews: [
      {
        inDays: -9,
        type: 'HR',
        completed: true,
        rating: 4,
        outcome: 'PASSED',
        questionsAsked: [
          'Porque escolheste Engenharia Informática?',
          'Fala-me de um projeto de que te orgulhes.',
          'Como lidas com prazos apertados num trabalho de grupo?',
        ],
        strengths: 'Expliquei bem o gestor de despesas, do problema à solução.',
        improvements: 'Preparar uma pergunta sobre a equipa para o fim.',
      },
      {
        inDays: 3,
        type: 'TECHNICAL',
        completed: false,
        rating: null,
        outcome: 'PENDING',
        questionsAsked: [],
        strengths: null,
        improvements: null,
      },
    ],
  },
  {
    daysAgo: 12,
    application: {
      companyName: 'Serra Labs',
      jobTitle: 'Estágio Profissional — Backend Java',
      location: 'Braga',
      workMode: 'ONSITE',
      requiredCompetencyIds: ['java', 'sql', 'rest-api', 'git', 'spring-boot'],
      yearsRequired: 0,
      seniority: 'INTERN',
      notes:
        'Teste técnico para casa: API de reservas com Spring Boot, 5 dias.',
    },
    path: ['TECHNICAL_TEST'],
    interviews: [],
  },
  {
    daysAgo: 6,
    application: {
      companyName: 'Atlântico Digital',
      jobTitle: 'Frontend Developer',
      location: null,
      workMode: 'REMOTE',
      requiredCompetencyIds: ['angular', 'typescript', 'html-css', 'rxjs'],
      yearsRequired: null,
      seniority: 'UNKNOWN',
      notes: null,
    },
    path: [],
    interviews: [],
  },
  {
    // Sem resposta há mais de duas semanas: mostra o aviso de follow-up.
    daysAgo: 17,
    application: {
      companyName: 'Ribeira Tech',
      jobTitle: 'Junior Backend Developer (Node.js)',
      location: 'Porto',
      workMode: 'HYBRID',
      requiredCompetencyIds: ['nodejs', 'typescript', 'postgresql', 'git'],
      yearsRequired: 0,
      seniority: 'JUNIOR',
      notes: null,
    },
    path: [],
    interviews: [],
  },
  {
    daysAgo: 4,
    application: {
      companyName: 'Vértice Analytics',
      jobTitle: 'Junior AI Engineer',
      location: 'Lisboa',
      workMode: 'HYBRID',
      requiredCompetencyIds: [
        'python',
        'fastapi',
        'llm-integration',
        'rag',
        'docker',
      ],
      yearsRequired: 2,
      seniority: 'JUNIOR',
      notes: 'Pedem 2 anos, mas o projeto do assistente de estudo encaixa bem.',
    },
    path: ['HR_INTERVIEW'],
    interviews: [
      {
        inDays: -1,
        type: 'HR',
        completed: true,
        rating: 3,
        outcome: 'PENDING',
        questionsAsked: ['Que expectativas tens para o primeiro ano?'],
        strengths: null,
        improvements:
          'Falar mais do impacto dos projetos, menos da tecnologia.',
      },
    ],
  },
  {
    daysAgo: 25,
    application: {
      companyName: 'Quadrante Consulting',
      jobTitle: 'Junior Software Engineer',
      location: 'Lisboa',
      workMode: 'ONSITE',
      requiredCompetencyIds: ['java', 'spring-boot', 'microservices', 'cloud'],
      yearsRequired: 3,
      seniority: 'JUNIOR',
      notes:
        'Diz júnior mas pede 3 anos. Responderam com uma mensagem automática.',
    },
    path: ['REJECTED'],
    interviews: [],
  },
  {
    daysAgo: 2,
    application: {
      companyName: 'Lumen Cloud',
      jobTitle: 'Graduate Developer Program',
      location: 'Coimbra',
      workMode: 'HYBRID',
      requiredCompetencyIds: ['git', 'sql', 'linux'],
      yearsRequired: 0,
      seniority: 'JUNIOR',
      notes: null,
    },
    path: [],
    interviews: [],
  },
];
