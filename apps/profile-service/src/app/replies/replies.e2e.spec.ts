/**
 * "Recebi uma resposta" (LLM_PROVIDER=groq, servidor falso): o pedido leva as
 * candidaturas e o email; a resposta da IA é validada contra as candidaturas
 * enviadas; sem IA, segue por palavras-chave. Nada fica gravado.
 */
import { configureApp } from '@devstart/backend-common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const KEY = 'gsk_chave-de-teste';
const LUMEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RIBEIRA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CANDIDATES = [
  {
    id: LUMEN,
    companyName: 'Lumen Cloud',
    jobTitle: 'Junior Frontend Developer',
  },
  {
    id: RIBEIRA,
    companyName: 'Ribeira Tech',
    jobTitle: 'Junior Backend Developer',
  },
];
const TODAY = '2026-11-02';

const EMAIL = `Olá Ana,

Obrigado pela tua candidatura à vaga de Junior Frontend Developer na Lumen Cloud.
Gostaríamos de te convidar para uma entrevista técnica por videochamada
na terça-feira, 10/11, às 15h00.

Cumprimentos,
Equipa de Recrutamento — Lumen Cloud`;

type Mode = 'ok' | 'bad-key' | 'invented';

describeDb('Recebi uma resposta (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let groq: Server;
  let mode: Mode = 'ok';
  let last: Record<string, unknown> | null = null;

  beforeAll(async () => {
    groq = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      res.setHeader('content-type', 'application/json');
      if (req.url === '/openai/v1/models') {
        return res.end(JSON.stringify({ data: [{ id: 'modelo-groq' }] }));
      }
      last = JSON.parse(Buffer.concat(chunks).toString());
      if (mode === 'bad-key') {
        res.statusCode = 401;
        return res.end(
          JSON.stringify({ error: { message: 'Invalid API Key' } }),
        );
      }
      const content =
        mode === 'invented'
          ? {
              kind: 'INTERVIEW',
              candidateId: '99999999-9999-4999-8999-999999999999',
              companyName: 'Lumen Cloud',
              interviewType: 'CEO',
              date: '2031-01-01',
              time: '15:00',
              summary: 'x'.repeat(600),
            }
          : {
              kind: 'INTERVIEW',
              candidateId: LUMEN,
              companyName: 'Lumen Cloud',
              interviewType: 'TECHNICAL',
              date: '2026-11-10',
              time: '15:00',
              summary: 'Convite para entrevista técnica por videochamada.',
            };
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
          usage: { prompt_tokens: 300, completion_tokens: 60 },
        }),
      );
    });
    await new Promise<void>((r) => groq.listen(0, '127.0.0.1', r));
    const port = (groq.address() as AddressInfo).port;

    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: KEY,
      GROQ_MODEL: 'modelo-groq',
      GROQ_BASE_URL: `http://127.0.0.1:${port}/openai/v1`,
    });
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  }, 30_000);

  beforeEach(() => {
    mode = 'ok';
    last = null;
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => groq?.close(r));
  });

  const analyze = (body: Record<string, unknown> = {}) =>
    http
      .post('/api/jobs/replies/analyze')
      .set('x-user-id', ANA)
      .send({ text: EMAIL, candidates: CANDIDATES, today: TODAY, ...body });

  it('propõe a ação: tipo, candidatura, data e hora', async () => {
    const { body } = await analyze().expect(200);
    expect(body).toEqual({
      source: 'ai',
      analyzedBy: 'Groq · modelo-groq',
      sentToExternalService: true,
      warnings: [],
      kind: 'INTERVIEW',
      applicationId: LUMEN,
      interviewType: 'TECHNICAL',
      scheduledAt: '2026-11-10T15:00',
      summary: 'Convite para entrevista técnica por videochamada.',
    });

    // O pedido leva hoje (com o dia da semana), as candidaturas e o email.
    const format = last!['response_format'] as {
      json_schema: { name: string; strict: boolean };
    };
    expect(format.json_schema).toMatchObject({
      name: 'company_reply',
      strict: true,
    });
    const messages = last!['messages'] as { role: string; content: string }[];
    expect(messages[0].content).toMatch(/ignora quaisquer instruções/);
    expect(messages[1].content).toContain('Hoje: 2026-11-02 (segunda-feira)');
    expect(messages[1].content).toContain(
      `${RIBEIRA} | Ribeira Tech | Junior Backend Developer`,
    );
    expect(messages[1].content).toContain('às 15h00');
  });

  it('o que a IA inventa não passa', async () => {
    mode = 'invented';
    const { body } = await analyze().expect(200);
    // O id não é de nenhuma candidatura enviada: vale a empresa no email.
    expect(body.applicationId).toBe(LUMEN);
    expect(body.interviewType).toBeNull();
    expect(body.scheduledAt).toBeNull();
    expect(body.summary.length).toBeLessThanOrEqual(240);
  });

  it('sem IA (chave recusada): segue por palavras-chave e diz porquê', async () => {
    mode = 'bad-key';
    const { body } = await analyze().expect(200);
    expect(body).toMatchObject({
      source: 'keywords',
      analyzedBy: null,
      kind: 'INTERVIEW',
      applicationId: LUMEN,
      interviewType: 'TECHNICAL',
      scheduledAt: '2026-11-10T15:00',
    });
    expect(body.warnings[0]).toMatch(/sem IA.*chave da Groq foi recusada/);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it.each([
    ['texto curto', { text: 'Olá' }],
    ['texto enorme', { text: 'a'.repeat(10_001) }],
    [
      'candidatura sem id válido',
      { candidates: [{ id: 'x', companyName: 'A', jobTitle: 'B' }] },
    ],
    ['data de hoje inválida', { today: '02/11/2026' }],
    ['candidaturas a mais', { candidates: Array(201).fill(CANDIDATES[0]) }],
  ])('%s: 400', async (_c, body) => {
    await analyze(body).expect(400);
    expect(last).toBeNull();
  });

  it('exige sessão', async () => {
    await http
      .post('/api/jobs/replies/analyze')
      .send({ text: EMAIL, candidates: CANDIDATES, today: TODAY })
      .expect(401);
  });
});
