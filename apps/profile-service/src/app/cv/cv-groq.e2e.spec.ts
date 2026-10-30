/**
 * Leitura do CV com LLM_PROVIDER=groq: o mesmo cliente compatível com a API da
 * OpenAI, com as definições da Groq. Servidor falso, como no teste da xAI.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import request from 'supertest';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const PDF = readFileSync(join(__dirname, 'fixtures/cv-exemplo.pdf'));

const ANSWER = {
  headline: 'Desenvolvedor Júnior',
  location: null,
  summary: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  education: [],
  experience: [],
  languages: [],
  skills: [{ name: 'Angular', level: 'BASIC' }],
  projects: [],
};

describeDb('Leitura do CV com a Groq (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let groq: Server;
  /** O modelo de teste só aceita json_object (como alguns modelos da Groq). */
  let jsonSchemaSupported = true;
  const formats: string[] = [];

  beforeAll(async () => {
    groq = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      res.setHeader('content-type', 'application/json');
      if (req.url === '/openai/v1/models') {
        return res.end(JSON.stringify({ data: [{ id: 'modelo-groq' }] }));
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      formats.push(body.response_format.type);
      if (body.response_format.type === 'json_schema' && !jsonSchemaSupported) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error: {
              message:
                'This model does not support response format `json_schema`.',
            },
          }),
        );
      }
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(ANSWER) } }],
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
      GROQ_API_KEY: 'gsk_chave-de-teste',
      GROQ_MODEL: 'modelo-groq',
      GROQ_BASE_URL: `http://127.0.0.1:${port}/openai/v1`,
    });
    const { AppModule } = await import('../app.module');
    const { configureApp } = await import('@devstart/backend-common');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(() => {
    jsonSchemaSupported = true;
    formats.length = 0;
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => groq?.close(r));
  });

  const analyze = () =>
    http
      .post('/api/profile/cv/analyze')
      .set('x-user-id', ANA)
      .attach('file', PDF, 'cv.pdf');

  it('lê o CV com o esquema estrito e diz que foi a Groq', async () => {
    const { body } = await analyze().expect(200);
    expect(formats).toEqual(['json_schema']);
    expect(body).toMatchObject({
      source: 'ai',
      analyzedBy: 'Groq · modelo-groq',
      sentToExternalService: true,
    });
  });

  it('modelo sem json_schema: repete em json_object e funciona na mesma', async () => {
    jsonSchemaSupported = false;
    const { body } = await analyze().expect(200);
    expect(formats).toEqual(['json_schema', 'json_object']);
    expect(body.source).toBe('ai');
    expect(body.fields.headline).toBe('Desenvolvedor Júnior');
  });

  it('verificação do arranque: pronta', async () => {
    const { LlmStartupCheck } = await import('./llm-startup-check');
    expect(await app.get(LlmStartupCheck).check()).toBe(true);
  });
});

describe('chave de outro fornecedor', () => {
  it('uma chave da Groq com LLM_PROVIDER=xai é apanhada antes de qualquer pedido', async () => {
    const { OpenAiCompatibleClient } =
      await import('./openai-compatible.client');
    const xai = new OpenAiCompatibleClient({
      name: 'xAI',
      baseUrl: 'http://127.0.0.1:9', // nunca chega a ser chamado
      apiKey: 'gsk_isto-e-da-groq',
      model: 'grok',
      timeoutMs: 1000,
      keyVar: 'XAI_API_KEY',
      modelVar: 'XAI_MODEL',
      consoleUrl: 'https://console.x.ai',
      keyPrefix: 'xai-',
    });
    await expect(xai.checkReady()).rejects.toThrow(
      /parece ser da Groq.*começam por "xai-"/,
    );
  });
});
