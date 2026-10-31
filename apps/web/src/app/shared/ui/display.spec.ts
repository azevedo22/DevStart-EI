import { initialsOf, matchClass } from './display';

describe('regras de apresentação', () => {
  it.each([
    ['Cláudio Azevedo', 'CA'],
    ['Ana Maria da Silva', 'AS'],
    ['  rui  ', 'R'],
    ['', ''],
    [null, ''],
  ])('initialsOf(%j) → %s', (name, out) => {
    expect(initialsOf(name)).toBe(out);
  });

  it.each([
    [100, 'text-success'],
    [70, 'text-success'],
    [69, 'text-warning-emphasis'],
    [40, 'text-warning-emphasis'],
    [39, 'text-danger'],
    [null, 'text-danger'],
  ])('matchClass(%j) → %s', (p, cls) => {
    expect(matchClass(p)).toBe(cls);
  });
});
