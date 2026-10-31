/**
 * Importação do CV de ponta a ponta: upload real (multipart), extração do texto
 * do PDF/DOCX, pedido ao Ollama e gravação da escolha do utilizador.
 *
 * O Ollama é um servidor falso que responde como a API verdadeira
 * (POST /api/chat) e regista o pedido, para se verificar o que lhe é enviado.
 * Corre com TEST_DATABASE_URL; sem ele, é ignorado.
 */
import { configureApp } from '@devstart/backend-common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { createServer, IncomingMessage, Server } from 'node:http';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const PDF = readFileSync(join(__dirname, 'fixtures/cv-exemplo.pdf'));
const DOCX = readFileSync(join(__dirname, 'fixtures/cv-exemplo.docx'));

/** O que um modelo devolveria para o CV de exemplo. */
const MODEL_ANSWER = {
  headline: 'Desenvolvedor Full-Stack Júnior',
  location: 'Braga, Portugal',
  summary: 'Recém-licenciado em Engenharia Informática.',
  linkedinUrl: 'linkedin.com/in/tiago-fernandes-exemplo',
  githubUrl: 'github.com/tiagof-exemplo',
  portfolioUrl: null,
  education: [
    {
      institution: 'Universidade do Minho',
      degree: 'Licenciatura em Engenharia Informática',
      fieldOfStudy: null,
      startYear: 2022,
      endYear: 2025,
    },
  ],
  experience: [
    {
      organization: 'Empresa Exemplo Lda.',
      role: 'Developer (estágio curricular)',
      kind: 'INTERNSHIP',
      startDate: '2025-02',
      endDate: '2025-06',
      description: 'Aplicação interna em Angular e Spring Boot.',
    },
  ],
  languages: [
    { language: 'Português', level: 'NATIVE' },
    { language: 'Inglês', level: 'C1' },
  ],
  skills: [
    { name: 'Java', level: 'INTERMEDIATE' },
    { name: 'Angular', level: 'INTERMEDIATE' },
    { name: 'Figma', level: 'BASIC' },
  ],
  projects: [
    {
      title: 'Gestor de Tarefas',
      description: 'Aplicação web em React e Node.js com Express e MongoDB.',
      technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'JWT'],
      repositoryUrl: 'https://github.com/tiagof-exemplo/tarefas',
      academic: false,
    },
  ],
};

type Mode = 'ok' | 'model-missing' | 'refuse';

describeDb('Importação do CV (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let ollama: Server;
  let mode: Mode = 'ok';
  let lastRequest: Record<string, unknown> | null = null;

  beforeAll(async () => {
    ollama = createServer(async (req: IncomingMessage, res) => {
      if (mode === 'refuse') return req.socket.destroy();
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      lastRequest = JSON.parse(Buffer.concat(chunks).toString());
      res.setHeader('content-type', 'application/json');
      if (mode === 'model-missing') {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'model "x" not found' }));
      }
      res.end(
        JSON.stringify({
          message: { role: 'assistant', content: JSON.stringify(MODEL_ANSWER) },
          done: true,
        }),
      );
    });
    await new Promise<void>((r) => ollama.listen(0, '127.0.0.1', r));
    const port = (ollama.address() as AddressInfo).port;

    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
      OLLAMA_URL: `http://127.0.0.1:${port}`,
      OLLAMA_MODEL: 'modelo-de-teste',
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

  beforeEach(async () => {
    mode = 'ok';
    lastRequest = null;
    await app
      .get(DataSource)
      .query(
        'TRUNCATE "project_competencies", "projects", "profile_competencies", "profiles", "profile_education", "profile_experience", "profile_languages" CASCADE',
      );
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => ollama?.close(r));
  });

  const analyze = (file: Buffer, name = 'cv.pdf') =>
    http
      .post('/api/profile/cv/analyze')
      .set('x-user-id', ANA)
      .attach('file', file, name);

  it('GET /profile/cv/reader: com o Ollama, a IA é local', async () => {
    const { body } = await http
      .get('/api/profile/cv/reader')
      .set('x-user-id', ANA)
      .expect(200);
    expect(body).toEqual({
      label: 'Ollama · modelo-de-teste',
      externalProvider: null,
    });
    await http.get('/api/profile/cv/reader').expect(401);
  });

  describe('POST /profile/cv/analyze', () => {
    it('lê o PDF, envia o texto ao modelo com o esquema e devolve o rascunho', async () => {
      const { body } = await analyze(PDF).expect(200);

      // O que foi enviado ao Ollama.
      expect(lastRequest).toMatchObject({
        model: 'modelo-de-teste',
        stream: false,
        options: { temperature: 0 },
      });
      expect(lastRequest!['format']).toHaveProperty('properties.skills');
      const messages = lastRequest!['messages'] as { content: string }[];
      expect(messages[1].content).toContain('Universidade do Minho');

      // O rascunho já normalizado.
      expect(body.source).toBe('ai');
      expect(body.fields).toMatchObject({
        headline: 'Desenvolvedor Full-Stack Júnior',
        university: 'Universidade do Minho',
        graduationYear: 2025,
        linkedinUrl: 'https://linkedin.com/in/tiago-fernandes-exemplo',
      });
      expect(body.experience[0].kind).toBe('INTERNSHIP');
      expect(
        body.competencies.map((c: { competencyId: string }) => c.competencyId),
      ).toEqual(expect.arrayContaining(['java', 'angular', 'react', 'docker']));
      expect(body.unmatchedSkills).toContain('Figma');
    });

    it('também lê DOCX', async () => {
      await analyze(DOCX, 'cv.docx').expect(200);
      const messages = lastRequest!['messages'] as { content: string }[];
      expect(messages[1].content).toContain('Tiago Fernandes');
    });

    it('não grava nada', async () => {
      await analyze(PDF).expect(200);
      const { body } = await http
        .get('/api/profile')
        .set('x-user-id', ANA)
        .expect(200);
      expect(body.education).toEqual([]);
      expect(body.competencies).toEqual([]);
    });

    it('sem Ollama, devolve o que as palavras-chave encontram e explica porquê', async () => {
      mode = 'refuse';
      const { body } = await analyze(PDF).expect(200);
      expect(body.source).toBe('keywords');
      expect(body.warnings[0]).toMatch(/Não foi possível ligar ao Ollama/);
      expect(body.competencies.length).toBeGreaterThan(3);
      expect(body.education).toEqual([]);
    });

    it('modelo em falta: diz que comando correr', async () => {
      mode = 'model-missing';
      const { body } = await analyze(PDF).expect(200);
      expect(body.warnings[0]).toMatch(/ollama pull modelo-de-teste/);
    });

    it.each([
      [
        'um ficheiro que não é PDF nem DOCX',
        Buffer.from('olá, sou texto'),
        'cv.pdf',
      ],
      [
        'um PDF disfarçado de imagem',
        Buffer.from('\x89PNG\r\n\x1a\n...'),
        'cv.pdf',
      ],
    ])('recusa %s', async (_c, file, name) => {
      const { body } = await analyze(file, name).expect(400);
      expect(body.message).toMatch(/PDF ou um DOCX/);
    });

    it('recusa pedidos sem ficheiro e ficheiros acima de 5 MB', async () => {
      await http
        .post('/api/profile/cv/analyze')
        .set('x-user-id', ANA)
        .expect(400);
      await analyze(Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)])).expect(
        413,
      );
    });
  });

  describe('POST /profile/cv/import', () => {
    const importCv = (body: object) =>
      http.post('/api/profile/cv/import').set('x-user-id', ANA).send(body);

    it('grava o que o utilizador escolheu, numa vez', async () => {
      const { body: draft } = await analyze(PDF).expect(200);
      const { body: profile } = await importCv({
        fields: draft.fields,
        education: draft.education,
        experience: draft.experience,
        languages: draft.languages,
        competencies: draft.competencies.map(
          (c: { competencyId: string; level: string }) => ({
            competencyId: c.competencyId,
            level: c.level,
          }),
        ),
        projects: draft.projects,
      }).expect(200);

      expect(profile).toMatchObject({
        headline: 'Desenvolvedor Full-Stack Júnior',
        university: 'Universidade do Minho',
        location: 'Braga, Portugal',
      });
      expect(profile.education).toHaveLength(1);
      expect(profile.experience).toHaveLength(1);
      expect(profile.languages).toHaveLength(2);
      expect(profile.competencies.length).toBe(draft.competencies.length);
      const { body: projects } = await http
        .get('/api/projects')
        .set('x-user-id', ANA)
        .expect(200);
      expect(projects.map((p: { title: string }) => p.title)).toEqual([
        'Gestor de Tarefas',
      ]);
    });

    it('importar o mesmo CV outra vez não duplica nada', async () => {
      const { body: draft } = await analyze(PDF).expect(200);
      const payload = {
        education: draft.education,
        experience: draft.experience,
        languages: draft.languages,
        projects: draft.projects,
      };
      await importCv(payload).expect(200);
      const { body: profile } = await importCv(payload).expect(200);
      expect(profile.education).toHaveLength(1);
      expect(profile.experience).toHaveLength(1);
      expect(profile.languages).toHaveLength(2);
    });

    it('só mexe no que vem no pedido', async () => {
      await http
        .put('/api/profile')
        .set('x-user-id', ANA)
        .send({ headline: 'O meu título', bio: 'A minha apresentação.' })
        .expect(200);
      const { body } = await importCv({
        fields: { location: 'Porto' },
      }).expect(200);
      expect(body).toMatchObject({
        headline: 'O meu título',
        bio: 'A minha apresentação.',
        location: 'Porto',
      });
    });

    it.each([
      [
        'competência fora do catálogo',
        { competencies: [{ competencyId: 'cobol-2077', level: 'BASIC' }] },
      ],
      [
        'data inválida',
        { experience: [{ ...MODEL_ANSWER.experience[0], startDate: 'ontem' }] },
      ],
      ['link perigoso', { fields: { githubUrl: 'javascript:alert(1)' } }],
      [
        'nível de língua inventado',
        { languages: [{ language: 'Inglês', level: 'fluente' }] },
      ],
    ])('valida tudo de novo: recusa %s', async (_c, body) => {
      await importCv(body).expect(400);
      const { body: profile } = await http
        .get('/api/profile')
        .set('x-user-id', ANA)
        .expect(200);
      expect(profile.competencies).toEqual([]);
    });

    it('é tudo ou nada: um erro a meio não deixa metade gravada', async () => {
      const project = (i: number) => ({
        title: `Projeto ${i}`,
        description: 'Um projeto de exemplo.',
        origin: 'PERSONAL',
        competencyIds: [],
        practices: [],
      });
      // 45 projetos já no perfil (em lotes de 15: o pedido aceita até 20).
      for (let batch = 0; batch < 3; batch++) {
        await importCv({
          projects: Array.from({ length: 15 }, (_, i) =>
            project(batch * 15 + i),
          ),
        }).expect(200);
      }
      // A formação é gravada primeiro; os 10 projetos passam o limite de 50 → 409.
      await importCv({
        education: MODEL_ANSWER.education,
        projects: Array.from({ length: 10 }, (_, i) => project(100 + i)),
      }).expect(409);

      const { body } = await http
        .get('/api/profile')
        .set('x-user-id', ANA)
        .expect(200);
      expect(body.education).toEqual([]);
    });
  });
});
