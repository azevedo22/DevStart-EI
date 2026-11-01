import { JobFeedItem } from '@devstart/shared-types';
import {
  ORDERED_LOCATIONS,
  compact,
  filtersActive,
  levelText,
} from './job-feed.util';

describe('levelText', () => {
  const job = (seniority: string, yearsRequired: number | null) =>
    ({ seniority, yearsRequired }) as JobFeedItem;

  it.each([
    [job('JUNIOR', 0), 'Júnior · sem experiência'],
    [job('UNKNOWN', 2), '2+ anos de experiência'],
    [job('UNKNOWN', null), ''],
  ])('%o → %s', (j, text) => {
    expect(levelText(j)).toBe(text);
  });
});

describe('compact e filtersActive', () => {
  it('tira o que está vazio e ordena as listas (a query guardada é estável)', () => {
    expect(
      compact({
        locations: [18, 4],
        contracts: [],
        remote: false,
        stackId: '',
        includeUnrealistic: true,
      }),
    ).toEqual({ locations: [4, 18], includeUnrealistic: true });
  });

  it('sem nada escolhido não há filtros ativos', () => {
    expect(filtersActive(compact({ locations: [], remote: false }))).toBe(
      false,
    );
    expect(filtersActive({ remote: true })).toBe(true);
  });
});

describe('ORDERED_LOCATIONS', () => {
  it('os distritos principais vêm primeiro, sem repetir nenhum', () => {
    expect(ORDERED_LOCATIONS.slice(0, 5).map((l) => l.id)).toEqual([
      18, 14, 4, 8, 1,
    ]);
    const ids = ORDERED_LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
