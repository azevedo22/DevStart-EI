/**
 * Testes e2e do Application Tracker Service contra um PostgreSQL real.
 * Correm quando TEST_DATABASE_URL está definido; sem ele, são ignorados.
 */
import { configureApp, createEvent } from '@devstart/backend-common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ApplicationBoard,
  JobApplication,
  silenceOf,
} from '@devstart/shared-types';
import request from 'supertest';
import { DataSource } from 'typeorm';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const RUI = '22222222-2222-4222-8222-222222222222';

const JOB = {
  companyName: 'Empresa Exemplo',
  jobTitle: 'Junior Frontend Developer',
  jobUrl: 'https://exemplo.pt/vagas/123',
  location: 'Porto',
  workMode: 'HYBRID',
  requiredCompetencyIds: ['angular', 'typescript', 'git'],
  yearsRequired: 1,
  seniority: 'JUNIOR',
  appliedAt: '2026-10-20',
};

const INTERVIEW = {
  type: 'TECHNICAL',
  scheduledAt: '2026-11-03T10:00:00Z',
  completed: true,
  rating: 4,
  outcome: 'PENDING',
  questionsAsked: [
    '  Diferença entre Observable e Promise?  ',
    '',
    'Como funciona o change detection?',
  ],
  strengths: 'Expliquei bem o projeto final.',
  improvements: 'Rever algoritmos de ordenação.',
};

describeDb('Application Tracker Service (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    // REDIS_URL vazio: o consumidor de eventos não arranca; os handlers são chamados diretamente.
    Object.assign(process.env, {
      NODE_ENV: 'test',
      TRACKER_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
    });
    const { AppModule } = await import('./app.module');
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
      .query(
        'TRUNCATE "interviews", "application_status_history", "applications" CASCADE',
      );
  });

  afterAll(async () => {
    await app?.close();
  });

  const as = (userId: string) => ({
    get: (url: string) => http.get(url).set('x-user-id', userId),
    post: (url: string, body?: object) =>
      http.post(url).set('x-user-id', userId).send(body),
    put: (url: string, body?: object) =>
      http.put(url).set('x-user-id', userId).send(body),
    patch: (url: string, body?: object) =>
      http.patch(url).set('x-user-id', userId).send(body),
    delete: (url: string) => http.delete(url).set('x-user-id', userId),
  });
  const ana = as(ANA);
  const rui = as(RUI);

  const create = async (patch: object = {}): Promise<JobApplication> =>
    (await ana.post('/api/applications', { ...JOB, ...patch }).expect(201))
      .body;

  const board = async (): Promise<ApplicationBoard> =>
    (await ana.get('/api/applications/board').expect(200)).body;

  /** Cada coluna tem posições 0..n-1, sem buracos nem repetidos. */
  async function expectContiguousPositions() {
    for (const [status, cards] of Object.entries(await board())) {
      expect({ status, positions: cards.map((c) => c.position) }).toEqual({
        status,
        positions: cards.map((_, i) => i),
      });
    }
  }

  const column = async (status: keyof ApplicationBoard) =>
    (await board())[status].map((c) => c.companyName);

  describe('criar e editar', () => {
    it('cria no topo da coluna "Candidatado" e calcula a acessibilidade', async () => {
      const first = await create({ companyName: 'A' });
      const second = await create({ companyName: 'B' });
      expect(first).toMatchObject({
        status: 'APPLIED',
        accessibility: 'ENTRY_FRIENDLY',
        mislabeledJunior: false,
      });
      expect(second.position).toBe(0);
      expect(await column('APPLIED')).toEqual(['B', 'A']);
    });

    it('marca vagas júnior que pedem 3+ anos', async () => {
      const r = await create({ yearsRequired: 4, seniority: 'JUNIOR' });
      expect(r).toMatchObject({
        accessibility: 'UNREALISTIC',
        mislabeledJunior: true,
      });
    });

    it('não aceita a acessibilidade vinda do cliente', async () => {
      await ana
        .post('/api/applications', { ...JOB, accessibility: 'ENTRY_FRIENDLY' })
        .expect(400);
    });

    it('recalcula a acessibilidade ao editar', async () => {
      const r = await create();
      const { body } = await ana
        .put(`/api/applications/${r.id}`, { ...JOB, yearsRequired: 2 })
        .expect(200);
      expect(body.accessibility).toBe('STRETCH');
    });

    it('não deixa mudar de coluna pelo PUT (só por /move, para ficar no histórico)', async () => {
      const r = await create();
      await ana
        .put(`/api/applications/${r.id}`, { ...JOB, status: 'OFFER' })
        .expect(400);
    });

    it.each([
      ['link javascript:', { jobUrl: 'javascript:alert(1)' }],
      ['data impossível', { appliedAt: '2026-13-45' }],
      ['data noutro formato', { appliedAt: '20/10/2026' }],
      ['anos negativos', { yearsRequired: -1 }],
      [
        'competência com formato inválido',
        { requiredCompetencyIds: ['Angular!'] },
      ],
      ['empresa vazia', { companyName: '   ' }],
    ])('recusa %s', async (_case, patch) => {
      await ana.post('/api/applications', { ...JOB, ...patch }).expect(400);
    });
  });

  describe('mover no Kanban', () => {
    async function seed() {
      // Fica APPLIED: [C, B, A]
      for (const name of ['A', 'B', 'C']) await create({ companyName: name });
      return board().then((b) =>
        Object.fromEntries(b.APPLIED.map((c) => [c.companyName, c.id])),
      );
    }

    it('move entre colunas, fecha o buraco na origem e regista o histórico', async () => {
      const ids = await seed();
      await ana
        .patch(`/api/applications/${ids['B']}/move`, {
          status: 'HR_INTERVIEW',
          position: 0,
        })
        .expect(200);

      expect(await column('APPLIED')).toEqual(['C', 'A']);
      expect(await column('HR_INTERVIEW')).toEqual(['B']);
      await expectContiguousPositions();

      const { body } = await ana
        .get(`/api/applications/${ids['B']}`)
        .expect(200);
      expect(
        body.history.map((h: { from: string; to: string }) => [h.from, h.to]),
      ).toEqual([
        [null, 'APPLIED'],
        ['APPLIED', 'HR_INTERVIEW'],
      ]);
    });

    it('reordena dentro da mesma coluna, para baixo e para cima', async () => {
      const ids = await seed();
      await ana
        .patch(`/api/applications/${ids['C']}/move`, {
          status: 'APPLIED',
          position: 2,
        })
        .expect(200);
      expect(await column('APPLIED')).toEqual(['B', 'A', 'C']);
      await ana
        .patch(`/api/applications/${ids['A']}/move`, {
          status: 'APPLIED',
          position: 0,
        })
        .expect(200);
      expect(await column('APPLIED')).toEqual(['A', 'B', 'C']);
      await expectContiguousPositions();
    });

    it('uma posição para lá do fim vai para o fim da coluna', async () => {
      const ids = await seed();
      await ana
        .patch(`/api/applications/${ids['C']}/move`, {
          status: 'APPLIED',
          position: 99,
        })
        .expect(200);
      expect(await column('APPLIED')).toEqual(['B', 'A', 'C']);
    });

    it('reordenar na mesma coluna não cria entradas no histórico', async () => {
      const ids = await seed();
      await ana
        .patch(`/api/applications/${ids['C']}/move`, {
          status: 'APPLIED',
          position: 1,
        })
        .expect(200);
      const { body } = await ana
        .get(`/api/applications/${ids['C']}`)
        .expect(200);
      expect(body.history).toHaveLength(1);
    });

    it('apagar fecha o buraco na coluna', async () => {
      const ids = await seed();
      await ana.delete(`/api/applications/${ids['B']}`).expect(204);
      expect(await column('APPLIED')).toEqual(['C', 'A']);
      await expectContiguousPositions();
    });

    it('20 movimentos em simultâneo não baralham as posições', async () => {
      for (let i = 0; i < 6; i++) await create({ companyName: `E${i}` });
      const { APPLIED } = await board();
      const targets = ['TECHNICAL_TEST', 'HR_INTERVIEW', 'APPLIED', 'OFFER'];

      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          ana
            .patch(`/api/applications/${APPLIED[i % APPLIED.length].id}/move`, {
              status: targets[i % targets.length],
              position: i % 3,
            })
            .expect(200),
        ),
      );

      await expectContiguousPositions();
      const total = Object.values(await board()).reduce(
        (n, cards) => n + cards.length,
        0,
      );
      expect(total).toBe(6);
    });
  });

  describe('entrevistas', () => {
    it('regista uma entrevista com feedback e limpa perguntas vazias', async () => {
      const r = await create();
      const { body } = await ana
        .post(`/api/applications/${r.id}/interviews`, INTERVIEW)
        .expect(201);
      expect(body.questionsAsked).toEqual([
        'Diferença entre Observable e Promise?',
        'Como funciona o change detection?',
      ]);
      expect(body.rating).toBe(4);

      const detail = (await ana.get(`/api/applications/${r.id}`).expect(200))
        .body;
      expect(detail.interviewCount).toBe(1);
      expect(detail.interviews).toHaveLength(1);
    });

    it('descarta a avaliação de entrevistas que ainda não aconteceram', async () => {
      const r = await create();
      const { body } = await ana
        .post(`/api/applications/${r.id}/interviews`, {
          ...INTERVIEW,
          completed: false,
        })
        .expect(201);
      expect(body.rating).toBeNull();
    });

    it('recusa avaliações fora de 1 a 5', async () => {
      const r = await create();
      await ana
        .post(`/api/applications/${r.id}/interviews`, {
          ...INTERVIEW,
          rating: 9,
        })
        .expect(400);
    });

    it('apagar a candidatura apaga as entrevistas e o histórico', async () => {
      const r = await create();
      await ana
        .post(`/api/applications/${r.id}/interviews`, INTERVIEW)
        .expect(201);
      await ana.delete(`/api/applications/${r.id}`).expect(204);
      const [{ i }] = await app
        .get(DataSource)
        .query('SELECT count(*)::int AS i FROM interviews');
      const [{ h }] = await app
        .get(DataSource)
        .query('SELECT count(*)::int AS h FROM application_status_history');
      expect([i, h]).toEqual([0, 0]);
    });
  });

  describe('isolamento entre utilizadores', () => {
    it('ninguém vê nem mexe nas candidaturas de outra pessoa', async () => {
      const r = await create();
      expect((await rui.get('/api/applications').expect(200)).body).toEqual([]);
      await rui.get(`/api/applications/${r.id}`).expect(404);
      await rui.put(`/api/applications/${r.id}`, JOB).expect(404);
      await rui
        .patch(`/api/applications/${r.id}/move`, {
          status: 'OFFER',
          position: 0,
        })
        .expect(404);
      await rui.delete(`/api/applications/${r.id}`).expect(404);
      await rui
        .post(`/api/applications/${r.id}/interviews`, INTERVIEW)
        .expect(404);
    });

    it('nem as entrevistas', async () => {
      const r = await create();
      const { body: iv } = await ana
        .post(`/api/applications/${r.id}/interviews`, INTERVIEW)
        .expect(201);
      await rui.put(`/api/interviews/${iv.id}`, INTERVIEW).expect(404);
      await rui.delete(`/api/interviews/${iv.id}`).expect(404);
      await ana.delete(`/api/interviews/${iv.id}`).expect(204);
    });

    it('as posições de um utilizador não afetam as do outro', async () => {
      await create({ companyName: 'A1' });
      await rui
        .post('/api/applications', { ...JOB, companyName: 'R1' })
        .expect(201);
      const ruiBoard = (await rui.get('/api/applications/board').expect(200))
        .body as ApplicationBoard;
      expect(ruiBoard.APPLIED.map((c) => c.position)).toEqual([0]);
    });
  });

  describe('filtros e estatísticas', () => {
    it('filtra por acessibilidade e pesquisa por empresa ou título', async () => {
      await create({ companyName: 'Acessível Lda' });
      await create({ companyName: 'Exigente SA', yearsRequired: 5 });

      const friendly = (
        await ana
          .get('/api/applications?accessibility=ENTRY_FRIENDLY')
          .expect(200)
      ).body;
      expect(friendly.map((a: JobApplication) => a.companyName)).toEqual([
        'Acessível Lda',
      ]);

      const found = (await ana.get('/api/applications?q=exig').expect(200))
        .body;
      expect(found.map((a: JobApplication) => a.companyName)).toEqual([
        'Exigente SA',
      ]);

      // % e _ do utilizador são texto, não curingas.
      expect(
        (await ana.get('/api/applications?q=%25').expect(200)).body,
      ).toEqual([]);
    });

    it('calcula taxa de resposta, processos ativos e propostas', async () => {
      const a = await create({ companyName: 'A' });
      const b = await create({ companyName: 'B' });
      await create({ companyName: 'C' });
      await create({ companyName: 'D' });

      await ana
        .patch(`/api/applications/${a.id}/move`, {
          status: 'HR_INTERVIEW',
          position: 0,
        })
        .expect(200);
      await ana
        .patch(`/api/applications/${b.id}/move`, {
          status: 'REJECTED',
          position: 0,
        })
        .expect(200);
      await ana
        .post(`/api/applications/${a.id}/interviews`, INTERVIEW)
        .expect(201);

      const { body } = await ana.get('/api/applications/stats').expect(200);
      expect(body).toMatchObject({
        total: 4,
        active: 3,
        responseRate: 50,
        interviews: 1,
        offers: 0,
      });
      expect(body.byStatus).toMatchObject({
        APPLIED: 2,
        HR_INTERVIEW: 1,
        REJECTED: 1,
      });
    });

    it('um cartão movido por engano e posto de volta não conta como resposta', async () => {
      const a = await create({ companyName: 'Engano' });
      await create({ companyName: 'Outra' });
      for (const status of ['TECHNICAL_TEST', 'APPLIED'])
        await ana
          .patch(`/api/applications/${a.id}/move`, { status, position: 0 })
          .expect(200);
      const { body } = await ana.get('/api/applications/stats').expect(200);
      expect(body).toMatchObject({ total: 2, active: 2, responseRate: 0 });
    });

    it('sem candidaturas, a taxa de resposta é null e não 0%', async () => {
      const { body } = await ana.get('/api/applications/stats').expect(200);
      expect(body).toMatchObject({ total: 0, responseRate: null });
    });
  });

  describe('"Sem resposta" (a empresa nunca respondeu)', () => {
    it('não é uma rejeição nem uma resposta, e deixa de estar ativa', async () => {
      const a = await create({
        companyName: 'Silenciosa',
        appliedAt: '2026-09-20',
      });
      await create({ companyName: 'Outra' });
      await ana
        .patch(`/api/applications/${a.id}/move`, {
          status: 'NO_RESPONSE',
          position: 0,
        })
        .expect(200);

      const { body } = await ana.get('/api/applications/stats').expect(200);
      expect(body).toMatchObject({
        total: 2,
        active: 1,
        responseRate: 0,
        byStatus: { NO_RESPONSE: 1, APPLIED: 1, REJECTED: 0 },
      });
      const today = new Date().toISOString().slice(0, 10);
      const { body: activity } = await ana
        .get(`/api/applications/activity?from=${today}&to=${today}`)
        .expect(200);
      expect(
        activity.filter((e: { kind: string }) => e.kind !== 'APPLIED'),
      ).toEqual([]);
    });

    it('se a empresa responder mais tarde, conta como resposta', async () => {
      const a = await create({
        companyName: 'Tardia',
        appliedAt: '2026-09-20',
      });
      for (const status of ['NO_RESPONSE', 'HR_INTERVIEW'])
        await ana
          .patch(`/api/applications/${a.id}/move`, { status, position: 0 })
          .expect(200);
      const { body } = await ana.get('/api/applications/stats').expect(200);
      expect(body).toMatchObject({ responseRate: 100, active: 1 });
    });
  });

  describe('"Por candidatar" (vagas guardadas)', () => {
    const stats = async () =>
      (await ana.get('/api/applications/stats').expect(200)).body;

    it('guardar não é candidatar-se: não conta nos totais nem na atividade', async () => {
      await create({ appliedAt: '2026-10-26' });
      const saved = await create({
        companyName: 'Guardada',
        status: 'SAVED',
        appliedAt: '2026-10-27',
      });
      expect(saved.status).toBe('SAVED');
      expect(await stats()).toMatchObject({
        total: 1,
        saved: 1,
        active: 1,
        byStatus: { SAVED: 1, APPLIED: 1 },
      });
      const { body } = await ana
        .get('/api/applications/activity?from=2026-10-26&to=2026-11-01')
        .expect(200);
      expect(body.map((e: { subject: string }) => e.subject)).toEqual([
        JOB.companyName,
      ]);
    });

    it('ao sair da coluna, passa a ser candidatura com a data desse dia', async () => {
      const saved = await create({ status: 'SAVED', appliedAt: '2026-10-20' });
      const { body: moved } = await ana
        .patch(`/api/applications/${saved.id}/move`, {
          status: 'APPLIED',
          position: 0,
          appliedAt: '2026-10-29',
        })
        .expect(200);
      expect(moved).toMatchObject({
        status: 'APPLIED',
        appliedAt: '2026-10-29',
      });
      // Sair de "Por candidatar" não é uma resposta da empresa.
      expect(await stats()).toMatchObject({
        total: 1,
        saved: 0,
        responseRate: 0,
      });
      const { body } = await ana
        .get('/api/applications/activity?from=2026-10-26&to=2026-11-01')
        .expect(200);
      expect(body.map((e: { kind: string }) => e.kind)).toEqual(['APPLIED']);
    });

    it('mover entre outras colunas não muda a data', async () => {
      const a = await create({ appliedAt: '2026-10-20' });
      const { body } = await ana
        .patch(`/api/applications/${a.id}/move`, {
          status: 'HR_INTERVIEW',
          position: 0,
          appliedAt: '2026-10-29',
        })
        .expect(200);
      expect(body.appliedAt).toBe('2026-10-20');
    });

    it('data inválida ao mover: 400', async () => {
      const saved = await create({ status: 'SAVED' });
      await ana
        .patch(`/api/applications/${saved.id}/move`, {
          status: 'APPLIED',
          position: 0,
          appliedAt: '2026-02-31',
        })
        .expect(400);
    });
  });

  describe('competências fora do catálogo', () => {
    it('guarda sem vazias nem repetidas (sem contar maiúsculas)', async () => {
      const a = await create({
        otherSkills: [' C/C++ ', '', 'c/c++', 'Microcontroladores'],
      });
      expect(a.otherSkills).toEqual(['C/C++', 'Microcontroladores']);
      const { body } = await ana.get(`/api/applications/${a.id}`).expect(200);
      expect(body.otherSkills).toEqual(['C/C++', 'Microcontroladores']);
      expect((await create()).otherSkills).toEqual([]);
    });

    it('recusa itens demasiado longos ou demasiados itens', async () => {
      await ana
        .post('/api/applications', { ...JOB, otherSkills: ['x'.repeat(61)] })
        .expect(400);
      await ana
        .post('/api/applications', {
          ...JOB,
          otherSkills: Array.from({ length: 16 }, (_, i) => `s${i}`),
        })
        .expect(400);
    });
  });

  describe('experiência pedida', () => {
    it('guarda a lista sem linhas vazias e devolve-a', async () => {
      const a = await create({
        experienceRequirements: [
          '  2 anos com APIs REST  ',
          '',
          'Trabalho em equipas Agile',
        ],
      });
      expect(a.experienceRequirements).toEqual([
        '2 anos com APIs REST',
        'Trabalho em equipas Agile',
      ]);
      const { body } = await ana.get(`/api/applications/${a.id}`).expect(200);
      expect(body.experienceRequirements).toHaveLength(2);
    });

    it('sem o campo, fica uma lista vazia', async () => {
      expect((await create()).experienceRequirements).toEqual([]);
    });

    it('recusa itens demasiado longos ou demasiados itens', async () => {
      await ana
        .post('/api/applications', {
          ...JOB,
          experienceRequirements: ['x'.repeat(201)],
        })
        .expect(400);
      await ana
        .post('/api/applications', {
          ...JOB,
          experienceRequirements: Array.from({ length: 11 }, (_, i) => `e${i}`),
        })
        .expect(400);
    });
  });

  describe('atividade por dia (relatório semanal)', () => {
    const WEEK = '?from=2026-10-26&to=2026-11-01';
    const db = () => app.get(DataSource);
    const move = (id: string, status: string) =>
      ana
        .patch(`/api/applications/${id}/move`, { status, position: 0 })
        .expect(200);
    /** Põe a última mudança de estado numa hora conhecida. */
    const lastMoveAt = (id: string, at: string) =>
      db().query(
        `UPDATE application_status_history SET changed_at = $2
          WHERE id = (SELECT id FROM application_status_history
                       WHERE application_id = $1 ORDER BY changed_at DESC LIMIT 1)`,
        [id, at],
      );

    it('candidaturas, respostas e entrevistas, cada uma no seu dia', async () => {
      const farfetch = await create({
        companyName: 'Farfetch',
        appliedAt: '2026-10-26',
      });
      const critical = await create({
        companyName: 'Critical',
        appliedAt: '2026-10-27',
      });
      await create({ companyName: 'Antiga', appliedAt: '2026-10-01' });

      await move(critical.id, 'HR_INTERVIEW');
      await lastMoveAt(critical.id, '2026-10-27T15:00:00Z');
      await move(farfetch.id, 'REJECTED');
      await lastMoveAt(farfetch.id, '2026-10-30T09:00:00Z');

      // Marcada na quarta para quinta; a segunda já fica para a semana seguinte.
      const first = (
        await ana
          .post(`/api/applications/${critical.id}/interviews`, {
            ...INTERVIEW,
            type: 'HR',
            scheduledAt: '2026-10-29T10:00:00Z',
          })
          .expect(201)
      ).body;
      await db().query(
        `UPDATE interviews SET created_at = '2026-10-28T09:00:00Z' WHERE id = $1`,
        [first.id],
      );
      const second = (
        await ana
          .post(`/api/applications/${critical.id}/interviews`, {
            ...INTERVIEW,
            type: 'TECHNICAL',
            scheduledAt: '2026-11-03T10:00:00Z',
          })
          .expect(201)
      ).body;
      await db().query(
        `UPDATE interviews SET created_at = '2026-11-03T08:00:00Z' WHERE id = $1`,
        [second.id],
      );

      // Outra pessoa, mesma semana: não aparece.
      await rui
        .post('/api/applications', { ...JOB, appliedAt: '2026-10-27' })
        .expect(201);

      const { body } = await ana
        .get(`/api/applications/activity${WEEK}&tz=Europe/Lisbon`)
        .expect(200);
      expect(
        body.map((e: Record<string, unknown>) => [
          e['date'],
          e['kind'],
          e['subject'],
        ]),
      ).toEqual([
        ['2026-10-26', 'APPLIED', 'Farfetch'],
        ['2026-10-27', 'APPLIED', 'Critical'],
        ['2026-10-27', 'RESPONSE_POSITIVE', 'Critical'],
        ['2026-10-28', 'INTERVIEW_SCHEDULED', 'Critical'],
        ['2026-10-29', 'INTERVIEW', 'Critical'],
        ['2026-10-30', 'REJECTED', 'Farfetch'],
      ]);
      expect(body[2]).toMatchObject({ status: 'HR_INTERVIEW' });
      expect(body[4]).toMatchObject({
        interviewType: 'HR',
        round: 1,
        at: '2026-10-29T10:00:00.000Z',
        jobTitle: JOB.jobTitle,
      });

      // A 2.ª entrevista aparece na semana dela, com o número certo.
      const next = (
        await ana
          .get('/api/applications/activity?from=2026-11-02&to=2026-11-08')
          .expect(200)
      ).body;
      expect(next).toEqual([
        expect.objectContaining({
          date: '2026-11-03',
          kind: 'INTERVIEW',
          round: 2,
          interviewType: 'TECHNICAL',
        }),
      ]);
    });

    it('o dia de cada resposta depende do fuso do utilizador', async () => {
      const a = await create({ appliedAt: '2026-10-26' });
      await move(a.id, 'TECHNICAL_TEST');
      await lastMoveAt(a.id, '2026-10-27T23:30:00Z');
      const dayIn = async (tz: string) =>
        (
          await ana
            .get(
              `/api/applications/activity${WEEK}&tz=${encodeURIComponent(tz)}`,
            )
            .expect(200)
        ).body.find((e: { kind: string }) => e.kind === 'RESPONSE_POSITIVE')
          .date;
      expect(await dayIn('Europe/Lisbon')).toBe('2026-10-27');
      expect(await dayIn('Asia/Tokyo')).toBe('2026-10-28');
    });

    it('um movimento desfeito (ir e voltar logo) não conta, nem o regresso', async () => {
      const a = await create({ appliedAt: '2026-10-26' });
      await move(a.id, 'REJECTED');
      await move(a.id, 'APPLIED');
      await lastMoveAt(a.id, '2026-10-28T10:00:00Z');
      await db().query(
        `UPDATE application_status_history SET changed_at = '2026-10-27T10:00:00Z'
          WHERE application_id = $1 AND to_status = 'REJECTED'`,
        [a.id],
      );
      const { body } = await ana
        .get(`/api/applications/activity${WEEK}`)
        .expect(200);
      expect(body.map((e: { kind: string }) => e.kind)).toEqual(['APPLIED']);
    });

    it('rejeição corrigida por outro caminho até "Candidatado" não conta', async () => {
      const a = await create({ appliedAt: '2026-10-26' });
      for (const status of ['REJECTED', 'TECHNICAL_TEST', 'APPLIED'])
        await move(a.id, status);
      await db().query(
        // Leva tudo para a semana do teste, mantendo a ordem dos movimentos.
        `UPDATE application_status_history
            SET changed_at = changed_at - (now() - '2026-10-28T10:00:00Z')
          WHERE application_id = $1`,
        [a.id],
      );
      const { body } = await ana
        .get(`/api/applications/activity${WEEK}`)
        .expect(200);
      expect(body.map((e: { kind: string }) => e.kind)).toEqual(['APPLIED']);
    });

    it('desfeito e feito outra vez: conta uma vez', async () => {
      const a = await create({ appliedAt: '2026-10-26' });
      for (const status of ['HR_INTERVIEW', 'APPLIED', 'HR_INTERVIEW'])
        await move(a.id, status);
      await db().query(
        // Leva tudo para a semana do teste, mantendo a ordem dos movimentos.
        `UPDATE application_status_history
            SET changed_at = changed_at - (now() - '2026-10-28T10:00:00Z')
          WHERE application_id = $1`,
        [a.id],
      );
      const { body } = await ana
        .get(`/api/applications/activity${WEEK}`)
        .expect(200);
      expect(body.map((e: { kind: string }) => e.kind)).toEqual([
        'APPLIED',
        'RESPONSE_POSITIVE',
      ]);
    });

    it.each([
      ['sem datas', ''],
      ['data inválida', '?from=2026-13-01&to=2026-12-02'],
      ['intervalo grande', '?from=2026-01-01&to=2026-12-31'],
      ['fuso desconhecido', `${WEEK}&tz=Marte/Olympus`],
    ])('%s: 400', async (_c, query) => {
      await ana.get(`/api/applications/activity${query}`).expect(400);
    });
  });

  describe('evento user.deleted', () => {
    const deleted = async (userId: string) => {
      const { UserEventsSubscriber } =
        await import('./events/user-events.subscriber');
      await app
        .get(UserEventsSubscriber)
        .onUserDeleted(createEvent('user.deleted', { userId }));
    };

    it('apaga candidaturas, histórico e entrevistas só desse utilizador', async () => {
      const a = await create();
      await ana
        .post(`/api/applications/${a.id}/interviews`, INTERVIEW)
        .expect(201);
      await rui
        .post('/api/applications', { ...JOB, companyName: 'Do Rui' })
        .expect(201);

      await deleted(ANA);

      expect((await ana.get('/api/applications').expect(200)).body).toEqual([]);
      const db = app.get(DataSource);
      const [{ i }] = await db.query(
        'SELECT count(*)::int AS i FROM interviews',
      );
      const [{ h }] = await db.query(
        'SELECT count(*)::int AS h FROM application_status_history',
      );
      expect({ i, h }).toEqual({ i: 0, h: 1 }); // resta só o histórico da candidatura do Rui
      expect(
        (await rui.get('/api/applications').expect(200)).body,
      ).toHaveLength(1);
    });

    it('é idempotente', async () => {
      await create();
      await deleted(ANA);
      await expect(deleted(ANA)).resolves.toBeUndefined();
    });
  });

  describe('evento user.demo-created (conta de demonstração)', () => {
    const seed = async (userId: string) => {
      const { DemoApplicationsSeeder } =
        await import('./demo/demo-applications.seeder');
      await app.get(DemoApplicationsSeeder).seed(userId);
    };

    it('preenche o Kanban com candidaturas em várias colunas e posições contínuas', async () => {
      await seed(ANA);
      const board = (await ana.get('/api/applications/board').expect(200))
        .body as Record<string, JobApplication[]>;

      const filled = Object.entries(board)
        .filter(([, cards]) => cards.length)
        .map(([status]) => status)
        .sort();
      expect(filled).toEqual(
        [
          'APPLIED',
          'HR_INTERVIEW',
          'REJECTED',
          'TECHNICAL_INTERVIEW',
          'TECHNICAL_TEST',
        ].sort(),
      );
      for (const cards of Object.values(board)) {
        expect(cards.map((c) => c.position)).toEqual(cards.map((_, i) => i));
      }
      // Uma candidatura à espera há mais de 14 dias, para se ver o aviso.
      const today = new Date().toISOString().slice(0, 10);
      expect(
        board['APPLIED'].some(
          (c) => silenceOf(c, today)?.stage === 'FOLLOW_UP',
        ),
      ).toBe(true);
    });

    it('a acessibilidade é calculada pelo servidor, incluindo a vaga "júnior" que pede 3 anos', async () => {
      await seed(ANA);
      const { body } = await ana.get('/api/applications/stats').expect(200);
      expect(body.total).toBe(7);
      expect(body.byAccessibility.UNREALISTIC).toBe(1);
      expect(body.byAccessibility.STRETCH).toBe(1);
      expect(body.interviews).toBe(3);

      const board = (await ana.get('/api/applications/board').expect(200))
        .body as Record<string, JobApplication[]>;
      const [rejected] = board['REJECTED'];
      expect(rejected.mislabeledJunior).toBe(true);
    });

    it('o histórico de estados fica com datas entre a candidatura e hoje', async () => {
      await seed(ANA);
      const board = (await ana.get('/api/applications/board').expect(200))
        .body as Record<string, JobApplication[]>;
      const [nimbus] = board['TECHNICAL_INTERVIEW'];
      const { body } = await ana
        .get(`/api/applications/${nimbus.id}`)
        .expect(200);
      expect(
        body.history.map((h: { from: string | null; to: string }) => h.to),
      ).toEqual(['APPLIED', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW']);
      const times = body.history.map((h: { changedAt: string }) =>
        new Date(h.changedAt).getTime(),
      );
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(times[0]).toBeLessThan(Date.now() - 7 * 86_400_000);
    });

    it('é idempotente e não toca nos dados de outros utilizadores', async () => {
      await create({ companyName: 'Empresa da Ana' });
      await rui.post('/api/applications', JOB).expect(201);
      await seed(RUI);
      await seed(RUI);
      expect(
        (await rui.get('/api/applications/stats').expect(200)).body.total,
      ).toBe(1);
      await seed(ANA.replace('1111', '3333'));
      expect(
        (await ana.get('/api/applications/stats').expect(200)).body.total,
      ).toBe(1);
    });
  });
});
