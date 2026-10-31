/**
 * Quota de leituras com IA: por utilizador por hora e um teto global por dia.
 * Sem IA configurada (OLLAMA_URL vazio) a análise segue por palavras-chave,
 * mas conta na mesma: o que se limita são os pedidos de análise.
 */
import { configureApp } from '@devstart/backend-common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const RUI = '22222222-2222-4222-8222-222222222222';
const EVA = '33333333-3333-4333-8333-333333333333';

const POSTING =
  'Junior Backend Developer na Lumen Cloud, em Braga. Requisitos: Node.js, TypeScript, PostgreSQL.';

describeDb('Quota de IA (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
      LLM_PROVIDER: 'ollama',
      OLLAMA_URL: '',
      AI_USER_HOURLY_LIMIT: '2',
      AI_DAILY_LIMIT: '3',
    });
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  const analyze = (userId: string) =>
    http
      .post('/api/jobs/analyze')
      .set('x-user-id', userId)
      .send({ text: POSTING });

  it('limita cada utilizador por hora e todos juntos por dia', async () => {
    await analyze(ANA).expect(200);
    await analyze(ANA).expect(200);

    const user = await analyze(ANA).expect(429);
    expect(user.body.message).toMatch(
      /limite de 2 leituras com IA por hora.*daqui a 1 h/,
    );
    expect(user.body.retryAfterSeconds).toBeGreaterThan(3500);

    // A recusa da Ana não gastou o teto global: o Rui ainda tem uma.
    await analyze(RUI).expect(200);
    const all = await analyze(EVA).expect(429);
    expect(all.body.message).toMatch(/limite de utilização de hoje/);
    expect(all.body.message).toMatch(/daqui a 24 h/);
  });
});
