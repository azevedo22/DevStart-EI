/**
 * Vagas do ITJobs.pt: recolha (com um ITJobs e uma Groq falsos) e o feed de
 * cada utilizador, com filtros, compatibilidade com o perfil e vagas novas.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { JobSyncService } from './job-sync.service';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const RUI = '22222222-2222-4222-8222-222222222222';
const KEY = 'chave-itjobs-de-teste';

interface FakeJob {
  id: number;
  title: string;
  body: string;
  workModel?: number;
  company?: { name: string };
  locations?: { id: number; name: string }[];
  contracts?: { id: number; name: string }[];
  publishedAt?: string;
}

const PORTO = { id: 18, name: 'Porto' };
const LISBOA = { id: 14, name: 'Lisboa' };

const ANGULAR_JUNIOR: FakeJob = {
  id: 101,
  title: 'Junior Frontend Developer',
  body: '<p>Procuramos recém-licenciado.</p><ul><li>Angular</li><li>TypeScript</li></ul>',
  company: { name: 'Lumen Cloud' },
  locations: [PORTO],
  contracts: [{ id: 2, name: 'Contrato sem termo' }],
  workModel: 2,
  publishedAt: '2026-10-29 10:00:00',
};
const SENIOR: FakeJob = {
  id: 102,
  title: 'Senior Java Engineer',
  body: '<p>Mínimo de 5 anos de experiência com Java e Spring Boot.</p>',
  company: { name: 'Banco X' },
  locations: [LISBOA],
  publishedAt: '2026-10-28 10:00:00',
};
const ESTAGIO: FakeJob = {
  id: 103,
  title: 'Estágio Profissional Backend',
  body: '<p>Estágio profissional. Java, Docker &amp; Git. Trabalho remoto.</p>',
  company: { name: 'Serra Labs' },
  locations: [LISBOA],
  contracts: [{ id: 3, name: 'Estágio profissional' }],
  workModel: 1,
  publishedAt: '2026-10-30 09:00:00',
};

/** Resposta da IA para cada vaga (pelo título, que vai no texto). */
const AI_ANSWERS: Record<string, object> = {
  'Junior Frontend Developer': {
    companyName: 'Lumen Cloud',
    jobTitle: 'Junior Frontend Developer',
    seniority: 'JUNIOR',
    yearsRequired: 0,
    experience: ['Desenvolvimento de interfaces com Angular'],
    skills: ['Angular', 'TypeScript'],
    workMode: 'HYBRID',
    location: 'Porto',
  },
  'Estágio Profissional Backend': {
    companyName: 'Serra Labs',
    jobTitle: 'Estágio Profissional Backend',
    seniority: 'INTERN',
    yearsRequired: 0,
    experience: [],
    skills: ['Java', 'Docker', 'Git'],
    workMode: 'REMOTE',
    location: null,
  },
};

describeDb('Vagas do ITJobs.pt (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let itjobs: Server;
  let groq: Server;
  let sync: JobSyncService;
  let db: DataSource;

  /** O que o ITJobs falso devolve (para o termo "junior"; os outros repetem ou vêm vazios). */
  let listed: FakeJob[] = [];
  let itjobsStatus = 200;
  const keysSeen: string[] = [];
  let aiCalls: string[] = [];

  beforeAll(async () => {
    itjobs = createServer((req: IncomingMessage, res) => {
      const url = new URL(req.url!, 'http://x');
      keysSeen.push(url.searchParams.get('api_key') ?? '');
      res.setHeader('content-type', 'application/json');
      res.statusCode = itjobsStatus;
      if (itjobsStatus !== 200) return res.end('{"error":"x"}');
      const term = url.searchParams.get('q');
      const page = Number(url.searchParams.get('page'));
      // "junior" devolve tudo; "estágio" repete o estágio (junta-se pelo id).
      const results =
        page > 1
          ? []
          : term === 'junior'
            ? listed
            : term === 'estágio'
              ? listed.filter((j) => j.id === ESTAGIO.id)
              : [];
      res.end(JSON.stringify({ total: results.length, results }));
    });
    groq = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      res.setHeader('content-type', 'application/json');
      if (req.url?.endsWith('/models'))
        return res.end(JSON.stringify({ data: [{ id: 'modelo-groq' }] }));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const text: string = body.messages[1].content;
      const title = Object.keys(AI_ANSWERS).find((t) => text.includes(t));
      aiCalls.push(title ?? '?');
      res.end(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify(AI_ANSWERS[title!] ?? {}) } },
          ],
        }),
      );
    });
    await new Promise<void>((r) => itjobs.listen(0, '127.0.0.1', r));
    await new Promise<void>((r) => groq.listen(0, '127.0.0.1', r));

    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_teste',
      GROQ_MODEL: 'modelo-groq',
      GROQ_BASE_URL: `http://127.0.0.1:${(groq.address() as AddressInfo).port}/openai/v1`,
      ITJOBS_API_KEY: KEY,
      ITJOBS_BASE_URL: `http://127.0.0.1:${(itjobs.address() as AddressInfo).port}`,
      JOB_SYNC_AI_PER_RUN: '10',
    });
    const { AppModule } = await import('../app.module');
    const { configureApp } = await import('@devstart/backend-common');
    const { JobSyncService } = await import('./job-sync.service');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    sync = app.get(JobSyncService);
    db = app.get(DataSource);
  }, 30_000);

  beforeEach(async () => {
    await db.query(
      'TRUNCATE "job_listings", "job_feed_visits", "profile_competencies"',
    );
    listed = [ANGULAR_JUNIOR, SENIOR, ESTAGIO];
    itjobsStatus = 200;
    aiCalls = [];
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => itjobs?.close(r));
    await new Promise((r) => groq?.close(r));
  });

  const as = (userId: string) => ({
    get: (url: string) => http.get(url).set('x-user-id', userId),
    put: (url: string, body?: object) =>
      http.put(url).set('x-user-id', userId).send(body),
  });
  const ana = as(ANA);
  const feed = async (query = '') =>
    (await ana.get(`/api/jobs/feed${query}`).expect(200)).body;

  describe('recolha', () => {
    it('guarda as vagas, junta repetidas e só a IA lê as que não são pouco realistas', async () => {
      const r = await sync.sync();
      expect(r).toEqual({ fetched: 3, added: 3, closed: 0, analyzedByAi: 2 });
      // A sénior (5 anos) ficou pela triagem: não gasta IA.
      expect(aiCalls.sort()).toEqual([
        'Estágio Profissional Backend',
        'Junior Frontend Developer',
      ]);
      expect(keysSeen.every((k) => k === KEY)).toBe(true);

      const rows = await db.query(
        `SELECT source_id, analysis_source, accessibility, seniority, summary, url
           FROM job_listings ORDER BY source_id`,
      );
      expect(rows).toEqual([
        expect.objectContaining({
          source_id: '101',
          analysis_source: 'ai',
          accessibility: 'ENTRY_FRIENDLY',
          url: 'https://www.itjobs.pt/oferta/101',
        }),
        expect.objectContaining({
          source_id: '102',
          analysis_source: 'keywords',
          accessibility: 'UNREALISTIC',
        }),
        expect.objectContaining({
          source_id: '103',
          analysis_source: 'ai',
          seniority: 'INTERN',
          // HTML passou a texto, com as entidades descodificadas.
          summary: 'Estágio profissional. Java, Docker & Git. Trabalho remoto.',
        }),
      ]);
    });

    it('na recolha seguinte, só as vagas novas são analisadas', async () => {
      await sync.sync();
      aiCalls = [];
      expect(await sync.sync()).toMatchObject({ added: 0, analyzedByAi: 0 });
      expect(aiCalls).toEqual([]);
    });

    it('vagas que desaparecem do ITJobs ficam fechadas e saem do feed', async () => {
      await sync.sync();
      listed = [ANGULAR_JUNIOR, SENIOR];
      expect(await sync.sync()).toMatchObject({ closed: 1 });
      const { items } = await feed('?includeUnrealistic=true');
      expect(items.map((i: { title: string }) => i.title)).not.toContain(
        ESTAGIO.title,
      );
    });

    it('uma resposta vazia ou um erro do ITJobs não fecha nada', async () => {
      await sync.sync();
      listed = [];
      expect(await sync.sync()).toMatchObject({ fetched: 0, closed: 0 });
      itjobsStatus = 401;
      await expect(sync.sync()).rejects.toThrow(
        /chave do ITJobs.pt foi recusada/,
      );
      expect((await feed('?includeUnrealistic=true')).items).toHaveLength(3);
    });
  });

  describe('feed', () => {
    beforeEach(async () => {
      await sync.sync();
    });

    it('esconde as pouco realistas e compara com o perfil', async () => {
      await ana
        .put('/api/profile/competencies/angular', { level: 'BASIC' })
        .expect(200);
      const body = await feed();
      expect(body).toMatchObject({ totalOpen: 3, enabled: true });
      expect(body.lastSyncAt).toEqual(expect.any(String));
      // Ordenadas pela compatibilidade: 1 de 2 no Angular, 0 de 3 no estágio.
      expect(
        body.items.map((i: { title: string; matchPercentage: number }) => [
          i.title,
          i.matchPercentage,
        ]),
      ).toEqual([
        ['Junior Frontend Developer', 50],
        ['Estágio Profissional Backend', 0],
      ]);
      expect(body.items[0]).toMatchObject({
        companyName: 'Lumen Cloud',
        locations: ['Porto'],
        workMode: 'HYBRID',
        matched: ['angular'],
        missing: ['typescript'],
        experienceRequirements: ['Desenvolvimento de interfaces com Angular'],
        analyzedBy: 'ai',
        isNew: false,
      });
      // O texto completo fica no ITJobs: o feed só leva o resumo.
      expect(body.items[0].body).toBeUndefined();
    });

    it.each([
      ['Porto', '?locations=18', ['Junior Frontend Developer']],
      ['remoto', '?remote=true', ['Estágio Profissional Backend']],
      [
        'Porto ou remoto',
        '?locations=18&remote=true',
        ['Junior Frontend Developer', 'Estágio Profissional Backend'],
      ],
      [
        'estágio profissional',
        '?contracts=3',
        ['Estágio Profissional Backend'],
      ],
      [
        'stack Java/Spring',
        '?stackId=junior-backend-java-spring',
        ['Estágio Profissional Backend'],
      ],
      [
        'com as pouco realistas',
        '?includeUnrealistic=1&locations=14',
        ['Estágio Profissional Backend', 'Senior Java Engineer'],
      ],
    ])('filtro: %s', async (_c, query, titles) => {
      const { items } = await feed(query);
      expect(items.map((i: { title: string }) => i.title).sort()).toEqual(
        [...titles].sort(),
      );
    });

    it('filtros inválidos: 400', async () => {
      await ana.get('/api/jobs/feed?locations=999').expect(400);
      await ana.get('/api/jobs/feed?contracts=abc').expect(400);
      await ana.get('/api/jobs/feed?stackId=nao-existe').expect(404);
    });

    it('vagas novas desde a última visita, com os filtros dessa visita', async () => {
      // Primeira visita: nada é "novo".
      expect(
        (await feed()).items.every((i: { isNew: boolean }) => !i.isNew),
      ).toBe(true);
      await ana
        .put('/api/jobs/feed/visit', { locations: [18], remote: true })
        .expect(204);
      expect(
        (await ana.get('/api/jobs/feed/last-query').expect(200)).body,
      ).toEqual({ locations: [18], remote: true });

      // Aparecem duas vagas: uma no Porto, outra em Lisboa (fora dos filtros).
      listed = [
        ...listed,
        { ...ANGULAR_JUNIOR, id: 201, title: 'Junior Angular Developer' },
        {
          ...ANGULAR_JUNIOR,
          id: 202,
          title: 'Junior Angular Lisboa',
          locations: [LISBOA],
          workModel: 0,
        },
      ];
      await new Promise((r) => setTimeout(r, 20));
      await sync.sync();

      expect(
        (await ana.get('/api/jobs/feed/new-count').expect(200)).body,
      ).toEqual({ count: 1 });
      const { items } = await feed('?locations=18&remote=true');
      expect(
        items
          .filter((i: { isNew: boolean }) => i.isNew)
          .map((i: { title: string }) => i.title),
      ).toEqual(['Junior Angular Developer']);

      // Depois de ver, deixa de haver novas.
      await ana
        .put('/api/jobs/feed/visit', { locations: [18], remote: true })
        .expect(204);
      expect(
        (await ana.get('/api/jobs/feed/new-count').expect(200)).body,
      ).toEqual({ count: 0 });
      // E a outra pessoa não tem visita: zero, sem erro.
      expect(
        (await as(RUI).get('/api/jobs/feed/new-count').expect(200)).body,
      ).toEqual({ count: 0 });
    });

    it('exige sessão', async () => {
      await http.get('/api/jobs/feed').expect(401);
    });
  });
});
