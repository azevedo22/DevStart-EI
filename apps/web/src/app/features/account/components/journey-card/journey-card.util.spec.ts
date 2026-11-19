import { daysBetween, plural } from './journey-card.util';

describe('caminho até ao primeiro sim: contas', () => {
  it('conta dias entre datas, sem negativos', () => {
    expect(daysBetween('2026-11-01', '2026-11-19')).toBe(18);
    expect(daysBetween('2026-11-19', '2026-11-19')).toBe(0);
    expect(daysBetween('2026-11-20', '2026-11-19')).toBe(0);
    // Atravessa a mudança de hora sem perder um dia.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('singular e plural', () => {
    expect(plural(1, 'entrevista', 'entrevistas')).toBe('1 entrevista');
    expect(plural(0, 'entrevista', 'entrevistas')).toBe('0 entrevistas');
  });
});
