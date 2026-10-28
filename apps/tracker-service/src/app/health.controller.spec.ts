import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde ok com o nome do serviço', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    const result = moduleRef.get(HealthController).check();
    expect(result).toMatchObject({ status: 'ok', service: 'tracker-service' });
  });
});
