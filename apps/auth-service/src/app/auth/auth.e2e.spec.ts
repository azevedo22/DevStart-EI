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

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

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
      .query('TRUNCATE "refresh_tokens", "users" CASCADE');
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
});
