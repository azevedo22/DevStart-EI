import Redis from 'ioredis';
import { redisTestUrl } from './events/redis-test-url';
import { describeWait, FixedWindowLimiter } from './rate-limit';

describe('FixedWindowLimiter em memória', () => {
  let now = 1_000_000;
  const limiter = () => new FixedWindowLimiter(null, () => now);

  it('deixa passar até ao limite e recusa a seguir, a dizer quanto falta', async () => {
    const l = limiter();
    for (let i = 1; i <= 3; i++) {
      expect(await l.hit('ana', 3, 60_000)).toEqual({
        allowed: true,
        count: i,
        retryAfterMs: 60_000,
      });
    }
    now += 15_000;
    expect(await l.hit('ana', 3, 60_000)).toEqual({
      allowed: false,
      count: 4,
      retryAfterMs: 45_000,
    });
  });

  it('cada chave conta à parte', async () => {
    const l = limiter();
    await l.hit('ana', 1, 60_000);
    expect((await l.hit('ana', 1, 60_000)).allowed).toBe(false);
    expect((await l.hit('rui', 1, 60_000)).allowed).toBe(true);
  });

  it('a janela recomeça quando acaba', async () => {
    const l = limiter();
    await l.hit('ana', 1, 60_000);
    now += 60_000;
    expect(await l.hit('ana', 1, 60_000)).toMatchObject({
      allowed: true,
      count: 1,
    });
  });
});

describe('FixedWindowLimiter com Redis em baixo', () => {
  it('deixa passar (fail-open)', async () => {
    const broken = { eval: () => Promise.reject(new Error('ECONNREFUSED')) };
    const l = new FixedWindowLimiter(broken as unknown as Redis);
    expect((await l.hit('ana', 0, 60_000)).allowed).toBe(true);
  });
});

const TEST_REDIS_URL = redisTestUrl(3);
const describeRedis = TEST_REDIS_URL ? describe : describe.skip;

describeRedis('FixedWindowLimiter com Redis', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(TEST_REDIS_URL);
  });
  beforeEach(async () => {
    await redis.flushdb();
  });
  afterAll(async () => {
    await redis.quit();
  });

  it('partilha o contador entre instâncias e põe prazo na chave', async () => {
    const a = new FixedWindowLimiter(redis);
    const b = new FixedWindowLimiter(redis);
    expect((await a.hit('ana', 2, 60_000)).allowed).toBe(true);
    expect((await b.hit('ana', 2, 60_000)).allowed).toBe(true);
    const third = await a.hit('ana', 2, 60_000);
    expect(third).toMatchObject({ allowed: false, count: 3 });
    expect(third.retryAfterMs).toBeGreaterThan(55_000);
    expect(await redis.pttl('ratelimit:ana')).toBeGreaterThan(55_000);
  });
});

describe('describeWait', () => {
  it.each([
    [1, 'daqui a 1 min'],
    [59 * 60_000, 'daqui a 59 min'],
    [61 * 60_000, 'daqui a 2 h'],
  ])('%i ms → %s', (ms, text) => {
    expect(describeWait(ms)).toBe(text);
  });
});
