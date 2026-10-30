import { TestBed } from '@angular/core/testing';
import { CvDraft, Profile } from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { CvReviewModal } from './cv-review-modal';

const DRAFT: CvDraft = {
  fields: {
    headline: 'Desenvolvedor Júnior',
    location: 'Braga',
    university: null,
    graduationYear: 2025,
    bio: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
  },
  education: [
    {
      institution: 'Universidade do Minho',
      degree: 'Licenciatura em EI',
      fieldOfStudy: null,
      startYear: 2022,
      endYear: 2025,
    },
  ],
  experience: [],
  languages: [{ language: 'Inglês', level: 'C1' }],
  competencies: [
    { competencyId: 'java', level: 'INTERMEDIATE', evidence: 'Java' },
    { competencyId: 'angular', level: 'BASIC', evidence: 'Angular' },
  ],
  unmatchedSkills: [],
  projects: [],
  source: 'ai',
  analyzedBy: 'Ollama · teste',
  sentToExternalService: false,
  warnings: [],
};

/** Perfil que já tem algumas coisas. */
const PROFILE = {
  headline: 'O meu título',
  location: null,
  competencies: [
    { competencyId: 'angular', level: 'ADVANCED', declaredAt: '' },
  ],
  education: [
    {
      id: '1',
      institution: 'universidade do minho',
      degree: 'Licenciatura em EI',
      fieldOfStudy: null,
      startYear: 2022,
      endYear: 2025,
    },
  ],
  experience: [],
  languages: [],
} as unknown as Profile;

describe('CvReviewModal', () => {
  const importCv = jest.fn();
  let modal: CvReviewModal;
  const close = jest.fn();

  beforeEach(() => {
    importCv.mockReset().mockReturnValue(of(PROFILE));
    TestBed.configureTestingModule({
      providers: [
        { provide: NgbActiveModal, useValue: { close, dismiss: jest.fn() } },
        { provide: ProfileStore, useValue: { importCv } },
        {
          provide: CatalogApiService,
          useValue: { nameOf: (id: string) => id },
        },
      ],
    });
    modal = TestBed.createComponent(CvReviewModal).componentInstance;
    modal.init(DRAFT, PROFILE, []);
  });

  const m = () => modal as unknown as Record<string, { selected: boolean }[]>;

  it('não substitui por omissão o que já está no perfil', () => {
    const fields = Object.fromEntries(
      (m()['fields'] as unknown as { key: string; selected: boolean }[]).map(
        (f) => [f.key, f.selected],
      ),
    );
    expect(fields).toEqual({
      headline: false, // já tem título
      location: true, // estava vazio
      graduationYear: true,
    });
    // A formação é a mesma (sem distinguir maiúsculas): fica desmarcada.
    expect(m()['education'][0].selected).toBe(false);
    // Angular já está como Avançado; o CV sugere Básico: nada a ganhar.
    const comps = m()['competencies'] as unknown as {
      value: { competencyId: string };
      selected: boolean;
    }[];
    expect(comps.map((c) => [c.value.competencyId, c.selected])).toEqual([
      ['java', true],
      ['angular', false],
    ]);
  });

  it('envia só o que está marcado, com os valores editados', () => {
    const fields = m()['fields'] as unknown as { key: string; value: string }[];
    fields.find((f) => f.key === 'location')!.value = '  Porto ';
    modal.import();

    expect(importCv).toHaveBeenCalledWith({
      fields: { location: 'Porto', graduationYear: 2025 },
      competencies: [{ competencyId: 'java', level: 'INTERMEDIATE' }],
      education: [],
      experience: [],
      languages: [{ language: 'Inglês', level: 'C1' }],
      projects: [],
    });
    expect(close).toHaveBeenCalledWith(4);
  });
});
