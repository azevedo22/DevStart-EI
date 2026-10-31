import { asArray, asObject, dedupeBy, oneOf, text } from './ai-output';

describe('leitura defensiva da resposta da IA', () => {
  it('asObject / asArray: o que não for do tipo esperado fica vazio', () => {
    expect(asObject({ a: 1 })).toEqual({ a: 1 });
    expect(asObject([1])).toEqual({});
    expect(asObject(null)).toEqual({});
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray('x')).toEqual([]);
  });

  it.each([
    '',
    '   ',
    'null',
    'N/A',
    'na',
    'none',
    '-',
    '—',
    'Desconhecido',
    'não indicada',
  ])('text: "%s" conta como ausente', (v) => expect(text(v, 50)).toBeNull());

  it('text: junta espaços e corta, com ou sem reticências', () => {
    expect(text('  Junior   Dev \n ', 50)).toBe('Junior Dev');
    expect(text(42, 50)).toBeNull();
    expect(text('abcdefghij', 5)).toBe('abcde');
    expect(text('abcdefghij', 5, { ellipsis: true })).toBe('abcd…');
  });

  it('oneOf: só valores permitidos', () => {
    expect(oneOf('JUNIOR', ['JUNIOR', 'MID'] as const)).toBe('JUNIOR');
    expect(oneOf('GURU', ['JUNIOR', 'MID'] as const)).toBeNull();
  });

  it('dedupeBy: fica a primeira ocorrência', () => {
    expect(dedupeBy(['Scrum', 'scrum', 'Git'], (s) => s.toLowerCase())).toEqual(
      ['Scrum', 'Git'],
    );
  });
});
