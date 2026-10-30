/**
 * Leitura do CV com LLM_PROVIDER=xai: o mesmo fluxo, mas com uma API compatível
 * com a da OpenAI (POST /chat/completions). O servidor da xAI é falso: regista
 * o pedido e responde como a API verdadeira, incluindo os erros.
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
const KEY = 'xai-chave-de-teste';

type Mode = 'ok' | 'bad-key' | 'bad-key-400' | 'unknown-model' | 'rate-limit';

describeDb('Leitura do CV com a xAI (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let xai: Server;
  let mode: Mode = 'ok';
  let last: { path?: string; auth?: string; body?: Record<string, unknown> } =
    {};

  beforeAll(async () => {
    xai = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      res.setHeader('content-type', 'application/json');

      // Resposta real da xAI a uma chave errada: 400, não 401.
      if (mode === 'bad-key-400') {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            code: 'invalid-argument',
            error:
              'Incorrect API key provided. You can obtain an API key from https://console.x.ai.',
          }),
        );
      }
      if (req.url === '/v1/models') {
        const ids =
          mode === 'unknown-model'
            ? ['grok-a', 'grok-b']
            : ['grok-a', 'grok-b', 'grok-teste'];
        return res.end(JSON.stringify({ data: ids.map((id) => ({ id })) }));
      }
      last = {
        path: req.url,
        auth: req.headers['authorization'],
        body: JSON.parse(Buffer.concat(chunks).toString()),
      };
      if (mode === 'bad-key') {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'Incorrect API key provided' }));
      }
      if (mode === 'unknown-model') {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({ error: 'The model grok-teste does not exist' }),
        );
      }
      if (mode === 'rate-limit') {
        res.statusCode = 429;
        return res.end(JSON.stringify({ error: 'Rate limit' }));
      }
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  headline: 'Desenvolvedor Full-Stack Júnior',
                  location: 'Braga',
                  summary: null,
                  linkedinUrl: null,
                  githubUrl: null,
                  portfolioUrl: null,
                  education: [],
                  experience: [],
                  languages: [{ language: 'Inglês', level: 'C1' }],
                  skills: [{ name: 'Java', level: 'INTERMEDIATE' }],
                  projects: [],
                }),
              },
            },
          ],
          usage: { prompt_tokens: 900, completion_tokens: 200 },
        }),
      );
    });
    await new Promise<void>((r) => xai.listen(0, '127.0.0.1', r));
    const port = (xai.address() as AddressInfo).port;

    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
      LLM_PROVIDER: 'xai',
      XAI_API_KEY: KEY,
      XAI_MODEL: 'grok-teste',
      XAI_BASE_URL: `http://127.0.0.1:${port}/v1`,
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
    mode = 'ok';
    last = {};
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => xai?.close(r));
  });

  const analyze = () =>
    http
      .post('/api/profile/cv/analyze')
      .set('x-user-id', ANA)
      .attach('file', PDF, 'cv.pdf');

  it('envia o CV para /chat/completions com a chave e um esquema estrito', async () => {
    const { body } = await analyze().expect(200);

    expect(last.path).toBe('/v1/chat/completions');
    expect(last.auth).toBe(`Bearer ${KEY}`);
    expect(last.body).toMatchObject({ model: 'grok-teste', temperature: 0 });
    const format = last.body!['response_format'] as {
      type: string;
      json_schema: { strict: boolean; schema: Record<string, unknown> };
    };
    expect(format.type).toBe('json_schema');
    expect(format.json_schema.strict).toBe(true);
    // Modo estrito: tudo obrigatório e nada de propriedades extra, também nos níveis de dentro.
    const schema = format.json_schema.schema as {
      required: string[];
      additionalProperties: boolean;
      properties: { education: { items: { required: string[] } } };
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain('linkedinUrl');
    expect(schema.properties.education.items.required).toContain(
      'fieldOfStudy',
    );

    expect(body).toMatchObject({
      source: 'ai',
      analyzedBy: 'xAI · grok-teste',
      sentToExternalService: true,
      fields: { headline: 'Desenvolvedor Full-Stack Júnior' },
    });
  });

  it.each([
    ['chave recusada', 'bad-key', /chave da xAI foi recusada/],
    [
      'chave errada (a xAI responde 400)',
      'bad-key-400',
      /chave da xAI foi recusada/,
    ],
    [
      'limite ou falta de saldo',
      'rate-limit',
      /limite de utilização ou falta de saldo/,
    ],
  ] as const)('%s: segue sem IA e explica porquê', async (_c, m, message) => {
    mode = m;
    const { body } = await analyze().expect(200);
    expect(body.source).toBe('keywords');
    expect(body.warnings[0]).toMatch(message);
    // A chave nunca aparece na resposta.
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('modelo inexistente: diz quais existem', async () => {
    mode = 'unknown-model';
    const { body } = await analyze().expect(200);
    expect(body.warnings[0]).toMatch(
      /"grok-teste" não existe.*grok-a, grok-b.*XAI_MODEL/,
    );
  });

  describe('verificação no arranque', () => {
    const check = async () => {
      const { LlmStartupCheck } = await import('./llm-startup-check');
      return app.get(LlmStartupCheck).check();
    };

    it('chave e modelo certos: pronta', async () => {
      expect(await check()).toBe(true);
    });

    it('modelo que a conta não tem: indisponível', async () => {
      mode = 'unknown-model';
      expect(await check()).toBe(false);
    });

    it('chave errada: indisponível, sem enviar nenhum CV', async () => {
      mode = 'bad-key-400';
      expect(await check()).toBe(false);
      expect(last.path).toBeUndefined();
    });
  });
});
