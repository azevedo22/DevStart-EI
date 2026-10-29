/**
 * Nos testes, cada projeto usa uma base de dados Redis própria (0–15), para os
 * testes de projetos diferentes correrem em paralelo sem apagarem o stream uns dos outros.
 * Devolve '' quando não há TEST_REDIS_URL (os testes que precisam de Redis são ignorados).
 */
export function redisTestUrl(
  db: number,
  base = process.env['TEST_REDIS_URL'] ?? '',
): string {
  if (!base) return '';
  const url = new URL(base);
  url.pathname = `/${db}`;
  return url.toString();
}
