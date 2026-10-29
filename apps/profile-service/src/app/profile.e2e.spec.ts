/**
 * Testes e2e do Profile & Skill Service contra um PostgreSQL real.
 * Correm quando TEST_DATABASE_URL está definido; sem ele, são ignorados.
 *
 * A identidade chega no cabeçalho x-user-id, tal como o gateway a envia.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const RUI = '22222222-2222-4222-8222-222222222222';

const PROJECT = {
  title: 'EducaAssistAI',
  description: 'Assistente conversacional com RAG para a instituição.',
  repositoryUrl: 'https://github.com/exemplo/educaassistai',
  origin: 'ACADEMIC',
  academicContext: 'Projeto final de licenciatura, 2026',
  competencyIds: ['angular', 'fastapi', 'rag'],
  practices: ['DOCKER', 'TESTS'],
};

describeDb('Profile & Skill Service (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    // REDIS_URL vazio: o consumidor de eventos não arranca; os handlers são chamados diretamente.
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
    });
    const { AppModule } = await import('./app.module');
    const { configureApp } = await import('@devstart/backend-common');
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
        'TRUNCATE "project_competencies", "projects", "profile_competencies", "profiles" CASCADE',
      );
  });

  afterAll(async () => {
    await app?.close();
  });

  const as = (userId: string) => ({
    get: (url: string) => http.get(url).set('x-user-id', userId),
    put: (url: string, body?: object) =>
      http.put(url).set('x-user-id', userId).send(body),
    post: (url: string, body?: object) =>
      http.post(url).set('x-user-id', userId).send(body),
    delete: (url: string) => http.delete(url).set('x-user-id', userId),
  });
  const ana = as(ANA);
  const rui = as(RUI);

  describe('identidade', () => {
    it('recusa pedidos sem x-user-id (só o gateway o envia)', async () => {
      await http.get('/api/profile').expect(401);
      await http.get('/api/projects').expect(401);
      await http.get('/api/skill-gap/overview').expect(401);
    });

    it('recusa um x-user-id que não é um uuid', async () => {
      await http.get('/api/profile').set('x-user-id', 'admin').expect(401);
    });

    it('o catálogo continua público', async () => {
      await http.get('/api/stacks').expect(200);
    });

    it('o catálogo pode ser guardado em cache e revalidado com ETag (304)', async () => {
      const first = await http.get('/api/competencies').expect(200);
      expect(first.headers['cache-control']).toMatch(/public, max-age=300/);
      const etag = first.headers['etag'];
      expect(etag).toBeTruthy();

      const again = await http
        .get('/api/competencies')
        .set('If-None-Match', etag)
        .expect(304);
      expect(again.text).toBeFalsy();
    });

    it('dados pessoais nunca ficam em cache partilhada', async () => {
      const res = await ana.get('/api/profile').expect(200);
      expect(res.headers['cache-control'] ?? '').not.toMatch(/public/);
    });
  });

  describe('perfil', () => {
    it('um utilizador novo recebe um perfil vazio', async () => {
      const { body } = await ana.get('/api/profile').expect(200);
      expect(body).toMatchObject({
        userId: ANA,
        headline: null,
        competencies: [],
      });
    });

    it('atualiza só os campos enviados e limpa com string vazia', async () => {
      await ana
        .put('/api/profile', {
          headline: '  Recém-licenciado em EI ',
          university: 'UPB',
        })
        .expect(200);
      const { body } = await ana
        .put('/api/profile', { university: '' })
        .expect(200);
      expect(body).toMatchObject({
        headline: 'Recém-licenciado em EI',
        university: null,
      });
    });

    it.each([
      ['ano de conclusão impossível', { graduationYear: 1800 }],
      [
        'ano de conclusão muito no futuro',
        { graduationYear: new Date().getFullYear() + 20 },
      ],
      ['headline demasiado longa', { headline: 'x'.repeat(121) }],
      ['campo que não existe', { userId: RUI }],
    ])('recusa %s', async (_case, body) => {
      await ana.put('/api/profile', body).expect(400);
    });
  });

  describe('competências declaradas', () => {
    it('declara, altera o nível e remove', async () => {
      await ana
        .put('/api/profile/competencies/angular', { level: 'BASIC' })
        .expect(200);
      const { body } = await ana
        .put('/api/profile/competencies/angular', { level: 'INTERMEDIATE' })
        .expect(200);
      expect(body).toEqual([
        expect.objectContaining({
          competencyId: 'angular',
          level: 'INTERMEDIATE',
        }),
      ]);

      await ana.delete('/api/profile/competencies/angular').expect(204);
      expect((await ana.get('/api/profile')).body.competencies).toEqual([]);
    });

    it('recusa competências fora do catálogo e níveis inválidos', async () => {
      await ana
        .put('/api/profile/competencies/cobol-quantico', { level: 'BASIC' })
        .expect(400);
      await ana
        .put('/api/profile/competencies/angular', { level: 'GURU' })
        .expect(400);
    });

    it('remover uma competência que não está no perfil dá 404', async () => {
      await ana.delete('/api/profile/competencies/angular').expect(404);
    });
  });

  describe('projetos', () => {
    it('cria e lista um projeto', async () => {
      const created = await ana.post('/api/projects', PROJECT).expect(201);
      expect(created.body).toMatchObject({
        title: 'EducaAssistAI',
        competencyIds: ['angular', 'fastapi', 'rag'],
        practices: ['DOCKER', 'TESTS'],
      });
      const { body } = await ana.get('/api/projects').expect(200);
      expect(body).toHaveLength(1);
    });

    it('substitui as competências ao editar', async () => {
      const { body: p } = await ana.post('/api/projects', PROJECT).expect(201);
      const { body } = await ana
        .put(`/api/projects/${p.id}`, {
          ...PROJECT,
          competencyIds: ['angular', 'docker'],
        })
        .expect(200);
      expect(body.competencyIds).toEqual(['angular', 'docker']);
    });

    it('descarta o contexto académico em projetos que não são académicos', async () => {
      const { body } = await ana
        .post('/api/projects', { ...PROJECT, origin: 'PERSONAL' })
        .expect(201);
      expect(body.academicContext).toBeNull();
    });

    it.each([
      ['link javascript:', { repositoryUrl: 'javascript:alert(1)' }],
      ['link sem protocolo', { liveUrl: 'exemplo.com' }],
      [
        'competência fora do catálogo',
        { competencyIds: ['angular', 'inventada'] },
      ],
      ['competências repetidas', { competencyIds: ['angular', 'angular'] }],
      ['prática inválida', { practices: ['MAGIA'] }],
      ['título vazio', { title: '  ' }],
    ])('recusa %s', async (_case, patch) => {
      await ana.post('/api/projects', { ...PROJECT, ...patch }).expect(400);
    });

    it('apaga o projeto e as ligações às competências', async () => {
      const { body: p } = await ana.post('/api/projects', PROJECT).expect(201);
      await ana.delete(`/api/projects/${p.id}`).expect(204);
      const [{ count }] = await app
        .get(DataSource)
        .query('SELECT count(*)::int AS count FROM project_competencies');
      expect(count).toBe(0);
    });
  });

  describe('isolamento entre utilizadores', () => {
    it('ninguém vê, edita ou apaga projetos de outra pessoa', async () => {
      const { body: p } = await ana.post('/api/projects', PROJECT).expect(201);

      expect((await rui.get('/api/projects')).body).toEqual([]);
      await rui.get(`/api/projects/${p.id}`).expect(404);
      await rui.put(`/api/projects/${p.id}`, PROJECT).expect(404);
      await rui.delete(`/api/projects/${p.id}`).expect(404);

      await ana.get(`/api/projects/${p.id}`).expect(200);
    });

    it('as competências declaradas são de cada um', async () => {
      await ana
        .put('/api/profile/competencies/angular', { level: 'ADVANCED' })
        .expect(200);
      expect((await rui.get('/api/profile')).body.competencies).toEqual([]);
    });
  });

  describe('skill gap com dados reais', () => {
    it('usa as competências declaradas e os projetos guardados', async () => {
      await ana
        .put('/api/profile/competencies/typescript', { level: 'INTERMEDIATE' })
        .expect(200);
      await ana
        .put('/api/profile/competencies/angular', { level: 'INTERMEDIATE' })
        .expect(200);
      await ana
        .post('/api/projects', { ...PROJECT, competencyIds: ['angular'] })
        .expect(201);

      const { body } = await ana
        .get('/api/skill-gap?stackId=junior-fullstack-angular-node')
        .expect(200);
      expect(
        body.coveredWithProjects.map(
          (c: { competencyId: string }) => c.competencyId,
        ),
      ).toEqual(['angular']);
      expect(
        body.coveredWithoutProjects.map(
          (c: { competencyId: string }) => c.competencyId,
        ),
      ).toEqual(['typescript']);
      expect(body.matchPercentage).toBeGreaterThan(0);
    });

    it('um projeto numa competência não declarada não conta como coberta', async () => {
      await ana
        .post('/api/projects', { ...PROJECT, competencyIds: ['angular'] })
        .expect(201);
      const { body } = await ana
        .get('/api/skill-gap?stackId=junior-fullstack-angular-node')
        .expect(200);
      expect(body.coveredWithProjects).toEqual([]);
      expect(body.matchPercentage).toBe(0);
    });

    it('a visão geral ordena as stacks da mais próxima para a mais distante', async () => {
      await ana
        .put('/api/profile/competencies/python', { level: 'INTERMEDIATE' })
        .expect(200);
      await ana
        .put('/api/profile/competencies/llm-integration', { level: 'BASIC' })
        .expect(200);
      const { body } = await ana.get('/api/skill-gap/overview').expect(200);
      expect(body).toHaveLength(4);
      expect(body[0].stackId).toBe('junior-ai-engineer');
      const pcts = body.map(
        (s: { matchPercentage: number }) => s.matchPercentage,
      );
      expect(pcts).toEqual([...pcts].sort((a, b) => b - a));
    });

    it('stack inexistente dá 404 e stack em falta dá 400', async () => {
      await ana.get('/api/skill-gap?stackId=nao-existe').expect(404);
      await ana.get('/api/skill-gap').expect(400);
    });
  });

  describe('evento user.deleted', () => {
    const deleted = async (userId: string) => {
      const { UserEventsSubscriber } =
        await import('./events/user-events.subscriber');
      const { createEvent } = await import('@devstart/backend-common');
      await app
        .get(UserEventsSubscriber)
        .onUserDeleted(createEvent('user.deleted', { userId }));
    };

    it('apaga perfil, competências e projetos só desse utilizador', async () => {
      await ana.put('/api/profile', { headline: 'Ana' }).expect(200);
      await ana
        .put('/api/profile/competencies/angular', { level: 'BASIC' })
        .expect(200);
      await ana.post('/api/projects', PROJECT).expect(201);
      await rui
        .put('/api/profile/competencies/react', { level: 'BASIC' })
        .expect(200);
      await rui.post('/api/projects', PROJECT).expect(201);

      await deleted(ANA);

      const anaProfile = (await ana.get('/api/profile').expect(200)).body;
      expect(anaProfile).toMatchObject({ headline: null, competencies: [] });
      expect((await ana.get('/api/projects').expect(200)).body).toEqual([]);
      const [{ links }] = await app
        .get(DataSource)
        .query('SELECT count(*)::int AS links FROM project_competencies');
      expect(links).toBe(PROJECT.competencyIds.length); // só as do Rui

      expect(
        (await rui.get('/api/profile').expect(200)).body.competencies,
      ).toHaveLength(1);
      expect((await rui.get('/api/projects').expect(200)).body).toHaveLength(1);
    });

    it('é idempotente: o mesmo evento duas vezes não dá erro', async () => {
      await ana.post('/api/projects', PROJECT).expect(201);
      await deleted(ANA);
      await expect(deleted(ANA)).resolves.toBeUndefined();
    });
  });
});
