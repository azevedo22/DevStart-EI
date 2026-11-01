import {
  buildReview,
  importRequest,
  isEmpty,
  period,
  selectedCount,
  years,
} from './cv-review';
import { DRAFT, PROFILE } from './cv-review.fixtures';

describe('buildReview', () => {
  it('não substitui por omissão o que já está no perfil', () => {
    const r = buildReview(DRAFT, PROFILE, []);
    expect(
      Object.fromEntries(r.fields.map((f) => [f.key, f.selected])),
    ).toEqual({
      headline: false, // já tem título
      location: true, // estava vazio
      graduationYear: true,
    });
    // O título atual aparece, para se ver o que seria substituído.
    expect(r.fields.find((f) => f.key === 'headline')?.current).toBe(
      'O meu título',
    );
    // A formação é a mesma (sem distinguir maiúsculas): fica desmarcada.
    expect(r.education[0]).toMatchObject({ existing: true, selected: false });
    // Angular já está como Avançado; o CV sugere Básico: nada a ganhar.
    expect(
      r.competencies.map((c) => [c.value.competencyId, c.selected]),
    ).toEqual([
      ['java', true],
      ['angular', false],
    ]);
  });

  it('um projeto com o mesmo nome (sem maiúsculas nem espaços a mais) já existe', () => {
    const draft = {
      ...DRAFT,
      projects: [
        {
          title: '  DevStart  EI ',
          description: '',
          origin: 'PERSONAL',
          competencyIds: [],
          repositoryUrl: null,
          demoUrl: null,
        },
      ],
    } as unknown as typeof DRAFT;
    const r = buildReview(draft, PROFILE, [{ title: 'devstart ei' }] as never);
    expect(r.projects[0]).toMatchObject({ existing: true, selected: false });
  });

  it('sem nada lido, a revisão está vazia', () => {
    // A API devolve sempre todos os campos, a null quando não os encontrou.
    const noFields = Object.fromEntries(
      Object.keys(DRAFT.fields).map((k) => [k, null]),
    );
    const empty = {
      ...DRAFT,
      fields: noFields,
      education: [],
      languages: [],
      competencies: [],
    } as unknown as typeof DRAFT;
    expect(isEmpty(buildReview(empty, null, []))).toBe(true);
  });
});

describe('importRequest', () => {
  it('envia só o que está marcado, com os valores editados', () => {
    const r = buildReview(DRAFT, PROFILE, []);
    r.fields.find((f) => f.key === 'location')!.value = '  Porto ';
    expect(importRequest(r)).toEqual({
      fields: { location: 'Porto', graduationYear: 2025 },
      competencies: [{ competencyId: 'java', level: 'INTERMEDIATE' }],
      education: [],
      experience: [],
      languages: [{ language: 'Inglês', level: 'C1' }],
      projects: [],
    });
    expect(selectedCount(r)).toBe(4);
  });

  it('um campo apagado vai como vazio (null), não como texto vazio', () => {
    const r = buildReview(DRAFT, null, []);
    r.fields.find((f) => f.key === 'headline')!.value = '   ';
    expect(importRequest(r).fields.headline).toBeNull();
  });
});

describe('years e period', () => {
  it('formatam datas que podem faltar', () => {
    expect(years({ startYear: 2022, endYear: null } as never)).toBe(
      ' · 2022 – atual',
    );
    expect(years({ startYear: null, endYear: null } as never)).toBe('');
    expect(
      period({ startDate: '2023-09-01', endDate: '2024-06-30' } as never),
    ).toBe('09/2023 – 06/2024');
    expect(period({ startDate: null, endDate: null } as never)).toBe('');
  });
});
