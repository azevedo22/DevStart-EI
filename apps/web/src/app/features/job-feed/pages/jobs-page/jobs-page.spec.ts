import { JobFeedItem } from '@devstart/shared-types';
import { toParams } from '../../data/job-feed-store';
import { ago, toApplication } from './jobs-page';

const JOB: JobFeedItem = {
  id: 'j1',
  source: 'itjobs',
  title: 'Junior Frontend Developer',
  companyName: 'Lumen Cloud',
  companyLogo: null,
  url: 'https://www.itjobs.pt/oferta/101',
  locations: ['Porto', 'Braga'],
  locationIds: [18, 4],
  workMode: null,
  contractIds: [2],
  summary: 'Procuramos…',
  publishedAt: '2026-10-29T10:00:00Z',
  firstSeenAt: '2026-10-29T10:05:00Z',
  seniority: 'JUNIOR',
  yearsRequired: 0,
  accessibility: 'ENTRY_FRIENDLY',
  mislabeledJunior: false,
  competencyIds: ['angular', 'typescript'],
  experienceRequirements: ['Interfaces com Angular'],
  analyzedBy: 'ai',
  matched: ['angular'],
  missing: ['typescript'],
  matchPercentage: 50,
  isNew: true,
};

describe('toApplication', () => {
  it('leva os dados da vaga para o cartão do Kanban', () => {
    expect(toApplication(JOB, 'SAVED', '2026-10-30')).toEqual({
      companyName: 'Lumen Cloud',
      jobTitle: 'Junior Frontend Developer',
      jobUrl: 'https://www.itjobs.pt/oferta/101',
      location: 'Porto, Braga',
      workMode: 'ONSITE', // não indicado no anúncio
      requiredCompetencyIds: ['angular', 'typescript'],
      yearsRequired: 0,
      experienceRequirements: ['Interfaces com Angular'],
      seniority: 'JUNIOR',
      appliedAt: '2026-10-30',
      notes: 'Vaga encontrada no ITJobs.pt através da DevStart EI.',
      status: 'SAVED',
    });
  });

  it('corta textos maiores do que os limites do cartão', () => {
    const r = toApplication(
      {
        ...JOB,
        title: 'x'.repeat(300),
        companyName: 'y'.repeat(300),
        locations: [],
      },
      'APPLIED',
      '2026-10-30',
    );
    expect(r.jobTitle).toHaveLength(150);
    expect(r.companyName).toHaveLength(120);
    expect(r.location).toBeNull();
  });
});

describe('ago', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  it.each([
    ['2026-10-30T11:59:30Z', 'agora mesmo'],
    ['2026-10-30T11:20:00Z', 'há 40 min'],
    ['2026-10-30T07:00:00Z', 'há 5 h'],
    ['2026-10-29T10:00:00Z', 'ontem'],
    ['2026-10-25T10:00:00Z', 'há 5 dias'],
  ])('%s → %s', (iso, text) => expect(ago(iso, now)).toBe(text));
});

describe('toParams', () => {
  it('só envia os filtros escolhidos, listas separadas por vírgulas', () => {
    expect(
      toParams({
        locations: [4, 18],
        remote: true,
        contracts: [],
        stackId: 'x',
      }).toString(),
    ).toBe('locations=4,18&remote=true&stackId=x');
    expect(toParams({}).toString()).toBe('');
  });
});
