import {
  ActivityEvent,
  describeDay,
  parseActivityRange,
  weeklyReport,
} from './weekly-report';

const MON = '2026-10-26';
const ev = (
  date: string,
  kind: ActivityEvent['kind'],
  subject = 'Empresa',
): ActivityEvent => ({ date, kind, subject });

/** A semana do exemplo: seg 2 candidaturas; ter 2 + resposta; qua 1 + entrevista; qui projeto. */
const WEEK: ActivityEvent[] = [
  ev('2026-10-26', 'APPLIED', 'Farfetch'),
  ev('2026-10-26', 'APPLIED', 'Critical'),
  ev('2026-10-27', 'APPLIED', 'Sonae'),
  ev('2026-10-27', 'RESPONSE_POSITIVE', 'Critical'),
  ev('2026-10-27', 'APPLIED', 'Bosch'),
  ev('2026-10-28', 'INTERVIEW_SCHEDULED', 'Critical'),
  ev('2026-10-28', 'APPLIED', 'Natixis'),
  ev('2026-10-29', 'PROJECT_UPDATED', 'DevStart EI'),
];

describe('weeklyReport', () => {
  it('conta por dia, de segunda a domingo, com os eventos por ordem', () => {
    const r = weeklyReport(WEEK, MON, '2026-10-30');
    expect(r).toMatchObject({ start: MON, end: '2026-11-01', current: true });
    expect(r.days.map((d) => d.series.applications)).toEqual([
      2, 2, 1, 0, 0, 0, 0,
    ]);
    expect(r.days[1].series.positive).toBe(1);
    expect(r.days[3].series.projects).toBe(1);
    // As candidaturas vêm antes da resposta, mesmo que tenham chegado depois.
    expect(r.days[1].events.map((e) => e.kind)).toEqual([
      'APPLIED',
      'APPLIED',
      'RESPONSE_POSITIVE',
    ]);
    expect(r.days[2].events.map((e) => e.kind)).toEqual([
      'APPLIED',
      'INTERVIEW_SCHEDULED',
    ]);
    expect(r.peak).toBe(2);
  });

  it('marca o objetivo diário e os dias que ainda não chegaram', () => {
    const r = weeklyReport(WEEK, MON, '2026-10-28');
    expect(r.days.map((d) => d.goalTier)).toEqual([
      'GOOD',
      'GOOD',
      'SUFFICIENT',
      null,
      null,
      null,
      null,
    ]);
    expect(r.days.map((d) => d.future)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(r.days.map((d) => d.active)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('objetivos da semana: 15 candidaturas, 5 dias úteis, 1 projeto', () => {
    const r = weeklyReport(WEEK, MON, '2026-11-01');
    expect(r.goals).toEqual([
      {
        id: 'applications',
        title: 'Candidaturas na semana',
        value: 5,
        target: 15,
        done: false,
      },
      {
        id: 'goal-days',
        title: 'Dias úteis com objetivo cumprido',
        value: 3,
        target: 5,
        done: false,
      },
      {
        id: 'projects',
        title: 'Projeto novo ou atualizado',
        value: 1,
        target: 1,
        done: true,
      },
    ]);
  });

  it('compara com a semana anterior e ignora o que está fora das duas', () => {
    const r = weeklyReport(
      [
        ...WEEK,
        ev('2026-10-19', 'APPLIED'),
        ev('2026-10-25', 'REJECTED'),
        ev('2026-10-18', 'APPLIED'), // há duas semanas
        ev('2026-11-02', 'APPLIED'), // semana seguinte
      ],
      MON,
      '2026-11-01',
    );
    expect(r.series.applications).toBe(5);
    expect(r.previous.series).toEqual({
      applications: 1,
      positive: 0,
      rejected: 1,
      interviews: 0,
      projects: 0,
    });
  });

  it('uma semana passada não está a decorrer', () => {
    expect(weeklyReport([], '2026-10-19', '2026-10-30').current).toBe(false);
  });

  it('propostas contam como respostas positivas no gráfico', () => {
    const r = weeklyReport(
      [ev(MON, 'OFFER'), ev(MON, 'RESPONSE_POSITIVE')],
      MON,
      MON,
    );
    expect(r.days[0].series.positive).toBe(2);
    expect(r.kinds.OFFER).toBe(1);
  });
});

describe('describeDay', () => {
  it('junta os tipos numa frase, no singular e no plural', () => {
    const r = weeklyReport(WEEK, MON, '2026-11-01');
    expect(describeDay(r.days[1].kinds)).toBe(
      '2 candidaturas · 1 resposta positiva',
    );
    expect(describeDay(r.days[2].kinds)).toBe(
      '1 candidatura · 1 entrevista marcada',
    );
    expect(describeDay(r.days[6].kinds)).toBe('');
  });
});

describe('parseActivityRange', () => {
  it('aceita um intervalo válido e usa UTC sem fuso', () => {
    expect(
      parseActivityRange({ from: '2026-10-19', to: '2026-11-01' }),
    ).toEqual({ from: '2026-10-19', to: '2026-11-01', tz: 'UTC' });
    expect(
      parseActivityRange({
        from: '2026-10-19',
        to: '2026-11-01',
        tz: 'Europe/Lisbon',
      }),
    ).toMatchObject({ tz: 'Europe/Lisbon' });
  });

  it.each([
    [{}, /AAAA-MM-DD/],
    [{ from: '2026-02-31', to: '2026-03-01' }, /AAAA-MM-DD/],
    [{ from: '2026-11-01', to: '2026-10-01' }, /anterior/],
    [{ from: '2026-01-01', to: '2026-12-31' }, /mais de 62 dias/],
    [
      { from: '2026-10-01', to: '2026-10-07', tz: 'Lua/Mar_da_Tranquilidade' },
      /Fuso/,
    ],
    [{ from: '2026-10-01', to: '2026-10-07', tz: "UTC'; drop" }, /Fuso/],
  ])('recusa %j', (q, message) => {
    const r = parseActivityRange(q as never);
    expect('error' in r && r.error).toMatch(message);
  });
});
