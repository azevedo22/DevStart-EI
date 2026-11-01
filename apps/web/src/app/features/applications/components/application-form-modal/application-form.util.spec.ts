import { APPLICATION_LIMITS, JobPostingDraft } from '@devstart/shared-types';
import {
  describeDraft,
  draftPatch,
  mergeUnique,
  numberOrNull,
} from './application-form.util';

const draft = (over: Partial<JobPostingDraft> = {}): JobPostingDraft => ({
  source: 'ai',
  analyzedBy: 'Groq · teste',
  sentToExternalService: true,
  warnings: [],
  companyName: null,
  jobTitle: null,
  seniority: 'UNKNOWN',
  yearsRequired: null,
  experienceRequirements: [],
  competencyIds: [],
  otherSkills: [],
  workMode: null,
  location: null,
  ...over,
});

describe('draftPatch', () => {
  const empty = { experience: [], competencyIds: [] };

  it('só muda os campos para os quais a análise tem resposta', () => {
    expect(draftPatch(draft({ companyName: 'Lumen' }), empty)).toEqual({
      companyName: 'Lumen',
    });
  });

  it('"0 anos" também é resposta (não é o mesmo que não indicado)', () => {
    expect(draftPatch(draft({ yearsRequired: 0 }), empty)).toEqual({
      yearsRequired: 0,
    });
  });

  it('junta experiência e competências às que já lá estavam, sem repetir', () => {
    const patch = draftPatch(
      draft({
        experienceRequirements: ['scrum', 'APIs REST'],
        competencyIds: ['angular', 'git'],
      }),
      { experience: ['Scrum'], competencyIds: ['angular'] },
    );
    expect(patch.experienceRequirements).toEqual(['Scrum', 'APIs REST']);
    expect(patch.requiredCompetencyIds).toEqual(['angular', 'git']);
  });

  it('respeita o limite de competências', () => {
    const many = Array.from(
      { length: APPLICATION_LIMITS.competencies + 5 },
      (_, i) => `c${i}`,
    );
    expect(
      draftPatch(draft({ competencyIds: many }), empty).requiredCompetencyIds,
    ).toHaveLength(APPLICATION_LIMITS.competencies);
  });
});

describe('describeDraft', () => {
  it('diz o que a IA preencheu', () => {
    expect(
      describeDraft(
        draft({ companyName: 'Lumen', competencyIds: ['angular'] }),
      ),
    ).toEqual({
      ok: true,
      text: 'Preenchido: empresa, 1 competência. Confirma e ajusta se for preciso.',
    });
  });

  it('sem IA, mostra o aviso que veio do servidor', () => {
    expect(
      describeDraft(
        draft({ source: 'keywords', warnings: ['A Groq não respondeu.'] }),
      ),
    ).toEqual({ ok: false, text: 'A Groq não respondeu.' });
  });
});

describe('mergeUnique e numberOrNull', () => {
  it('ignora maiúsculas ao juntar', () => {
    expect(mergeUnique(['Git'], ['git', 'Docker'])).toEqual(['Git', 'Docker']);
  });

  it.each([
    [null, null],
    ['', null],
    [NaN, null],
    ['3', 3],
    [0, 0],
  ])('%p → %p', (input, out) => {
    expect(numberOrNull(input)).toBe(out);
  });
});
