import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { isPublicRoute } from './access-policy';
import { createAuthMiddleware } from './auth.middleware';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const ISSUER = 'devstart-auth';

function sign(
  claims: Record<string, unknown>,
  opts: { secret?: string; issuer?: string; exp?: number } = {},
) {
  return jwt.sign(claims, opts.secret ?? SECRET, {
    algorithm: 'HS256',
    issuer: opts.issuer ?? ISSUER,
    expiresIn: opts.exp ?? 900,
  });
}

/** App mínima: o middleware à frente e um endpoint que devolve os cabeçalhos que chegariam ao serviço. */
function buildApp() {
  const app = express();
  app.use(createAuthMiddleware({ jwtSecret: SECRET, issuer: ISSUER }));
  app.all(/.*/, (req, res) =>
    res.json({
      userId: req.headers['x-user-id'] ?? null,
      role: req.headers['x-user-role'] ?? null,
    }),
  );
  return request(app);
}

describe('access policy', () => {
  it.each([
    ['POST', '/api/v1/auth/login'],
    ['POST', '/api/v1/auth/refresh'],
    ['GET', '/api/v1/stacks'],
    ['GET', '/api/v1/stacks/junior-fullstack-angular-node'],
    ['GET', '/api/v1/competencies?q=jest'],
    ['POST', '/api/v1/skill-gap/preview'],
    ['OPTIONS', '/api/v1/applications'],
  ])('%s %s é público', (method, path) =>
    expect(isPublicRoute(method, path)).toBe(true),
  );

  it.each([
    ['GET', '/api/v1/auth/me'],
    ['GET', '/api/v1/applications'],
    ['GET', '/api/v1/profile'],
    ['POST', '/api/v1/stacks'], // ler é público, escrever não
    ['GET', '/api/v1/rota-nova-que-alguem-esqueceu'],
  ])('%s %s é protegido', (method, path) =>
    expect(isPublicRoute(method, path)).toBe(false),
  );
});

describe('auth middleware', () => {
  const http = buildApp();

  it('deixa passar rotas públicas sem token', async () => {
    const res = await http.get('/api/v1/stacks').expect(200);
    expect(res.body.userId).toBeNull();
  });

  it('recusa rotas protegidas sem token', async () => {
    const res = await http.get('/api/v1/applications').expect(401);
    expect(res.body.message).toBe('Falta o token de acesso.');
  });

  it('com token válido, passa a identidade ao serviço', async () => {
    const token = sign({ sub: 'user-1', role: 'GRADUATE', email: 'a@b.pt' });
    const res = await http
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ userId: 'user-1', role: 'GRADUATE' });
  });

  it.each([
    [
      'assinado com outro segredo',
      { secret: 'outro-segredo-com-pelo-menos-32-chars!!' },
    ],
    ['de outro emissor', { issuer: 'outro' }],
    ['expirado', { exp: -60 }],
  ])('recusa um token %s', async (_case, opts) => {
    const token = sign({ sub: 'user-1', role: 'GRADUATE' }, opts);
    await http
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('recusa um token sem assinatura (alg "none")', async () => {
    const unsigned = jwt.sign({ sub: 'admin', role: 'ADMIN' }, '', {
      algorithm: 'none',
      issuer: ISSUER,
    });
    await http
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${unsigned}`)
      .expect(401);
  });

  it('apaga cabeçalhos de identidade forjados pelo cliente', async () => {
    const res = await http
      .get('/api/v1/stacks')
      .set('x-user-id', 'admin')
      .set('x-user-role', 'ADMIN')
      .expect(200);
    expect(res.body).toEqual({ userId: null, role: null });
  });

  it('não deixa um cliente substituir a identidade do token', async () => {
    const token = sign({ sub: 'user-1', role: 'GRADUATE' });
    const res = await http
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .set('x-user-id', 'outra-pessoa')
      .expect(200);
    expect(res.body.userId).toBe('user-1');
  });

  it('não interfere com rotas do próprio gateway', async () => {
    await http.get('/api/health').expect(200);
  });
});
