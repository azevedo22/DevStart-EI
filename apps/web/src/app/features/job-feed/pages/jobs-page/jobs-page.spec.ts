import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JobFeedItem, JobFeedResponse } from '@devstart/shared-types';
import { of } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApplicationsStore } from '../../../applications/data/applications-store';
import { JobFeedStore, toParams } from '../../data/job-feed-store';
import { ago, toApplication } from '../../job-feed.util';
import { JobsPage } from './jobs-page';

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

describe('JobsPage: Candidatar-me', () => {
  const create = jest.fn();
  let open: jest.SpyInstance;

  const render = () => {
    create.mockReset().mockReturnValue(of({}));
    open = jest.spyOn(window, 'open').mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: JobFeedStore,
          useValue: {
            lastQuery: () => of(null),
            feed: () =>
              of({
                items: [JOB],
                totalOpen: 1,
                enabled: true,
                lastSyncAt: null,
              } satisfies JobFeedResponse),
            markVisited: jest.fn(),
          },
        },
        {
          provide: ApplicationsStore,
          useValue: {
            load: jest.fn(),
            board: signal(null),
            today: signal('2026-10-31'),
            create,
          },
        },
        {
          provide: CatalogApiService,
          useValue: { stacks: signal([]), nameOf: (id: string) => id },
        },
      ],
    });
    const fixture = TestBed.createComponent(JobsPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const click = (label: string) => {
      const btn = [...el.querySelectorAll('button')].find((b) =>
        b.textContent!.includes(label),
      );
      if (!btn) throw new Error(`Sem botão "${label}"`);
      btn.click();
      fixture.detectChanges();
    };
    const text = () => el.textContent!.replace(/\s+/g, ' ');
    return { click, text };
  };

  afterEach(() => open.mockRestore());

  it('abrir o anúncio não regista nenhuma candidatura', () => {
    const { click, text } = render();
    click('Candidatar-me');
    expect(open).toHaveBeenCalledWith(JOB.url, '_blank', 'noopener');
    expect(create).not.toHaveBeenCalled();
    expect(text()).toContain('Concluíste a candidatura no ITJobs.pt?');
  });

  it('só "Sim, regista" cria o cartão em Candidatado', () => {
    const { click } = render();
    click('Candidatar-me');
    click('Sim, regista');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      status: 'APPLIED',
      appliedAt: '2026-10-31',
    });
  });

  it('"Ainda não" fecha a pergunta sem registar', () => {
    const { click, text } = render();
    click('Candidatar-me');
    click('Ainda não');
    expect(create).not.toHaveBeenCalled();
    expect(text()).not.toContain('Concluíste a candidatura');
  });

  it('da pergunta também se pode guardar para depois', () => {
    const { click } = render();
    click('Candidatar-me');
    const box = [
      ...document.querySelectorAll(
        '[aria-label="Confirmar candidatura"] button',
      ),
    ].find((b) =>
      b.textContent!.includes('Guardar para depois'),
    ) as HTMLButtonElement;
    box.click();
    expect(create.mock.calls[0][0]).toMatchObject({ status: 'SAVED' });
  });
});
