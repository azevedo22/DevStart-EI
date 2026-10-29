/**
 * Testes do barramento de eventos contra um Redis real.
 * Correm quando TEST_REDIS_URL está definido; sem ele, são ignorados.
 */
import Redis from 'ioredis';
import { EventConsumer } from './event-consumer';
import { EventPublisher, createEvent } from './event-publisher';
import {
  DEAD_LETTER_STREAM,
  DomainEvent,
  EVENTS_STREAM,
  EventHandlers,
} from './events.types';
import { redisTestUrl } from './redis-test-url';

const TEST_REDIS_URL = redisTestUrl(1);
const describeRedis = TEST_REDIS_URL ? describe : describe.skip;

const silent = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describeRedis('eventos com Redis Streams', () => {
  let redis: Redis;
  let publisher: EventPublisher;

  beforeAll(() => {
    redis = new Redis(TEST_REDIS_URL!);
    publisher = new EventPublisher(redis);
  });

  beforeEach(async () => {
    await redis.del(EVENTS_STREAM, DEAD_LETTER_STREAM);
  });

  afterAll(async () => {
    await redis.quit();
  });

  const consumer = (
    group: string,
    handlers: EventHandlers,
    extra: Partial<ConstructorParameters<typeof EventConsumer>[0]> = {},
  ) =>
    new EventConsumer({
      redis: new Redis(TEST_REDIS_URL!),
      group,
      consumer: 'c1',
      handlers,
      logger: silent,
      ...extra,
    });

  it('entrega o evento ao handler e confirma-o', async () => {
    const received: DomainEvent[] = [];
    const c = consumer('profile', {
      'user.deleted': async (e) => void received.push(e),
    });

    const event = createEvent('user.deleted', { userId: 'u1' });
    await publisher.publish(event);

    expect(await c.processOnce()).toBe(1);
    expect(received).toEqual([event]);
    expect(await redis.xpending(EVENTS_STREAM, 'profile')).toEqual([
      0,
      null,
      null,
      null,
    ]);
    await c.stop();
  });

  it('cada serviço (grupo) recebe todos os eventos', async () => {
    const seen: string[] = [];
    const profile = consumer('profile', {
      'user.deleted': async () => void seen.push('profile'),
    });
    const tracker = consumer('tracker', {
      'user.deleted': async () => void seen.push('tracker'),
    });

    await publisher.publish(createEvent('user.deleted', { userId: 'u1' }));
    await profile.processOnce();
    await tracker.processOnce();

    expect(seen.sort()).toEqual(['profile', 'tracker']);
    await Promise.all([profile.stop(), tracker.stop()]);
  });

  it('um serviço que arranca depois recebe os eventos publicados enquanto estava em baixo', async () => {
    await publisher.publish(createEvent('user.deleted', { userId: 'u-antes' }));
    const received: string[] = [];
    const late = consumer('late', {
      'user.deleted': async (e) => void received.push(e.payload.userId),
    });
    await late.processOnce();
    expect(received).toEqual(['u-antes']);
    await late.stop();
  });

  it('se o handler falhar, o evento fica pendente e é repetido', async () => {
    let attempts = 0;
    const c = consumer(
      'flaky',
      {
        'user.deleted': async () => {
          attempts++;
          if (attempts === 1) throw new Error('base de dados indisponível');
        },
      },
      { retryAfterMs: 0 },
    );

    await publisher.publish(createEvent('user.deleted', { userId: 'u1' }));
    expect(await c.processOnce()).toBe(0); // falhou
    expect(await c.processOnce()).toBe(1); // repetido e bem-sucedido
    expect(attempts).toBe(2);
    await c.stop();
  });

  it('ao fim de várias falhas, vai para a dead-letter e deixa de bloquear', async () => {
    const c = consumer(
      'broken',
      {
        'user.deleted': async () => {
          throw new Error('erro permanente');
        },
      },
      { retryAfterMs: 0, maxDeliveries: 3 },
    );
    await publisher.publish(createEvent('user.deleted', { userId: 'u1' }));
    for (let i = 0; i < 4; i++) await c.processOnce();

    const dead = await redis.xrange(DEAD_LETTER_STREAM, '-', '+');
    expect(dead).toHaveLength(1);
    expect(dead[0][1]).toEqual(
      expect.arrayContaining(['error', 'erro permanente', 'group', 'broken']),
    );
    expect(await redis.xpending(EVENTS_STREAM, 'broken')).toEqual([
      0,
      null,
      null,
      null,
    ]);
    await c.stop();
  });

  it('ignora (e confirma) eventos que o serviço não trata', async () => {
    const c = consumer('nothing', {});
    await publisher.publish(createEvent('user.deleted', { userId: 'u1' }));
    expect(await c.processOnce()).toBe(0);
    expect(await redis.xpending(EVENTS_STREAM, 'nothing')).toEqual([
      0,
      null,
      null,
      null,
    ]);
    await c.stop();
  });

  it('start/stop: o ciclo em fundo processa e pára limpo', async () => {
    const received: string[] = [];
    const c = consumer(
      'loop',
      { 'user.deleted': async (e) => void received.push(e.payload.userId) },
      { blockMs: 100 },
    );
    c.start();
    await publisher.publish(createEvent('user.deleted', { userId: 'u-loop' }));
    for (let i = 0; i < 50 && !received.length; i++)
      await new Promise((r) => setTimeout(r, 50));
    await c.stop();
    expect(received).toEqual(['u-loop']);
  });
});
