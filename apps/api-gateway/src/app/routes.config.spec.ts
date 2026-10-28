import { buildRoutes, resolveRoute, rewritePath } from './routes.config';

describe('gateway routes', () => {
  const routes = buildRoutes({});

  it.each([
    ['/api/v1/auth/login', 'auth-service'],
    ['/api/v1/stacks', 'profile-service'],
    ['/api/v1/skill-gap/preview', 'profile-service'],
    ['/api/v1/applications/123/status', 'tracker-service'],
  ])('%s → %s', (path, service) => {
    expect(resolveRoute(path, routes)?.service).toBe(service);
  });

  it('não encaminha caminhos desconhecidos ou fora de /api/v1', () => {
    expect(resolveRoute('/api/v1/unknown', routes)).toBeUndefined();
    expect(resolveRoute('/api/auth/login', routes)).toBeUndefined();
  });

  it('reescreve o prefixo público para o interno', () => {
    expect(rewritePath('/api/v1/stacks/x?y=1')).toBe('/api/stacks/x?y=1');
  });

  it('lê os URLs dos serviços do ambiente', () => {
    const custom = buildRoutes({ AUTH_SERVICE_URL: 'http://auth:3001' });
    expect(custom.find((r) => r.service === 'auth-service')?.target).toBe(
      'http://auth:3001',
    );
  });
});
