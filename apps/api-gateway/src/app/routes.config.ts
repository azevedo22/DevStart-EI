/**
 * Tabela de encaminhamento do API Gateway.
 * O frontend só conhece /api/v1/*; o gateway decide que serviço responde.
 * Os URLs vêm de variáveis de ambiente para funcionar igual em local e em Docker.
 */

export interface ServiceRoute {
  service: string;
  target: string;
  prefixes: string[]; // primeiro segmento depois de /api/v1
}

export function buildRoutes(
  env: NodeJS.ProcessEnv = process.env,
): ServiceRoute[] {
  return [
    {
      service: 'auth-service',
      target: env['AUTH_SERVICE_URL'] ?? 'http://localhost:3001',
      prefixes: ['auth', 'users'],
    },
    {
      service: 'profile-service',
      target: env['PROFILE_SERVICE_URL'] ?? 'http://localhost:3002',
      prefixes: ['profile', 'projects', 'competencies', 'stacks', 'skill-gap'],
    },
    {
      service: 'tracker-service',
      target: env['TRACKER_SERVICE_URL'] ?? 'http://localhost:3003',
      prefixes: ['applications', 'interviews', 'jobs'],
    },
  ];
}

/** Devolve a rota responsável por um caminho como '/api/v1/stacks/abc'. */
export function resolveRoute(
  path: string,
  routes: ServiceRoute[],
): ServiceRoute | undefined {
  const match = /^\/api\/v1\/([^/?]+)/.exec(path);
  if (!match) return undefined;
  return routes.find((r) => r.prefixes.includes(match[1]));
}

/** '/api/v1/stacks/abc' → '/api/stacks/abc' (prefixo interno dos serviços). */
export function rewritePath(path: string): string {
  return path.replace(/^\/api\/v1\//, '/api/');
}
