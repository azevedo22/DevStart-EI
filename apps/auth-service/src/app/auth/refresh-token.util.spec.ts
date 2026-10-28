import {
  formatToken,
  generateSecret,
  hashSecret,
  parseToken,
  secretMatches,
} from './refresh-token.util';

const ID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c';

describe('refresh token util', () => {
  it('gera segredos diferentes e com entropia suficiente', () => {
    const a = generateSecret();
    expect(a).not.toBe(generateSecret());
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
  });

  it('faz o ciclo formatar → interpretar', () => {
    const secret = generateSecret();
    expect(parseToken(formatToken(ID, secret))).toEqual({ id: ID, secret });
  });

  it.each([
    undefined,
    '',
    'sem-ponto',
    '.so-segredo',
    `${ID}.`,
    'nao-e-uuid.abc',
  ])('rejeita o token malformado %p', (token) =>
    expect(parseToken(token)).toBeNull(),
  );

  it('confirma o segredo certo e rejeita outro', () => {
    const secret = generateSecret();
    const stored = hashSecret(secret);
    expect(secretMatches(secret, stored)).toBe(true);
    expect(secretMatches(generateSecret(), stored)).toBe(false);
  });

  it('nunca guarda o segredo em claro', () => {
    const secret = generateSecret();
    expect(hashSecret(secret)).not.toContain(secret);
    expect(hashSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
  });
});
