import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { JobPostingDraft } from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Subject } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { ApplicationsStore } from '../../data/applications-store';
import { JobPostingApi } from '../../data/job-posting-api';
import { ApplicationFormModal } from './application-form-modal';

const POSTING =
  'Junior Frontend Developer na Lumen Cloud, Braga. Angular, TypeScript, Git.';

const draft = (patch: Partial<JobPostingDraft> = {}): JobPostingDraft => ({
  source: 'ai',
  analyzedBy: 'Groq · modelo',
  sentToExternalService: true,
  warnings: [],
  companyName: 'Lumen Cloud',
  jobTitle: 'Junior Frontend Developer',
  seniority: 'JUNIOR',
  yearsRequired: 0,
  experienceRequirements: ['Trabalho em equipas ágeis (Scrum)'],
  competencyIds: ['angular', 'typescript'],
  otherSkills: ['Figma'],
  workMode: 'HYBRID',
  location: 'Braga',
  ...patch,
});

describe('ApplicationFormModal: análise do anúncio', () => {
  let response: Subject<JobPostingDraft>;
  const analyze = jest.fn();

  const render = () => {
    response = new Subject<JobPostingDraft>();
    analyze.mockReset().mockReturnValue(response);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NgbActiveModal,
          useValue: { close: jest.fn(), dismiss: jest.fn() },
        },
        { provide: JobPostingApi, useValue: { analyze } },
        { provide: ApplicationsStore, useValue: {} },
        {
          provide: ProfileStore,
          useValue: {
            declaredIds: signal(new Set(['angular'])),
            cvReader$: of({ label: 'Groq · modelo', externalProvider: 'Groq' }),
          },
        },
        {
          provide: CatalogApiService,
          useValue: {
            competencies: signal([]),
            nameOf: (id: string) => id,
            search: () => [],
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApplicationFormModal);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => {
      fixture.detectChanges();
      return el.textContent!.replace(/\s+/g, ' ');
    };
    const paste = (value: string) => {
      const area = el.querySelector(
        'textarea[aria-label="Texto do anúncio"]',
      ) as HTMLTextAreaElement;
      area.value = value;
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const clickAnalyze = () => {
      const btn = [...el.querySelectorAll('button')].find((b) =>
        b.textContent!.includes('Analisar'),
      )!;
      btn.click();
      fixture.detectChanges();
    };
    const input = (id: string) =>
      (el.querySelector(`#${id}`) as HTMLInputElement).value;
    return { fixture, el, text, paste, clickAnalyze, input };
  };

  it('avisa para onde vai o texto antes de analisar', () => {
    const { text } = render();
    expect(text()).toContain('O texto é enviado para a Groq');
  });

  it('não envia um texto curto demais', () => {
    const { paste, clickAnalyze, text } = render();
    paste('Vaga júnior');
    clickAnalyze();
    expect(analyze).not.toHaveBeenCalled();
    expect(text()).toContain('Cola primeiro o texto completo do anúncio');
  });

  it('preenche empresa, título, senioridade, anos, experiência e competências', () => {
    const { paste, clickAnalyze, text, input } = render();
    paste(POSTING);
    clickAnalyze();
    expect(analyze).toHaveBeenCalledWith(POSTING);
    expect(text()).toContain('A analisar');

    response.next(draft());
    response.complete();

    expect(input('companyName')).toBe('Lumen Cloud');
    expect(input('jobTitle')).toBe('Junior Frontend Developer');
    expect(
      (document.querySelector('#seniority') as HTMLSelectElement).value,
    ).toBe('JUNIOR');
    expect(input('yearsRequired')).toBe('0');
    expect(input('location')).toBe('Braga');
    const t = text();
    expect(t).toContain('Trabalho em equipas ágeis (Scrum)');
    expect(t).toContain('angular');
    expect(t).toContain('typescript');
    expect(t).toContain('Também pede (fora do catálogo): Figma.');
    expect(t).toContain(
      'Preenchido: empresa, título, senioridade, anos, experiência, 2 competências.',
    );
  });

  it('sem IA, mostra o aviso e não apaga o que já estava escrito', () => {
    const { paste, clickAnalyze, text, input, fixture } = render();
    fixture.componentInstance['form'].controls.companyName.setValue(
      'Escrita à mão',
    );
    paste(POSTING);
    clickAnalyze();
    response.next(
      draft({
        source: 'keywords',
        companyName: null,
        jobTitle: null,
        experienceRequirements: [],
        warnings: ['Analisado sem IA (a Groq não respondeu).'],
      }),
    );
    response.complete();
    expect(input('companyName')).toBe('Escrita à mão');
    expect(text()).toContain('Analisado sem IA (a Groq não respondeu).');
  });
});
