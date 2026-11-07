/**
 * Stacks alvo (seed inicial). Referencia os ids de competencies.seed.ts.
 * Peso 5 = essencial, 3 = frequente, 1-2 = diferenciador.
 * Níveis pensados para 0 anos de experiência: ADVANCED não é pedido a juniores.
 */
import { TargetStack } from '@devstart/shared-types';

export const TARGET_STACKS: TargetStack[] = [
  {
    id: 'junior-fullstack-angular-node',
    title: 'Junior Fullstack Developer (Angular / Node)',
    description:
      'SPA em Angular com backend Node.js/NestJS e base de dados relacional.',
    requirements: [
      { competencyId: 'typescript', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'angular', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'rxjs', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'html-css', minLevel: 'INTERMEDIATE', weight: 3 },
      { competencyId: 'nodejs', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'nestjs', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'rest-api', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'postgresql', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'orm', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'auth-jwt', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'git', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'unit-testing', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'docker', minLevel: 'BASIC', weight: 2 },
    ],
  },
  {
    id: 'junior-backend-java-spring',
    title: 'Junior Backend Developer (Java / Spring)',
    description:
      'APIs REST em Spring Boot com persistência JPA, comum em consultoras e banca.',
    requirements: [
      { competencyId: 'java', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'spring-boot', minLevel: 'BASIC', weight: 5 },
      { competencyId: 'rest-api', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'sql', minLevel: 'INTERMEDIATE', weight: 4 },
      { competencyId: 'postgresql', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'orm', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'git', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'unit-testing', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'docker', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'solid', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'design-patterns', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'microservices', minLevel: 'BASIC', weight: 1 },
    ],
  },
  {
    id: 'junior-frontend-react',
    title: 'Junior Frontend Developer (React)',
    description:
      'Interfaces web em React com TypeScript, consumo de APIs e foco em UX.',
    requirements: [
      { competencyId: 'javascript', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'typescript', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'react', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'html-css', minLevel: 'INTERMEDIATE', weight: 5 },
      {
        competencyId: 'responsive-design',
        minLevel: 'INTERMEDIATE',
        weight: 4,
      },
      { competencyId: 'frontend-state', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'rest-api', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'git', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'unit-testing', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'e2e-testing', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'tailwind', minLevel: 'BASIC', weight: 2 },
    ],
  },
  {
    id: 'junior-ai-engineer',
    title: 'Junior AI Engineer (Python / LLMs)',
    description: 'Aplicações com LLMs e RAG servidas por APIs Python.',
    requirements: [
      { competencyId: 'python', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'llm-integration', minLevel: 'BASIC', weight: 5 },
      { competencyId: 'rag', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'fastapi', minLevel: 'BASIC', weight: 4 },
      { competencyId: 'rest-api', minLevel: 'INTERMEDIATE', weight: 4 },
      { competencyId: 'data-analysis', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'git', minLevel: 'INTERMEDIATE', weight: 5 },
      { competencyId: 'docker', minLevel: 'BASIC', weight: 3 },
      { competencyId: 'postgresql', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'machine-learning', minLevel: 'BASIC', weight: 2 },
      { competencyId: 'unit-testing', minLevel: 'BASIC', weight: 2 },
    ],
  },
];
