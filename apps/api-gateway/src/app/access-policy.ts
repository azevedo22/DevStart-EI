/**
 * Política de acesso do gateway: o que é público e o que exige sessão.
 * Regra por omissão: tudo o que está em /api/v1 é protegido. Uma rota só fica
 * pública se estiver nesta lista — esquecer uma entrada fecha, nunca abre.
 */

interface PublicRule {
  method: 'GET' | 'POST';
  pattern: RegExp;
}

const PUBLIC_RULES: PublicRule[] = [
  // Sessão: é aqui que se obtém o token, por isso não pode exigi-lo.
  {
    method: 'POST',
    pattern: /^\/api\/v1\/auth\/(register|login|refresh|logout|demo)$/,
  },
  // Catálogo e pré-visualização do gap: permitem experimentar a app sem conta.
  { method: 'GET', pattern: /^\/api\/v1\/competencies(\/[^/]+)?$/ },
  { method: 'GET', pattern: /^\/api\/v1\/stacks(\/[^/]+)?$/ },
  { method: 'POST', pattern: /^\/api\/v1\/skill-gap\/preview$/ },
];

export function isPublicRoute(method: string, path: string): boolean {
  const pathname = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (method === 'OPTIONS') return true; // preflight de CORS
  return PUBLIC_RULES.some(
    (r) => r.method === method && r.pattern.test(pathname),
  );
}

/** Só o tráfego da API pública passa pela política; /api/health é do próprio gateway. */
export function isApiRoute(path: string): boolean {
  return path === '/api/v1' || path.startsWith('/api/v1/');
}
