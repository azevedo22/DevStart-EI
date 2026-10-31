/** Foto de perfil: carregar, ler, trocar, apagar e o que se recusa. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const ANA = '11111111-1111-4111-8111-111111111111';
const RUI = '22222222-2222-4222-8222-222222222222';

/** Só os primeiros bytes contam para o formato; o resto pode ser qualquer coisa. */
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200, 1),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(200, 2),
]);

describeDb('Foto de perfil (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PROFILE_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '',
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

  beforeEach(async () => {
    await app.get(DataSource).query('TRUNCATE "profile_photos"');
  });

  afterAll(async () => {
    await app?.close();
  });

  const upload = (userId: string, file: Buffer, name = 'foto.jpg') =>
    http
      .put('/api/profile/photo')
      .set('x-user-id', userId)
      .attach('file', file, name);
  const photo = (userId: string) =>
    http.get('/api/profile/photo').set('x-user-id', userId);

  it('sem foto: 404', async () => {
    await photo(ANA).expect(404);
  });

  it('carrega, lê com o tipo certo e sem cache partilhada', async () => {
    await upload(ANA, JPEG).expect(204);
    const res = await photo(ANA).expect(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, no-cache');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body as Buffer, JPEG)).toBe(0);
  });

  it('trocar substitui a anterior; o tipo vem dos bytes, não do nome', async () => {
    await upload(ANA, JPEG).expect(204);
    await upload(ANA, PNG, 'enganador.jpg').expect(204);
    const res = await photo(ANA).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('cada pessoa só vê a sua', async () => {
    await upload(ANA, JPEG).expect(204);
    await photo(RUI).expect(404);
  });

  it('apagar deixa sem foto (e apagar outra vez não dá erro)', async () => {
    await upload(ANA, JPEG).expect(204);
    await http.delete('/api/profile/photo').set('x-user-id', ANA).expect(204);
    await photo(ANA).expect(404);
    await http.delete('/api/profile/photo').set('x-user-id', ANA).expect(204);
  });

  it.each([
    ['um ficheiro que não é imagem', Buffer.from('<svg onload="alert(1)">')],
    ['um PDF', Buffer.from('%PDF-1.7 ...')],
  ])('recusa %s', async (_c, file) => {
    const res = await upload(ANA, file, 'foto.jpg').expect(400);
    expect(res.body.message).toMatch(/JPEG, PNG ou WebP/);
  });

  it('recusa ficheiros com mais de 1 MB', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(1024 * 1024)]);
    await upload(ANA, big).expect(413);
  });

  it('sem ficheiro: 400; sem sessão: 401', async () => {
    await http.put('/api/profile/photo').set('x-user-id', ANA).expect(400);
    await http.get('/api/profile/photo').expect(401);
  });
});
