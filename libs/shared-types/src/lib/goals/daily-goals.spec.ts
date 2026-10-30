import { addDays, dailyGoalProgress, localDate, tierFor } from './daily-goals';

const TODAY = '2026-10-30';
const times = (date: string, n: number) =>
  Array.from({ length: n }, () => date);

describe('tierFor', () => {
  it.each([
    [0, null],
    [2, null],
    [3, 'SUFFICIENT'],
    [6, 'SUFFICIENT'],
    [7, 'GOOD'],
    [9, 'GOOD'],
    [10, 'EXCELLENT'],
    [14, 'EXCELLENT'],
  ])('%i candidaturas → %s', (count, tier) => {
    expect(tierFor(count)).toBe(tier);
  });
});

describe('dailyGoalProgress', () => {
  it('conta só as de hoje e diz quanto falta para o próximo patamar', () => {
    const p = dailyGoalProgress(
      [...times(TODAY, 4), ...times('2026-10-29', 9)],
      TODAY,
    );
    expect(p.today).toEqual({ date: TODAY, count: 4, tier: 'SUFFICIENT' });
    expect(p.next).toEqual({ tier: 'GOOD', target: 7, missing: 3 });
    expect(p.max).toBe(10);
  });

  it('sem candidaturas hoje, o próximo patamar é Suficiente (faltam 3)', () => {
    const p = dailyGoalProgress([], TODAY);
    expect(p.today.tier).toBeNull();
    expect(p.next).toEqual({ tier: 'SUFFICIENT', target: 3, missing: 3 });
  });

  it('a partir de 10 não há próximo patamar', () => {
    expect(dailyGoalProgress(times(TODAY, 12), TODAY).next).toBeNull();
  });

  it('a semana tem 7 dias, do mais antigo até hoje', () => {
    const p = dailyGoalProgress(times('2026-10-24', 7), TODAY);
    expect(p.week.map((d) => d.date)).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
    ]);
    expect(p.week[0]).toMatchObject({ count: 7, tier: 'GOOD' });
  });

  describe('sequência de dias seguidos', () => {
    const met = (date: string) => times(date, 3);

    it('conta hoje quando hoje já chegou a Suficiente', () => {
      const p = dailyGoalProgress(
        [...met(TODAY), ...met('2026-10-29'), ...met('2026-10-28')],
        TODAY,
      );
      expect(p).toMatchObject({ streak: 3, streakIncludesToday: true });
    });

    it('se hoje ainda não chegou lá, a sequência de ontem continua viva', () => {
      const p = dailyGoalProgress(
        [...times(TODAY, 1), ...met('2026-10-29'), ...met('2026-10-28')],
        TODAY,
      );
      expect(p).toMatchObject({ streak: 2, streakIncludesToday: false });
    });

    it('um dia abaixo de Suficiente parte a sequência', () => {
      const p = dailyGoalProgress(
        [...met(TODAY), ...times('2026-10-29', 2), ...met('2026-10-28')],
        TODAY,
      );
      expect(p.streak).toBe(1);
    });

    it('atravessa meses e anos', () => {
      const p = dailyGoalProgress(
        [...met('2027-01-01'), ...met('2026-12-31'), ...met('2026-12-30')],
        '2027-01-01',
      );
      expect(p.streak).toBe(3);
    });
  });
});

describe('datas', () => {
  it('addDays atravessa a mudança de hora sem saltar dias', () => {
    // Em Portugal, a hora muda a 25 de outubro de 2026.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('localDate usa o dia local, não o UTC', () => {
    // 30 de outubro às 00:30 no fuso local é sempre dia 30, seja qual for o UTC.
    expect(localDate(new Date(2026, 9, 30, 0, 30))).toBe('2026-10-30');
  });
});
