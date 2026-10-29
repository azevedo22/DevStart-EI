import Redis from 'ioredis';

/**
 * Cria uma ligação ao Redis com as opções usadas em todos os serviços.
 *
 * `enableOfflineQueue: false`: se o Redis estiver em baixo, os comandos falham
 * logo em vez de ficarem em fila. Quem chama decide o que fazer (o rate limiter
 * deixa passar, o outbox tenta mais tarde), em vez de os pedidos ficarem pendurados.
 */
export function createRedis(
  url: string,
  connectionName: string,
  opts: { blocking?: boolean } = {},
): Redis {
  return new Redis(url, {
    connectionName,
    lazyConnect: false,
    enableOfflineQueue: opts.blocking ?? false,
    // Ligações bloqueantes (XREADGROUP BLOCK) não devem falhar por timeout de pedido.
    maxRetriesPerRequest: opts.blocking ? null : 1,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
}
