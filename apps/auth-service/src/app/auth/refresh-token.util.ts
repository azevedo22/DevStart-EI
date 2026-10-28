import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Formato do refresh token entregue ao cliente: "<id>.<segredo>".
 * - o id localiza a linha na base de dados sem varrer a tabela;
 * - o segredo (256 bits aleatórios) nunca é guardado, só o seu SHA-256.
 * Um hash rápido chega aqui porque o segredo tem entropia alta (ao contrário de uma password).
 */
export function generateSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function formatToken(id: string, secret: string): string {
  return `${id}.${secret}`;
}

export function parseToken(
  token: string | undefined,
): { id: string; secret: string } | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const id = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid.test(id) ? { id, secret } : null;
}

/** Comparação em tempo constante para não revelar, pelo tempo de resposta, quantos caracteres coincidem. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
