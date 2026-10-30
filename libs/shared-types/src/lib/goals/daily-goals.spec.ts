import {
  addDays,
  dailyGoalProgress,
  localDate,
  tierFor,
  weekStart,
  weekday,
} from './daily-goals';

// 30 de outubro de 2026 é uma sexta-feira.
const TODAY = '2026-10-30';
const SATURDAY = '2026-10-31';
const times = (date: string, n: number) =>
  Array.from({ length: n }, () => date);

describe('tierFor', () => {
  it.each([
    [0, null],
    [1, 'SUFFICIENT'],
    [2, 'GOOD'],
    [3, 'EXCELLENT'],
    [8, 'EXCELLENT'],
  ])('%i candidaturas → %s', (count, tier) => {
    expect(tierFor(count)).toBe(tier);
  });
});

describe('dailyGoalProgress', () => {
  it('conta só as de hoje e diz quanto falta para o próximo patamar', () => {
    const p = dailyGoalProgress(
      [...times(TODAY, 1), ...times('2026-10-29', 3)],
      TODAY,
    );
    expect(p.today).toEqual({
      date: TODAY,
      count: 1,
      tier: 'SUFFICIENT',
      active: true,
    });
    expect(p.next).toEqual({ tier: 'GOOD', target: 2, missing: 1 });
    expect(p.max).toBe(3);
    expect(p.restDay).toBe(false);
  });

  it('sem candidaturas hoje, o próximo patamar é Suficiente (falta 1)', () => {
    const p = dailyGoalProgress([], TODAY);
    expect(p.today.tier).toBeNull();
    expect(p.next).toEqual({ tier: 'SUFFICIENT', target: 1, missing: 1 });
  });

  it('a partir de 3 não há próximo patamar', () => {
    expect(dailyGoalProgress(times(TODAY, 5), TODAY).next).toBeNull();
  });

  it('ao fim de semana não há objetivo: é dia de reflexão', () => {
    const p = dailyGoalProgress(times(SATURDAY, 2), SATURDAY);
    expect(p.restDay).toBe(true);
    expect(p.today).toEqual({
      date: SATURDAY,
      count: 2,
      tier: null,
      active: false,
    });
    expect(p.next).toBeNull();
  });

  it('a semana vai de segunda a domingo, com o fim de semana sem objetivo', () => {
    const p = dailyGoalProgress(times('2026-10-27', 2), TODAY);
    expect(p.week.map((d) => d.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(p.week[1]).toMatchObject({ count: 2, tier: 'GOOD', active: true });
    expect(p.week.map((d) => d.active)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  describe('sequência de dias úteis seguidos', () => {
    const met = (date: string) => times(date, 1);

    it('conta hoje quando hoje já chegou a Suficiente', () => {
      const p = dailyGoalProgress(
        [...met(TODAY), ...met('2026-10-29'), ...met('2026-10-28')],
        TODAY,
      );
      expect(p).toMatchObject({ streak: 3, streakIncludesToday: true });
    });

    it('se hoje ainda não chegou lá, a sequência de ontem continua viva', () => {
      const p = dailyGoalProgress(
        [...met('2026-10-29'), ...met('2026-10-28')],
        TODAY,
      );
      expect(p).toMatchObject({ streak: 2, streakIncludesToday: false });
    });

    it('um dia útil sem candidaturas parte a sequência', () => {
      const p = dailyGoalProgress([...met(TODAY), ...met('2026-10-28')], TODAY);
      expect(p.streak).toBe(1);
    });

    it('o fim de semana não parte a sequência', () => {
      // Segunda 2 de novembro; sexta 30 e quinta 29 cumpridas; sábado e domingo vazios.
      const p = dailyGoalProgress(
        [...met('2026-11-02'), ...met(TODAY), ...met('2026-10-29')],
        '2026-11-02',
      );
      expect(p.streak).toBe(3);
    });

    it('ao fim de semana mostra a sequência até sexta', () => {
      const p = dailyGoalProgress(
        [...met(TODAY), ...met('2026-10-29')],
        '2026-11-01',
      );
      expect(p).toMatchObject({ streak: 2, streakIncludesToday: false });
    });

    it('candidaturas ao fim de semana não somam à sequência', () => {
      const p = dailyGoalProgress([...met(SATURDAY), ...met(TODAY)], SATURDAY);
      expect(p.streak).toBe(1);
    });

    it('atravessa meses e anos', () => {
      // 31/12/2026 é quinta; 1/1/2027 é sexta.
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

  it('weekday e weekStart: as semanas começam à segunda', () => {
    expect(weekday(TODAY)).toBe(5);
    expect(weekday('2026-11-01')).toBe(0);
    expect(weekStart(TODAY)).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
  });

  it('localDate usa o dia local, não o UTC', () => {
    // 30 de outubro às 00:30 no fuso local é sempre dia 30, seja qual for o UTC.
    expect(localDate(new Date(2026, 9, 30, 0, 30))).toBe('2026-10-30');
  });
});
