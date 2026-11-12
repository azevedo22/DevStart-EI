import { ApplicationExportItem, JobListingText } from '@devstart/shared-types';
import {
  buildExport,
  exportFileName,
  urlsWithoutText,
} from './export-applications';

const item = (
  patch: Partial<ApplicationExportItem> = {},
): ApplicationExportItem => ({
  id: 'a1',
  companyName: 'Lumen Cloud',
  jobTitle: 'Junior Frontend Developer',
  jobUrl: 'https://itjobs.pt/oferta/1',
  status: 'APPLIED',
  appliedAt: '2026-11-10',
  createdAt: '2026-11-10T10:00:00.000Z',
  workMode: 'HYBRID',
  location: 'Porto',
  seniority: 'JUNIOR',
  yearsRequired: null,
  accessibility: 'ACCESSIBLE',
  requiredCompetencyIds: ['angular', 'docker'],
  otherSkills: ['Jira'],
  experienceRequirements: [],
  postingText: null,
  ...patch,
});

const listing = (patch: Partial<JobListingText> = {}): JobListingText => ({
  url: 'https://itjobs.pt/oferta/1',
  title: 'Junior Frontend Developer',
  companyName: 'Lumen Cloud',
  body: 'Texto da vaga nas Vagas.',
  analysisSource: 'ai',
  analyzedAt: '2026-11-01T09:00:00.000Z',
  ...patch,
});

const NAMES: Record<string, string> = { angular: 'Angular', docker: 'Docker' };
const nameOf = (id: string) => NAMES[id] ?? id;
const NOW = new Date('2026-11-12T15:00:00.000Z');

describe('exportar candidaturas', () => {
  it('procura nas Vagas só os links das candidaturas sem texto, sem repetir', () => {
    expect(
      urlsWithoutText([
        item({ id: 'a', postingText: 'já tem' }),
        item({ id: 'b' }),
        item({ id: 'c' }),
        item({ id: 'd', jobUrl: null }),
      ]),
    ).toEqual(['https://itjobs.pt/oferta/1']);
  });

  it('o texto analisado ganha ao das Vagas; sem nenhum, fica null', () => {
    const data = buildExport(
      [
        item({ id: 'analisado', postingText: 'Texto colado.' }),
        item({ id: 'vagas' }),
        item({ id: 'sem', jobUrl: 'https://linkedin.com/jobs/9' }),
      ],
      [listing()],
      new Set(['angular']),
      nameOf,
      NOW,
    );
    expect(
      data.candidaturas.map((c) => [c.anuncio, c.origemDoAnuncio]),
    ).toEqual([
      ['Texto colado.', 'analisado'],
      ['Texto da vaga nas Vagas.', 'vagas'],
      [null, null],
    ]);
    expect(data.candidaturas[1].leituraDaVaga).toEqual({
      fonte: 'ai',
      em: '2026-11-01T09:00:00.000Z',
    });
    expect(data.candidaturas[0].leituraDaVaga).toBeUndefined();
    expect(data).toMatchObject({
      exportadoEm: '2026-11-12T15:00:00.000Z',
      total: 3,
      comAnuncio: 2,
      semAnuncio: 1,
    });
  });

  it('a compatibilidade é a mesma do quadro, com nomes legíveis', () => {
    const [c] = buildExport(
      [item()],
      [],
      new Set(['angular']),
      nameOf,
      NOW,
    ).candidaturas;
    // 1 de 3 (Angular sim; Docker e Jira, fora do catálogo, faltam).
    expect(c.compatibilidade).toEqual({
      percentagem: 33,
      tens: ['Angular'],
      faltam: ['Docker', 'Jira'],
    });
    expect(c.competencias).toEqual(['Angular', 'Docker']);
  });

  it('nome do ficheiro com o dia', () => {
    expect(exportFileName('2026-11-12')).toBe(
      'devstart-candidaturas-2026-11-12.json',
    );
  });
});
