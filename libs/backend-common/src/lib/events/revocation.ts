/**
 * Revogação de utilizadores, partilhada pelo Auth Service (escreve) e pelo gateway (lê).
 *
 * Os access tokens não têm estado: um token emitido antes de a conta ser apagada
 * continuaria válido até expirar. Esta marca no Redis, com a mesma duração do
 * access token, fecha esse intervalo. Depois disso o próprio token já expirou.
 */
export const revokedUserKey = (userId: string) =>
  `devstart:revoked-user:${userId}`;
