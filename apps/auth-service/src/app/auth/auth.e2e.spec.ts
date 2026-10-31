/**
 * Testes e2e do Auth Service contra um PostgreSQL real.
 *
 * Correm quando TEST_DATABASE_URL está definido (no CI há um Postgres de serviço;
 * localmente: `docker compose up -d db` e ver o README). Sem essa variável, são ignorados.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  EVENTS_STREAM,
  redisTestUrl,
  revokedUserKey,
} from '@devstart/backend-common';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;
/** Opcional: com Redis, testa também a publicação do evento user.deleted. */
const TEST_REDIS_URL = redisTestUrl(2);
const itRedis = TEST_REDIS_URL ? it : it.skip;

const USER = {
  email: 'Ana.Silva@Example.com',
  password: 'segura123',
  fullName: 'Ana Silva',
};

/** Extrai o cookie de refresh da resposta, como o browser faria. */
function refreshCookie(res: request.Response): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = raw.find((c) => c.startsWith('ds_refresh='));
  if (!cookie) throw new Error('Resposta sem cookie de refresh');
  return cookie;
}
const cookieValue = (setCookie: string) => setCookie.split(';')[0];

describeDb('Auth Service (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      AUTH_DATABASE_URL: TEST_DATABASE_URL,
      BCRYPT_ROUNDS: '4', // rápido nos testes; em produção fica 12
      THROTTLE_DISABLED: 'true',
      REDIS_URL: TEST_REDIS_URL,
      DEMO_MAX_ACTIVE: '3', // baixo para testar o limite
      DEMO_TTL_HOURS: '24',
    });
    // Importado depois de definir o ambiente, porque o ConfigModule lê-o ao carregar.
    const { AppModule } = await import('../app.module');
    const { configureApp } = await import('../configure-app');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await app
      .get(DataSource)
      .query('TRUNCATE "outbox_events", "refresh_tokens", "users" CASCADE');
  });

  afterAll(async () => {
    await app?.close();
  });

  const register = (body: object = USER) =>
    http.post('/api/auth/register').send(body);
  const login = (body: object) => http.post('/api/auth/login').send(body);

  describe('POST /auth/register', () => {
    it('cria a conta, devolve o access token e põe o refresh num cookie seguro', async () => {
      const res = await register().expect(201);

      expect(res.body.user).toMatchObject({
        email: 'ana.silva@example.com',
        fullName: 'Ana Silva',
        role: 'GRADUATE',
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty('refreshToken');

      const cookie = refreshCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('guarda a password com bcrypt, nunca em claro', async () => {
      await register().expect(201);
      const [row] = await app
        .get(DataSource)
        .query('SELECT password_hash FROM users');
      expect(row.password_hash).toMatch(/^\$2[aby]\$/);
      expect(row.password_hash).not.toContain(USER.password);
    });

    it('recusa um email repetido, sem distinguir maiúsculas', async () => {
      await register().expect(201);
      const res = await register({
        ...USER,
        email: 'ANA.SILVA@example.com',
      }).expect(409);
      expect(res.body.message).toBe('Já existe uma conta com este email.');
    });

    it.each([
      ['email inválido', { ...USER, email: 'nao-e-email' }],
      ['password curta', { ...USER, password: 'abc1' }],
      ['password sem números', { ...USER, password: 'sonumeros' }],
      ['nome vazio', { ...USER, fullName: ' ' }],
    ])('recusa %s', async (_case, body) => {
      await register(body).expect(400);
    });

    it('não deixa ninguém escolher o próprio role', async () => {
      const res = await register({ ...USER, role: 'ADMIN' }).expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining(['property role should not exist']),
      );
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(() => register().expect(201));

    it('aceita as credenciais certas', async () => {
      const res = await login({
        email: USER.email,
        password: USER.password,
      }).expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      refreshCookie(res);
    });

    it('dá a mesma resposta para password errada e email inexistente', async () => {
      const wrong = await login({
        email: USER.email,
        password: 'errada123',
      }).expect(401);
      const unknown = await login({
        email: 'ninguem@example.com',
        password: 'errada123',
      }).expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });
  });

  describe('GET /auth/me', () => {
    it('devolve o utilizador com um access token válido', async () => {
      const { body } = await register().expect(201);
      const res = await http
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(res.body.email).toBe('ana.silva@example.com');
    });

    it('recusa pedidos sem token ou com token adulterado', async () => {
      const { body } = await register().expect(201);
      await http.get('/api/auth/me').expect(401);
      const tampered = body.accessToken.slice(0, -3) + 'abc';
      await http
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('roda o refresh token: devolve um novo e o antigo deixa de servir', async () => {
      const first = cookieValue(refreshCookie(await register().expect(201)));

      const res = await http
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      const second = cookieValue(refreshCookie(res));
      expect(second).not.toBe(first);
      expect(res.body.accessToken).toEqual(expect.any(String));

      await http.post('/api/auth/refresh').set('Cookie', second).expect(200);
    });

    it('ao detetar reutilização de um token antigo, revoga a sessão inteira', async () => {
      const first = cookieValue(refreshCookie(await register().expect(201)));
      const second = cookieValue(
        refreshCookie(
          await http.post('/api/auth/refresh').set('Cookie', first).expect(200),
        ),
      );

      // Um atacante usa o token antigo que copiou...
      await http.post('/api/auth/refresh').set('Cookie', first).expect(401);
      // ...e o token legítimo mais recente também deixa de funcionar.
      await http.post('/api/auth/refresh').set('Cookie', second).expect(401);
    });

    it('recusa pedidos sem cookie ou com cookie malformado', async () => {
      await http.post('/api/auth/refresh').expect(401);
      await http
        .post('/api/auth/refresh')
        .set('Cookie', 'ds_refresh=lixo')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoga a sessão e limpa o cookie', async () => {
      const cookie = cookieValue(refreshCookie(await register().expect(201)));

      const res = await http
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      expect(refreshCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

      await http.post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('é idempotente: sem sessão também responde 204', async () => {
      await http.post('/api/auth/logout').expect(204);
    });
  });

  describe('DELETE /auth/me (apagar conta)', () => {
    const del = (
      token: string | null,
      body: object = { password: USER.password },
    ) => {
      const req = http.delete('/api/auth/me').send(body);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };

    it('exige sessão e a password atual', async () => {
      const { body } = await register().expect(201);
      await del(null).expect(401);
      const wrong = await del(body.accessToken, {
        password: 'errada123',
      }).expect(403);
      expect(wrong.body.message).toBe('Password incorreta.');
      await del(body.accessToken, {}).expect(400);
    });

    it('apaga o utilizador e as sessões, limpa o cookie e regista o evento no outbox', async () => {
      const res = await register().expect(201);
      const cookie = cookieValue(refreshCookie(res));

      const out = await del(res.body.accessToken).expect(204);
      expect(refreshCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/);

      const db = app.get(DataSource);
      const [{ users }] = await db.query(
        'SELECT count(*)::int AS users FROM users',
      );
      const [{ tokens }] = await db.query(
        'SELECT count(*)::int AS tokens FROM refresh_tokens',
      );
      expect({ users, tokens }).toEqual({ users: 0, tokens: 0 });

      const outbox = await db.query('SELECT type, payload FROM outbox_events');
      expect(outbox).toEqual([
        { type: 'user.deleted', payload: { userId: res.body.user.id } },
      ]);

      // A sessão antiga já não serve e o email fica livre.
      await http.post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      await login({ email: USER.email, password: USER.password }).expect(401);
      await register().expect(201);
    });

    itRedis(
      'publica o evento no Redis, marca-o como publicado e revoga os tokens',
      async () => {
        const { OutboxRelay } = await import('../outbox/outbox-relay');
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(TEST_REDIS_URL);
        await redis.del(EVENTS_STREAM);

        const { body } = await register().expect(201);
        await del(body.accessToken).expect(204);
        await app.get(OutboxRelay).flush();

        const entries = await redis.xrange(EVENTS_STREAM, '-', '+');
        // Os access tokens já emitidos ficam revogados até expirarem.
        const ttl = await redis.ttl(revokedUserKey(body.user.id));
        await redis.quit();
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(900);
        expect(entries).toHaveLength(1);
        expect(entries[0][1]).toEqual(
          expect.arrayContaining([
            'type',
            'user.deleted',
            'payload',
            JSON.stringify({ userId: body.user.id }),
          ]),
        );
        const [{ pending }] = await app
          .get(DataSource)
          .query(
            'SELECT count(*)::int AS pending FROM outbox_events WHERE published_at IS NULL',
          );
        expect(pending).toBe(0);
      },
    );
  });

  describe('POST /auth/demo (contas de demonstração)', () => {
    const demo = () => http.post('/api/auth/demo').expect(201);

    it('cria uma conta temporária, abre a sessão e pede os dados de exemplo aos outros serviços', async () => {
      const res = await demo();
      const { user } = res.body;

      expect(user.email).toMatch(/^demo-.+@demo\.devstart\.invalid$/);
      const hoursLeft =
        (new Date(user.demoExpiresAt).getTime() - Date.now()) / 3_600_000;
      expect(hoursLeft).toBeGreaterThan(23.9);
      expect(hoursLeft).toBeLessThanOrEqual(24);

      // O cookie de refresh não dura mais do que a conta.
      const expires = /Expires=([^;]+)/.exec(refreshCookie(res))![1];
      expect(new Date(expires).getTime()).toBeLessThanOrEqual(
        new Date(user.demoExpiresAt).getTime(),
      );

      await http
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      const outbox = await app
        .get(DataSource)
        .query('SELECT type, payload FROM outbox_events');
      expect(outbox).toEqual([
        { type: 'user.demo-created', payload: { userId: user.id } },
      ]);
    });

    it('cada visitante recebe uma conta diferente', async () => {
      const a = await demo();
      const b = await demo();
      expect(a.body.user.id).not.toBe(b.body.user.id);
    });

    it('recusa com 503 quando já há demasiadas demonstrações ativas', async () => {
      for (let i = 0; i < 3; i++) await demo();
      const res = await http.post('/api/auth/demo').expect(503);
      expect(res.body.message).toMatch(/demasiadas demonstrações/);
    });

    it('as contas normais não contam para o limite e as expiradas também não', async () => {
      await register().expect(201);
      for (let i = 0; i < 3; i++) await demo();
      await app
        .get(DataSource)
        .query(
          `UPDATE users SET demo_expires_at = now() - interval '1 minute' WHERE demo_expires_at IS NOT NULL`,
        );
      await demo();
    });

    it('apaga-se sem password (ninguém a conhece); uma conta normal continua a precisar dela', async () => {
      const { body } = await demo();
      await http
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({})
        .expect(204);

      const normal = await register().expect(201);
      await http
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${normal.body.accessToken}`)
        .send({})
        .expect(400);
    });

    it('a limpeza apaga só as demonstrações expiradas, pelo mesmo caminho de uma eliminação normal', async () => {
      const { DemoAccountsService } = await import('./demo-accounts.service');
      const db = app.get(DataSource);
      const normal = await register().expect(201);
      const expired = await demo();
      const active = await demo();
      await db.query(
        `UPDATE users SET demo_expires_at = now() - interval '1 minute' WHERE id = $1`,
        [expired.body.user.id],
      );
      await db.query(`DELETE FROM outbox_events`);

      expect(await app.get(DemoAccountsService).purgeExpired()).toBe(1);

      const ids = (await db.query('SELECT id FROM users')).map(
        (r: { id: string }) => r.id,
      );
      expect(ids.sort()).toEqual(
        [normal.body.user.id, active.body.user.id].sort(),
      );
      expect(await db.query('SELECT type, payload FROM outbox_events')).toEqual(
        [{ type: 'user.deleted', payload: { userId: expired.body.user.id } }],
      );
      // A sessão da conta expirada deixa de servir.
      await http
        .post('/api/auth/refresh')
        .set('Cookie', cookieValue(refreshCookie(expired)))
        .expect(401);

      expect(await app.get(DemoAccountsService).purgeExpired()).toBe(0);
    });
  });
});
