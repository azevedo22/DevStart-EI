import { DAILY_QUOTES, dailyQuote, quoteContext } from './daily-quote';
import { addDays } from './daily-goals';

const FRIDAY = '2026-10-30';

describe('DAILY_QUOTES', () => {
  it('cada frase tem tradução, original, autor e fonte com link https', () => {
    for (const q of DAILY_QUOTES) {
      expect(q.text.length).toBeGreaterThan(5);
      expect(q.original.length).toBeGreaterThan(5);
      expect(q.author).toBeTruthy();
      expect(q.source.url).toMatch(/^https:\/\//);
    }
  });

  it('ids únicos e frases suficientes para mais de um mês', () => {
    expect(new Set(DAILY_QUOTES.map((q) => q.id)).size).toBe(
      DAILY_QUOTES.length,
    );
    expect(DAILY_QUOTES.length).toBeGreaterThanOrEqual(30);
  });

  it('cada contexto tem várias frases', () => {
    for (const c of ['rejection', 'interview', 'weekend'] as const) {
      expect(
        DAILY_QUOTES.filter((q) => q.contexts.includes(c)).length,
      ).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('dailyQuote', () => {
  it('é a mesma durante o dia todo', () => {
    expect(dailyQuote(FRIDAY)).toBe(dailyQuote(FRIDAY));
  });

  it('não se repete enquanto não passarem todas', () => {
    const ids = Array.from(
      { length: DAILY_QUOTES.length },
      (_, i) => dailyQuote(addDays(FRIDAY, i)).id,
    );
    expect(new Set(ids).size).toBe(DAILY_QUOTES.length);
  });

  it('com contexto, escolhe só desse conjunto e também roda', () => {
    const days = Array.from({ length: 5 }, (_, i) =>
      dailyQuote(addDays(FRIDAY, i), 'rejection'),
    );
    expect(days.every((q) => q.contexts.includes('rejection'))).toBe(true);
    expect(new Set(days.map((q) => q.id)).size).toBe(5);
  });
});

describe('quoteContext', () => {
  it('rejeição recente > entrevista > fim de semana > nenhum', () => {
    const base = {
      today: FRIDAY,
      recentRejection: false,
      recentInterview: false,
    };
    expect(quoteContext(base)).toBeNull();
    expect(quoteContext({ ...base, today: '2026-10-31' })).toBe('weekend');
    expect(quoteContext({ ...base, recentInterview: true })).toBe('interview');
    expect(
      quoteContext({ ...base, recentInterview: true, recentRejection: true }),
    ).toBe('rejection');
  });
});
