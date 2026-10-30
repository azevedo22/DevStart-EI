/**
 * Análise de anúncios com IA (LLM_PROVIDER=groq, servidor falso): o pedido
 * leva o anúncio e um esquema estrito; a resposta é normalizada e ligada ao
 * catálogo; sem IA, a análise segue por palavras-chave.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const KEY = 'gsk_chave-de-teste';

const POSTING = `Junior Frontend Developer (m/f) — Lumen Cloud, Braga (híbrido)

Procuramos um(a) recém-licenciado(a) para a equipa de produto.
Requisitos: Angular, TypeScript, Git. Valorizado: Docker e testes com Jest.
Experiência de 0 a 1 ano; trabalho em equipas Scrum.`;

const ANSWER = {
  companyName: 'Lumen Cloud',
  jobTitle: 'Junior Frontend Developer',
  seniority: 'JUNIOR',
  yearsRequired: 0,
  experience: [
    'Trabalho em equipas ágeis (Scrum)',
    'Testes automatizados com Jest (valorizado)',
    'trabalho em equipas ágeis (scrum)',
  ],
  skills: ['Angular', 'TypeScript', 'Git', 'Docker', 'Jest', 'Figma Wizardry'],
  workMode: 'HYBRID',
  location: 'Braga',
};

type Mode = 'ok' | 'bad-key' | 'nonsense';

describeDb('Análise de anúncios com IA (e2e)', () => {
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
        mode === 'nonsense'
          ? {
              companyName: '  null ',
              jobTitle: 'x'.repeat(400),
              seniority: 'GURU',
              yearsRequired: -4,
              experience: 'não é uma lista',
              skills: [42, ''],
              workMode: 'MARTE',
              location: null,
            }
          : ANSWER;
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
          usage: { prompt_tokens: 400, completion_tokens: 120 },
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
    last = null;
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => groq?.close(r));
  });

  const analyze = (text: string = POSTING) =>
    http.post('/api/jobs/analyze').set('x-user-id', ANA).send({ text });

  it('preenche os campos e liga as competências ao catálogo', async () => {
    const { body } = await analyze().expect(200);

    expect(body).toMatchObject({
      source: 'ai',
      analyzedBy: 'Groq · modelo-groq',
      sentToExternalService: true,
      warnings: [],
      companyName: 'Lumen Cloud',
      jobTitle: 'Junior Frontend Developer',
      seniority: 'JUNIOR',
      yearsRequired: 0,
      workMode: 'HYBRID',
      location: 'Braga',
    });
    // Repetidos (só muda maiúsculas) aparecem uma vez.
    expect(body.experienceRequirements).toEqual([
      'Trabalho em equipas ágeis (Scrum)',
      'Testes automatizados com Jest (valorizado)',
    ]);
    expect(body.competencyIds).toEqual(
      expect.arrayContaining(['angular', 'typescript', 'git', 'docker']),
    );
    expect(body.otherSkills).toEqual(['Figma Wizardry']);
    // "Lumen Cloud" é o nome da empresa, não a competência Cloud.
    expect(body.competencyIds).not.toContain('cloud');

    // O pedido leva o anúncio e um esquema estrito com nome próprio.
    const format = last!['response_format'] as {
      type: string;
      json_schema: { name: string; strict: boolean };
    };
    expect(format.type).toBe('json_schema');
    expect(format.json_schema).toMatchObject({
      name: 'job_posting',
      strict: true,
    });
    const messages = last!['messages'] as { role: string; content: string }[];
    expect(messages[1].content).toContain('Lumen Cloud');
  });

  it('uma resposta disparatada não passa para o formulário', async () => {
    mode = 'nonsense';
    const { body } = await analyze().expect(200);
    expect(body.companyName).toBeNull();
    expect(body.jobTitle.length).toBeLessThanOrEqual(150);
    // Senioridade e anos inválidos: valem as palavras-chave do texto.
    expect(body.seniority).toBe('JUNIOR');
    expect(body.yearsRequired).toBe(0);
    expect(body.workMode).toBeNull();
    expect(body.experienceRequirements).toEqual([]);
    expect(body.competencyIds).toEqual(
      expect.arrayContaining(['angular', 'typescript']),
    );
  });

  it('sem IA (chave recusada): segue por palavras-chave e diz porquê', async () => {
    mode = 'bad-key';
    const { body } = await analyze().expect(200);
    expect(body).toMatchObject({
      source: 'keywords',
      companyName: null,
      jobTitle: null,
      seniority: 'JUNIOR',
      yearsRequired: 0,
      experienceRequirements: [],
    });
    expect(body.competencyIds).toContain('angular');
    expect(body.warnings[0]).toMatch(/sem IA.*chave da Groq foi recusada/);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it.each([
    ['texto curto', 'Vaga júnior'],
    ['texto enorme', 'a'.repeat(20_001)],
  ])('%s: 400', async (_c, text) => {
    await analyze(text).expect(400);
    expect(last).toBeNull();
  });

  it('exige sessão', async () => {
    await http.post('/api/jobs/analyze').send({ text: POSTING }).expect(401);
  });
});
