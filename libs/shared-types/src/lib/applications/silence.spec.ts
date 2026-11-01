import { replyAction } from './reply.types';
import { SILENCE, daysBetween, followUpDraft, silenceOf } from './silence';

describe('silenceOf', () => {
  const applied = (appliedAt: string) => ({
    status: 'APPLIED' as const,
    appliedAt,
  });

  it('até aos 13 dias não diz nada', () => {
    expect(silenceOf(applied('2026-10-19'), '2026-11-01')).toBeNull();
  });

  it(`aos ${SILENCE.followUpAfterDays} dias sugere follow-up`, () => {
    expect(silenceOf(applied('2026-10-18'), '2026-11-01')).toEqual({
      days: 14,
      stage: 'FOLLOW_UP',
    });
  });

  it(`aos ${SILENCE.giveUpAfterDays} dias propõe "Sem resposta"`, () => {
    expect(silenceOf(applied('2026-10-02'), '2026-11-01')).toEqual({
      days: 30,
      stage: 'GIVE_UP',
    });
  });

  it('só conta quem espera a primeira resposta', () => {
    for (const status of [
      'SAVED',
      'HR_INTERVIEW',
      'REJECTED',
      'NO_RESPONSE',
    ] as const)
      expect(
        silenceOf({ status, appliedAt: '2026-09-01' }, '2026-11-01'),
      ).toBeNull();
  });

  it('conta dias de calendário, também na mudança de hora', () => {
    // 25 de outubro de 2026: fim da hora de verão em Portugal.
    expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10);
  });
});

describe('followUpDraft', () => {
  const app = {
    companyName: 'Lumen Cloud',
    jobTitle: 'Junior Frontend Developer',
    appliedAt: '2026-10-12',
  };

  it('em português, com a data e o nome', () => {
    const d = followUpDraft(app, 'pt', 'Ana Exemplo');
    expect(d.subject).toBe(
      'Candidatura a Junior Frontend Developer: ponto de situação',
    );
    expect(d.body).toContain('na Lumen Cloud a 12 de outubro');
    expect(d.body.trim().endsWith('Ana Exemplo')).toBe(true);
  });

  it('em inglês; sem nome, deixa um marcador para preencher', () => {
    const d = followUpDraft(app, 'en', null);
    expect(d.body).toContain('at Lumen Cloud on 12 October');
    expect(d.body.trim().endsWith('[o teu nome]')).toBe(true);
  });
});

describe('replyAction', () => {
  it.each([
    ['REJECTION', null, 'REJECTED', null],
    ['OFFER', null, 'OFFER', null],
    ['TECHNICAL_TEST', null, 'TECHNICAL_TEST', 'TEST'],
    ['INTERVIEW', 'TECHNICAL', 'TECHNICAL_INTERVIEW', 'TECHNICAL'],
    // Sem saber o tipo, uma entrevista é a de RH (a primeira, quase sempre).
    ['INTERVIEW', null, 'HR_INTERVIEW', 'HR'],
    ['OTHER', null, null, null],
  ] as const)('%s (%s) → %s', (kind, type, status, interviewType) => {
    expect(replyAction(kind, type)).toEqual({ status, interviewType });
  });
});
