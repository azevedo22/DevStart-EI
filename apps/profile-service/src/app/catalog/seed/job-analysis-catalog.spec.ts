import { analyzeJobPosting } from '@devstart/shared-types';
import { COMPETENCIES } from './competencies.seed';

/**
 * O analisador de vagas contra o catálogo REAL: se alguém acrescentar um alias
 * demasiado genérico ao seed, estes testes apanham os falsos positivos.
 */
describe('análise de vagas com o catálogo real', () => {
  const analyze = (title: string, text: string) =>
    analyzeJobPosting({ title, text }, COMPETENCIES);

  it('anúncio português de frontend júnior', () => {
    const r = analyze(
      'Programador Frontend Júnior',
      `Procuramos recém-licenciados para integrar a nossa equipa.
       Requisitos: Angular, TypeScript e RxJS; HTML e SCSS; consumo de APIs REST; Git.
       Valorizamos testes unitários com Jest e conhecimentos de Docker.`,
    );
    expect(r.accessibility).toBe('ENTRY_FRIENDLY');
    expect(r.yearsRequired).toBe(0);
    expect(r.competencyIds.sort()).toEqual(
      [
        'angular',
        'docker',
        'git',
        'html-css',
        'rest-api',
        'rxjs',
        'typescript',
        'unit-testing',
      ].sort(),
    );
  });

  it('anúncio inglês "junior" com requisitos de pleno', () => {
    const r = analyze(
      'Junior Full Stack Engineer',
      `You'll work with the rest of the team on our Node.js and React platform.
       Requirements: 3+ years of experience with JavaScript, PostgreSQL and AWS.
       A solid understanding of CI/CD (GitHub Actions) and Kubernetes is a plus.`,
    );
    expect(r).toMatchObject({
      seniority: 'JUNIOR',
      yearsRequired: 3,
      accessibility: 'UNREALISTIC',
      mislabeledJunior: true,
    });
    expect(r.competencyIds).toEqual(
      expect.arrayContaining([
        'nodejs',
        'react',
        'javascript',
        'postgresql',
        'cloud',
        'ci-cd',
        'kubernetes',
      ]),
    );
    // "rest of the team" e "solid understanding" não são competências.
    expect(r.competencyIds).not.toContain('rest-api');
    expect(r.competencyIds).not.toContain('solid');
  });

  it('anúncio de IA com RAG', () => {
    const r = analyze(
      'AI Engineer',
      `Desenvolvimento de sistemas RAG com LangChain e embeddings. Python e FastAPI.
       Experiência: 1 a 2 anos. Conhecimentos de Docker.`,
    );
    expect(r.yearsRequired).toBe(1);
    expect(r.accessibility).toBe('ENTRY_FRIENDLY');
    expect(r.competencyIds).toEqual(
      expect.arrayContaining([
        'rag',
        'llm-integration',
        'python',
        'fastapi',
        'docker',
      ]),
    );
  });

  it('não encontra competências num texto sem tecnologia', () => {
    const r = analyze(
      'Assistente Administrativo',
      'Empresa com 20 anos de mercado procura pessoa organizada, com boa comunicação, para gestão de agenda e atendimento.',
    );
    expect(r.competencyIds).toEqual([]);
    expect(r.yearsRequired).toBeNull();
  });
});
