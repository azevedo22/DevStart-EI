import {
  APPLICATION_STATUSES,
  ApplicationBoard,
  ApplicationStatus,
  JobApplication,
} from '@devstart/shared-types';
import { realPosition, splitByWeek, statList } from './board-view';

const card = (
  id: string,
  status: ApplicationStatus,
  appliedAt = '2026-11-02',
  interviewCount = 0,
): JobApplication =>
  ({
    id,
    status,
    appliedAt,
    interviewCount,
    companyName: id,
  }) as JobApplication;

const board = (cards: JobApplication[]): ApplicationBoard =>
  Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, cards.filter((c) => c.status === s)]),
  ) as ApplicationBoard;

describe('statList', () => {
  const b = board([
    card('guardada', 'SAVED'),
    card('a', 'APPLIED', '2026-11-01'),
    card('b', 'APPLIED', '2026-11-03'),
    card('teste', 'TECHNICAL_TEST', '2026-10-20', 1),
    card('rejeitada', 'REJECTED', '2026-10-10'),
    card('silencio', 'NO_RESPONSE', '2026-09-01'),
  ]);
  const ids = (k: Parameters<typeof statList>[1]) =>
    statList(b, k).map((a) => a.id);

  it('candidaturas: todas menos as guardadas, as mais recentes primeiro', () => {
    expect(ids('total')).toEqual(['b', 'a', 'teste', 'rejeitada', 'silencio']);
  });

  it('em processo: sem as fechadas', () => {
    expect(ids('active')).toEqual(['b', 'a', 'teste']);
  });

  it('com resposta: pela coluna atual (teste, entrevista, proposta, rejeição)', () => {
    expect(ids('responses')).toEqual(['teste', 'rejeitada']);
  });

  it('com entrevistas: as que têm alguma registada', () => {
    expect(ids('interviews')).toEqual(['teste']);
    expect(statList(null, 'total')).toEqual([]);
  });
});

describe('splitByWeek', () => {
  it('esta semana começa à segunda; mantém a ordem da coluna', () => {
    // 2026-11-04 é quarta-feira: a semana começa a 2026-11-02.
    const cards = [
      card('velha', 'APPLIED', '2026-10-30'),
      card('segunda', 'APPLIED', '2026-11-02'),
      card('domingo', 'APPLIED', '2026-11-01'),
      card('hoje', 'APPLIED', '2026-11-04'),
    ];
    const { recent, older } = splitByWeek(cards, '2026-11-04');
    expect(recent.map((c) => c.id)).toEqual(['segunda', 'hoje']);
    expect(older.map((c) => c.id)).toEqual(['velha', 'domingo']);
  });
});

describe('realPosition', () => {
  // Coluna: r1, o1, r2, o2 (r = desta semana, à vista; o = escondidas).
  const full = ['r1', 'o1', 'r2', 'o2'].map((id) => card(id, 'APPLIED'));
  const shown = [full[0], full[2]];

  it('sem cartões escondidos, é o próprio índice', () => {
    expect(realPosition(full, full, 'x', 2)).toBe(2);
  });

  it('vindo de outra coluna: fica antes do cartão visível onde foi largado', () => {
    expect(realPosition(full, shown, 'novo', 0)).toBe(0);
    expect(realPosition(full, shown, 'novo', 1)).toBe(2); // antes de r2
    expect(realPosition(full, shown, 'novo', 2)).toBe(3); // a seguir a r2
  });

  it('dentro da coluna: o próprio cartão não conta', () => {
    // r1 largado depois de r2: sem r1 a coluna é o1, r2, o2 → a seguir a r2.
    expect(realPosition(full, shown, 'r1', 1)).toBe(2);
  });

  it('coluna com tudo escondido: vai para o topo', () => {
    expect(realPosition(full, [], 'novo', 0)).toBe(0);
  });
});
