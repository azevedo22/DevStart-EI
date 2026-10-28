import type { Competency } from '../profile/profile.types';
import {
  analyzeJobPosting,
  classifyAccessibility,
  detectCompetencies,
  detectSeniority,
  detectYearsRequired,
  matchWithProfile,
} from './job-analysis';

const c = (id: string, name: string, aliases: string[] = []): Competency => ({
  id,
  name,
  category: 'BACKEND',
  aliases,
});

const CATALOG: Competency[] = [
  c('javascript', 'JavaScript', ['js']),
  c('java', 'Java'),
  c('csharp', 'C#', ['c#']),
  c('dotnet', '.NET', ['.net', 'asp.net']),
  c('nodejs', 'Node.js', ['node']),
  c('rest-api', 'Desenho de APIs REST', ['rest', 'restful']),
  c('solid', 'Princípios SOLID', ['solid']),
  c('ci-cd', 'CI/CD', ['github actions']),
  c('git', 'Git', ['github']),
  c('redis', 'Redis', ['cache']),
  c('rag', 'RAG', ['vector database']),
  c('express', 'Express', ['express.js']),
  c('spring-boot', 'Spring Boot', ['spring']),
];

describe('detectCompetencies', () => {
  it('encontra competências pelo nome e pelos aliases', () => {
    const ids = detectCompetencies(
      'Procuramos alguém com C#, ASP.NET e pipelines de CI/CD com GitHub Actions.',
      CATALOG,
    );
    expect(ids).toEqual(
      expect.arrayContaining(['csharp', 'dotnet', 'ci-cd', 'git']),
    );
  });

  it('não confunde Java com JavaScript', () => {
    expect(
      detectCompetencies('Experiência com JavaScript moderno.', CATALOG),
    ).toEqual(['javascript']);
  });

  it('não confunde Git com GitHub nem SQL com NoSQL', () => {
    expect(
      detectCompetencies('Conhecimentos de GitLab', CATALOG),
    ).not.toContain('git');
  });

  it.each([
    ['rest of the team', 'rest-api'],
    ['a solid understanding of algorithms', 'solid'],
    ['we express our values', 'express'],
    ['this spring we are hiring', 'spring-boot'],
    ['we cache aggressively', 'redis'],
  ])('ignora palavras comuns: "%s"', (text, id) => {
    expect(detectCompetencies(text, CATALOG)).not.toContain(id);
  });

  it.each([
    ['Design de APIs REST', 'rest-api'],
    ['princípios SOLID', 'solid'],
    ['Node e Express.js', 'express'],
    ['Spring Boot 3', 'spring-boot'],
    ['sistemas RAG com vector database', 'rag'],
  ])('mas reconhece-as escritas como termo técnico: "%s"', (text, id) => {
    expect(detectCompetencies(text, CATALOG)).toContain(id);
  });
});

describe('detectYearsRequired', () => {
  it.each([
    ['Mínimo de 2 anos de experiência em Angular', 2],
    ['3+ years of professional experience', 3],
    ['1 a 3 anos de experiência', 1],
    ['At least 4 years working with Java', 4],
    ['Experiência: 2-4 anos', 2],
  ])('"%s" → %p', (text, years) => {
    expect(detectYearsRequired(text)).toBe(years);
  });

  it('com vários requisitos, fica com o mais exigente', () => {
    expect(
      detectYearsRequired('1+ ano com Git e 3+ anos de experiência com React'),
    ).toBe(3);
  });

  it.each([
    'Não é necessária experiência',
    'Ideal para recém-licenciados',
    'Entry-level position',
    'No prior experience required',
  ])('reconhece que não exige experiência: "%s"', (text) =>
    expect(detectYearsRequired(text)).toBe(0),
  );

  it('ignora números que não falam de experiência', () => {
    expect(
      detectYearsRequired(
        'Empresa com 20 anos de história no mercado. Oferecemos 25 dias de férias.',
      ),
    ).toBeNull();
  });
});

describe('detectSeniority', () => {
  it.each([
    ['Estágio Profissional em Desenvolvimento Web', 'INTERN'],
    ['Junior Frontend Developer', 'JUNIOR'],
    ['Desenvolvedor Júnior .NET', 'JUNIOR'],
    ['Senior Backend Engineer', 'SENIOR'],
    ['Tech Lead', 'SENIOR'],
    ['Mid-level Developer', 'MID'],
    ['Software Engineer', 'UNKNOWN'],
  ])('"%s" → %s', (title, level) => expect(detectSeniority(title)).toBe(level));

  it('o título prevalece sobre o texto', () => {
    expect(
      detectSeniority(
        'Junior Developer',
        'Vais trabalhar com engenheiros seniores.',
      ),
    ).toBe('JUNIOR');
  });

  it('sem nada no título, usa o texto', () => {
    expect(
      detectSeniority('Software Engineer', 'Posição de nível júnior.'),
    ).toBe('JUNIOR');
  });
});

describe('classifyAccessibility', () => {
  it.each([
    [{ yearsRequired: 0, seniority: 'UNKNOWN' as const }, 'ENTRY_FRIENDLY'],
    [{ yearsRequired: 1, seniority: 'JUNIOR' as const }, 'ENTRY_FRIENDLY'],
    [{ yearsRequired: null, seniority: 'INTERN' as const }, 'ENTRY_FRIENDLY'],
    [{ yearsRequired: 2, seniority: 'JUNIOR' as const }, 'STRETCH'],
    [{ yearsRequired: null, seniority: 'MID' as const }, 'STRETCH'],
    [{ yearsRequired: 3, seniority: 'UNKNOWN' as const }, 'UNREALISTIC'],
    [{ yearsRequired: null, seniority: 'SENIOR' as const }, 'UNREALISTIC'],
    [{ yearsRequired: null, seniority: 'UNKNOWN' as const }, 'UNKNOWN'],
  ])('%p → %s', (input, expected) => {
    expect(classifyAccessibility(input).accessibility).toBe(expected);
  });

  it('assinala vagas "júnior" que pedem 3+ anos', () => {
    const v = classifyAccessibility({ yearsRequired: 3, seniority: 'JUNIOR' });
    expect(v).toMatchObject({
      accessibility: 'UNREALISTIC',
      mislabeledJunior: true,
    });
    expect(v.reasons.join(' ')).toMatch(/não são de júnior/);
  });

  it('explica sempre a decisão', () => {
    expect(
      classifyAccessibility({ yearsRequired: 2, seniority: 'UNKNOWN' }).reasons
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('analyzeJobPosting', () => {
  it('junta tudo num anúncio realista', () => {
    const r = analyzeJobPosting(
      {
        title: 'Junior Backend Developer (.NET)',
        text: 'Requisitos: C# e ASP.NET; APIs REST; Git. Mínimo de 3 anos de experiência profissional.',
      },
      CATALOG,
    );
    expect(r.seniority).toBe('JUNIOR');
    expect(r.yearsRequired).toBe(3);
    expect(r.accessibility).toBe('UNREALISTIC');
    expect(r.mislabeledJunior).toBe(true);
    expect(r.competencyIds).toEqual(
      expect.arrayContaining(['csharp', 'dotnet', 'rest-api', 'git']),
    );
  });
});

describe('matchWithProfile', () => {
  it('calcula o que já tens e o que falta', () => {
    expect(
      matchWithProfile(
        ['angular', 'docker', 'git', 'rxjs'],
        new Set(['angular', 'git']),
      ),
    ).toEqual({
      matched: ['angular', 'git'],
      missing: ['docker', 'rxjs'],
      percentage: 50,
    });
  });

  it('sem competências na vaga, não inventa uma percentagem', () => {
    expect(matchWithProfile([], new Set(['angular'])).percentage).toBeNull();
  });
});
