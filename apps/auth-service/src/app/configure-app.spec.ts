import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { configureApp } from './configure-app';

@Controller('whoami')
class WhoAmIController {
  @Get()
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }
}

/**
 * O rate limiting conta pedidos por IP. Atrás de proxies, o IP do cliente vem em
 * X-Forwarded-For, e cada proxy acrescenta o IP de quem lhe ligou.
 */
describe('configureApp: IP do cliente atrás de proxies', () => {
  async function appWithHops(hops: number): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ TRUST_PROXY_HOPS: hops })],
        }),
      ],
      controllers: [WhoAmIController],
    }).compile();
    const app = module.createNestApplication();
    configureApp(app);
    await app.init();
    return app;
  }

  // nginx escreve o IP do cliente; o gateway acrescenta o IP do nginx.
  const viaNginxAndGateway = '203.0.113.7, 172.18.0.5';

  it('com 2 saltos (nginx + gateway) vê o IP real do cliente', async () => {
    const app = await appWithHops(2);
    const res = await request(app.getHttpServer())
      .get('/api/whoami')
      .set('X-Forwarded-For', viaNginxAndGateway);
    expect(res.body.ip).toBe('203.0.113.7');
    await app.close();
  });

  it('com 1 salto veria o IP do nginx: todos os clientes partilhariam o limite', async () => {
    const app = await appWithHops(1);
    const res = await request(app.getHttpServer())
      .get('/api/whoami')
      .set('X-Forwarded-For', viaNginxAndGateway);
    expect(res.body.ip).toBe('172.18.0.5');
    await app.close();
  });
});
