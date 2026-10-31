import { FixedWindowLimiter } from '@devstart/backend-common';
import express from 'express';
import request from 'supertest';
import { createRateLimitMiddleware } from './rate-limit.middleware';

/** App mínima: um "autenticador" falso que põe o x-user-id vindo do teste, e o limite a seguir. */
function buildApp(perMinute: number, trustProxyHops = 1) {
  const app = express();
  app.set('trust proxy', trustProxyHops);
  app.use((req, _res, next) => {
    const user = req.headers['x-test-user'];
    if (typeof user === 'string') req.headers['x-user-id'] = user;
    next();
  });
  app.use(
    createRateLimitMiddleware({
      limiter: new FixedWindowLimiter(null),
      perMinute,
    }),
  );
  app.all(/.*/, (_req, res) => res.json({ ok: true }));
  return request(app);
}

describe('limite geral da API no gateway', () => {
  it('por utilizador: passa até ao limite, depois 429 com Retry-After', async () => {
    const http = buildApp(2);
    const get = () =>
      http.get('/api/v1/applications').set('x-test-user', 'ana');
    await get().expect(200);
    await get().expect(200);
    const res = await get().expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(50);
    expect(res.body.message).toMatch(/Demasiados pedidos seguidos/);
    // Outra pessoa não é afetada.
    await http
      .get('/api/v1/applications')
      .set('x-test-user', 'rui')
      .expect(200);
  });

  it('sem sessão: conta por IP real (atrás de um proxy)', async () => {
    const http = buildApp(1);
    const login = (ip: string) =>
      http.post('/api/v1/auth/login').set('x-forwarded-for', ip);
    await login('203.0.113.1').expect(200);
    await login('203.0.113.1').expect(429);
    await login('203.0.113.2').expect(200);
  });

  it('não conta o que não é da API nem os preflights de CORS', async () => {
    const http = buildApp(1);
    await http.get('/api/health').expect(200);
    await http.get('/api/health').expect(200);
    await http.options('/api/v1/applications').expect(200);
    await http.options('/api/v1/applications').expect(200);
  });

  it('0 desliga', async () => {
    const http = buildApp(0);
    await http.get('/api/v1/applications').expect(200);
    await http.get('/api/v1/applications').expect(200);
  });
});
