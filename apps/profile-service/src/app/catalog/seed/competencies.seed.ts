/**
 * Taxonomia de competências (seed inicial).
 * - `id` é um slug estável: nunca muda depois de publicado.
 * - O catálogo NÃO guarda nível (pertence a ProfileCompetency e TargetStack).
 * - `aliases` reconhece a competência em texto livre (vagas, pesquisa). Minúsculas.
 */
import { Competency } from '@devstart/shared-types';

export const COMPETENCIES: Competency[] = [
  // ── Linguagens ────────────────────────────────────────────────
  {
    id: 'javascript',
    name: 'JavaScript',
    category: 'LANGUAGE',
    aliases: ['js', 'es6', 'ecmascript'],
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    category: 'LANGUAGE',
    aliases: ['ts'],
  },
  { id: 'python', name: 'Python', category: 'LANGUAGE', aliases: ['py'] },
  {
    id: 'java',
    name: 'Java',
    category: 'LANGUAGE',
    aliases: ['jdk', 'java 17', 'java 21'],
  },
  {
    id: 'csharp',
    name: 'C#',
    category: 'LANGUAGE',
    aliases: ['c#', 'c sharp'],
  },
  {
    id: 'sql',
    name: 'SQL',
    category: 'LANGUAGE',
    aliases: ['t-sql', 'pl/sql'],
  },
  {
    id: 'html-css',
    name: 'HTML & CSS',
    category: 'LANGUAGE',
    aliases: ['html', 'html5', 'css', 'css3', 'scss', 'sass'],
  },

  // ── Frontend ──────────────────────────────────────────────────
  {
    id: 'angular',
    name: 'Angular',
    category: 'FRONTEND',
    aliases: ['angular 17', 'angular 18', 'angular 19'],
  },
  {
    id: 'rxjs',
    name: 'RxJS',
    category: 'FRONTEND',
    aliases: ['reactive extensions', 'observables'],
  },
  {
    id: 'react',
    name: 'React',
    category: 'FRONTEND',
    aliases: ['react.js', 'reactjs'],
  },
  {
    id: 'vue',
    name: 'Vue.js',
    category: 'FRONTEND',
    aliases: ['vue', 'vuejs', 'nuxt'],
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap',
    category: 'FRONTEND',
    aliases: ['bootstrap 5', 'ng-bootstrap'],
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    category: 'FRONTEND',
    aliases: ['tailwind', 'tailwindcss'],
  },
  {
    id: 'responsive-design',
    name: 'Design Responsivo',
    category: 'FRONTEND',
    aliases: ['responsive', 'mobile first'],
  },
  {
    id: 'frontend-state',
    name: 'Gestão de Estado no Frontend',
    category: 'FRONTEND',
    aliases: ['ngrx', 'signals', 'redux', 'pinia'],
  },

  // ── Backend ───────────────────────────────────────────────────
  {
    id: 'nodejs',
    name: 'Node.js',
    category: 'BACKEND',
    aliases: ['node', 'node.js'],
  },
  {
    id: 'nestjs',
    name: 'NestJS',
    category: 'BACKEND',
    aliases: ['nest', 'nest.js'],
  },
  {
    id: 'express',
    name: 'Express',
    category: 'BACKEND',
    aliases: ['express.js', 'expressjs'],
  },
  {
    id: 'spring-boot',
    name: 'Spring Boot',
    category: 'BACKEND',
    aliases: ['spring', 'spring framework'],
  },
  {
    id: 'dotnet',
    name: '.NET',
    category: 'BACKEND',
    aliases: ['.net', 'asp.net', 'asp.net core', 'dotnet core'],
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    category: 'BACKEND',
    aliases: ['fast api'],
  },
  {
    id: 'rest-api',
    name: 'Desenho de APIs REST',
    category: 'BACKEND',
    aliases: ['rest', 'restful', 'api rest', 'openapi', 'swagger'],
  },
  { id: 'graphql', name: 'GraphQL', category: 'BACKEND', aliases: ['apollo'] },
  {
    id: 'auth-jwt',
    name: 'Autenticação e Autorização',
    category: 'BACKEND',
    aliases: ['jwt', 'oauth', 'oauth2', 'openid connect'],
  },

  // ── Bases de dados ────────────────────────────────────────────
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'DATABASE',
    aliases: ['postgres', 'psql'],
  },
  { id: 'mysql', name: 'MySQL', category: 'DATABASE', aliases: ['mariadb'] },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'DATABASE',
    aliases: ['mongo', 'mongoose'],
  },
  { id: 'redis', name: 'Redis', category: 'DATABASE', aliases: ['cache'] },
  {
    id: 'orm',
    name: 'ORMs',
    category: 'DATABASE',
    aliases: [
      'typeorm',
      'prisma',
      'hibernate',
      'jpa',
      'entity framework',
      'sqlalchemy',
    ],
  },

  // ── DevOps ────────────────────────────────────────────────────
  {
    id: 'git',
    name: 'Git',
    category: 'DEVOPS',
    aliases: ['github', 'gitlab', 'bitbucket', 'git flow'],
  },
  {
    id: 'docker',
    name: 'Docker',
    category: 'DEVOPS',
    aliases: ['docker compose', 'containers', 'dockerfile'],
  },
  {
    id: 'ci-cd',
    name: 'CI/CD',
    category: 'DEVOPS',
    aliases: ['github actions', 'gitlab ci', 'jenkins', 'pipelines'],
  },
  {
    id: 'linux',
    name: 'Linux',
    category: 'DEVOPS',
    aliases: ['bash', 'shell', 'ubuntu'],
  },
  {
    id: 'cloud',
    name: 'Cloud',
    category: 'DEVOPS',
    aliases: ['aws', 'azure', 'gcp', 'google cloud'],
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    category: 'DEVOPS',
    aliases: ['k8s'],
  },

  // ── Testes ────────────────────────────────────────────────────
  {
    id: 'unit-testing',
    name: 'Testes Unitários',
    category: 'TESTING',
    aliases: ['jest', 'jasmine', 'vitest', 'junit', 'pytest', 'xunit'],
  },
  {
    id: 'integration-testing',
    name: 'Testes de Integração',
    category: 'TESTING',
    aliases: ['supertest', 'testcontainers'],
  },
  {
    id: 'e2e-testing',
    name: 'Testes End-to-End',
    category: 'TESTING',
    aliases: ['e2e', 'cypress', 'playwright', 'selenium'],
  },

  // ── Arquitetura ───────────────────────────────────────────────
  {
    id: 'clean-architecture',
    name: 'Clean Architecture',
    category: 'ARCHITECTURE',
    aliases: ['hexagonal', 'ports and adapters', 'ddd'],
  },
  {
    id: 'solid',
    name: 'Princípios SOLID',
    category: 'ARCHITECTURE',
    aliases: ['solid'],
  },
  {
    id: 'design-patterns',
    name: 'Design Patterns',
    category: 'ARCHITECTURE',
    aliases: ['padrões de desenho', 'gof'],
  },
  {
    id: 'microservices',
    name: 'Microsserviços',
    category: 'ARCHITECTURE',
    aliases: ['microservices', 'api gateway'],
  },
  {
    id: 'messaging',
    name: 'Mensageria e Eventos',
    category: 'ARCHITECTURE',
    aliases: ['rabbitmq', 'kafka', 'event-driven', 'pub/sub'],
  },

  // ── IA e Dados ────────────────────────────────────────────────
  {
    id: 'llm-integration',
    name: 'Integração de LLMs',
    category: 'AI_DATA',
    aliases: ['llm', 'openai api', 'langchain', 'prompt engineering'],
  },
  {
    id: 'rag',
    name: 'RAG',
    category: 'AI_DATA',
    aliases: [
      'retrieval augmented generation',
      'vector database',
      'embeddings',
    ],
  },
  {
    id: 'data-analysis',
    name: 'Análise de Dados',
    category: 'AI_DATA',
    aliases: ['pandas', 'numpy', 'jupyter'],
  },
  {
    id: 'machine-learning',
    name: 'Machine Learning',
    category: 'AI_DATA',
    aliases: ['ml', 'scikit-learn', 'pytorch', 'tensorflow'],
  },
];
