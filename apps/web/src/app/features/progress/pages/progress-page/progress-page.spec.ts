import { ActivityEvent, weeklyReport } from '@devstart/shared-types';
import { describeEvent, longDay, reflections } from './progress-page';

const MON = '2026-10-26';
const ev = (
  date: string,
  kind: ActivityEvent['kind'],
  extra: Partial<ActivityEvent> = {},
): ActivityEvent => ({ date, kind, subject: 'Critical', ...extra });

describe('describeEvent', () => {
  it.each([
    [
      ev(MON, 'APPLIED', { jobTitle: 'Junior Dev' }),
      'Candidatura: Critical (Junior Dev)',
    ],
    [
      ev(MON, 'RESPONSE_POSITIVE', { status: 'HR_INTERVIEW' }),
      'Resposta positiva: Critical passou a Entrevista RH',
    ],
    [
      ev(MON, 'INTERVIEW', { round: 2, interviewType: 'TECHNICAL' }),
      '2.ª entrevista: Critical (técnica)',
    ],
    [ev(MON, 'REJECTED'), 'Rejeição: Critical'],
    [
      ev(MON, 'PROJECT_UPDATED', { subject: 'DevStart EI' }),
      'Projeto atualizado: DevStart EI',
    ],
  ])('%o', (e, text) => {
    expect(describeEvent(e).text).toBe(text);
  });
});

describe('longDay', () => {
  it('escreve o dia da semana em português', () => {
    expect(longDay(MON)).toMatch(/^Segunda-feira, 26/);
  });
});

describe('reflections', () => {
  it('resume a semana com o que faltou e o melhor dia', () => {
    const r = weeklyReport(
      [
        ev(MON, 'APPLIED'),
        ev(MON, 'APPLIED'),
        ev('2026-10-27', 'APPLIED'),
        ev('2026-10-27', 'RESPONSE_POSITIVE'),
      ],
      MON,
      '2026-11-01',
    );
    const lines = reflections(r);
    expect(lines[0]).toBe(
      '3 de 15 candidaturas: faltaram 12 para o objetivo da semana.',
    );
    expect(lines).toContain(
      'Cumpriste o objetivo diário em 2 de 5 dias úteis.',
    );
    expect(lines).toContain(
      'O dia mais produtivo foi segunda-feira, com 2 candidaturas.',
    );
    expect(lines.some((l) => l.startsWith('Tiveste 1 resposta positiva'))).toBe(
      true,
    );
    expect(lines.at(-1)).toMatch(/Nenhum projeto mexido/);
  });

  it('semana vazia: uma sugestão para começar', () => {
    expect(reflections(weeklyReport([], MON, '2026-11-01'))[0]).toMatch(
      /Nenhuma candidatura esta semana/,
    );
  });
});
