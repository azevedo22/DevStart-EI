import { COMPETENCIES } from '../catalog/seed/competencies.seed';
import {
  findLinks,
  keywordOnlyDraft,
  normalizeCvExtraction,
} from './cv-normalize';

const CV_TEXT = `Tiago Fernandes
linkedin.com/in/tiago-exemplo · github.com/tiagof-exemplo
Competências: Java, Spring Boot, Angular, PostgreSQL, Git, Docker`;

/** Resposta típica de um modelo local: quase certa, com alguns deslizes. */
const MESSY = {
  headline: '  Desenvolvedor   Full-Stack Júnior ',
  location: 'Braga, Portugal',
  summary: 'Recém-licenciado com interesse em desenvolvimento web.',
  linkedinUrl: 'linkedin.com/in/tiago-exemplo',
  githubUrl: 'N/A',
  portfolioUrl: 'javascript:alert(1)',
  education: [
    {
      institution: 'Universidade do Minho',
      degree: 'Licenciatura em Engenharia Informática',
      fieldOfStudy: null,
      startYear: 2025, // trocado com o fim
      endYear: 2022,
    },
    {
      institution: 'Escola Secundária Exemplo',
      degree: 'Curso Profissional de Programação',
      startYear: '2019',
      endYear: 2022,
    },
    {
      institution: '',
      degree: 'Sem instituição',
      startYear: null,
      endYear: null,
    },
  ],
  experience: [
    {
      organization: 'Empresa Exemplo',
      role: 'Estagiário',
      kind: 'INTERNSHIP',
      startDate: '02/2025',
      endDate: '2025-6',
      description: 'Angular e Spring Boot.',
    },
    {
      organization: 'Associação Exemplo',
      role: 'Monitor',
      kind: 'VOLUNTARIO', // fora do enum
      startDate: '2023',
      endDate: 'presente',
      description: null,
    },
  ],
  languages: [
    { language: 'Português', level: 'NATIVE' },
    { language: 'Inglês', level: 'C1' },
    { language: 'inglês', level: 'B2' },
    { language: 'Alemão', level: 'fluente' },
  ],
  skills: [
    { name: 'Java', level: 'INTERMEDIATE' },
    { name: 'Spring Boot', level: 'INTERMEDIATE' },
    { name: 'Angular', level: 'ADVANCED' },
    { name: 'Figma', level: 'BASIC' },
    { name: 'Scrum', level: 'SUPER' },
  ],
  projects: [
    {
      title: 'Gestor de Tarefas',
      description: 'Aplicação web em React e Node.js com MongoDB.',
      technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'JWT', 'Docker'],
      repositoryUrl: 'https://github.com/tiagof-exemplo/tarefas',
      academic: false,
    },
    { title: 'API', description: 'curto', technologies: [], academic: true },
    {
      title: 'X',
      description: 'título curto demais',
      technologies: [],
      academic: false,
    },
  ],
};

describe('normalizeCvExtraction', () => {
  const draft = normalizeCvExtraction(MESSY, CV_TEXT, COMPETENCIES);

  it('limpa o texto e preenche instituição e ano a partir da formação superior', () => {
    expect(draft.fields).toMatchObject({
      headline: 'Desenvolvedor Full-Stack Júnior',
      location: 'Braga, Portugal',
      university: 'Universidade do Minho',
      graduationYear: 2025,
    });
  });

  it('corrige links sem protocolo, recusa os perigosos e recupera os do texto', () => {
    expect(draft.fields.linkedinUrl).toBe(
      'https://linkedin.com/in/tiago-exemplo',
    );
    // O modelo disse "N/A", mas o link está no CV.
    expect(draft.fields.githubUrl).toBe('https://github.com/tiagof-exemplo');
    expect(draft.fields.portfolioUrl).toBeNull();
  });

  it('descarta formação sem instituição e acerta anos trocados', () => {
    expect(draft.education).toHaveLength(2);
    expect(draft.education[0]).toMatchObject({
      startYear: 2022,
      endYear: 2025,
    });
    expect(draft.education[1].startYear).toBe(2019);
  });

  it('normaliza datas para AAAA-MM e tipos desconhecidos para OTHER', () => {
    expect(draft.experience[0]).toMatchObject({
      startDate: '2025-02',
      endDate: '2025-06',
      kind: 'INTERNSHIP',
    });
    expect(draft.experience[1]).toMatchObject({
      kind: 'OTHER',
      startDate: '2023-01',
      endDate: null,
    });
  });

  it('línguas sem repetidas e só com níveis válidos', () => {
    expect(draft.languages).toEqual([
      { language: 'Português', level: 'NATIVE' },
      { language: 'Inglês', level: 'C1' },
    ]);
  });

  it('mapeia tecnologias para o catálogo e guarda as que não existem', () => {
    const levels = Object.fromEntries(
      draft.competencies.map((c) => [c.competencyId, c.level]),
    );
    expect(levels).toMatchObject({
      java: 'INTERMEDIATE',
      'spring-boot': 'INTERMEDIATE',
      angular: 'ADVANCED',
      postgresql: 'BASIC', // só no texto do CV
      react: 'BASIC', // só nas tecnologias de um projeto
    });
    expect(draft.unmatchedSkills).toEqual(expect.arrayContaining(['Figma']));
    expect(Object.values(levels)).not.toContain('SUPER');
  });

  it('projetos: competências do catálogo, práticas deduzidas, e descrição mínima', () => {
    const [tarefas, curto] = draft.projects;
    expect(tarefas.competencyIds).toEqual(
      expect.arrayContaining([
        'react',
        'nodejs',
        'express',
        'mongodb',
        'docker',
      ]),
    );
    expect(tarefas.practices).toEqual(['DOCKER']);
    expect(tarefas.origin).toBe('PERSONAL');
    expect(curto.origin).toBe('ACADEMIC');
    expect(curto.description.length).toBeGreaterThanOrEqual(10);
    // Título com menos de 2 caracteres não passaria na API: fica de fora.
    expect(draft.projects).toHaveLength(2);
  });

  it('não rebenta com respostas absurdas', () => {
    for (const raw of [
      null,
      'texto',
      [],
      { education: 'x', skills: [1, null] },
    ]) {
      const d = normalizeCvExtraction(raw, '', COMPETENCIES);
      expect(d.education).toEqual([]);
      expect(d.warnings.length).toBeGreaterThan(0);
    }
  });
});

describe('sem IA', () => {
  it('deteta competências e links só por palavras-chave, e explica porquê', () => {
    const d = keywordOnlyDraft(CV_TEXT, COMPETENCIES, 'Ollama parado.');
    expect(d.source).toBe('keywords');
    expect(d.competencies.map((c) => c.competencyId)).toEqual(
      expect.arrayContaining(['java', 'angular', 'docker']),
    );
    expect(d.fields.linkedinUrl).toBe('https://linkedin.com/in/tiago-exemplo');
    expect(d.warnings[0]).toMatch(/^Ollama parado\./);
  });

  it('findLinks ignora páginas do próprio GitHub', () => {
    expect(findLinks('veja github.com/features').githubUrl).toBeNull();
  });
});
