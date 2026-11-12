import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

describe('ApplicationsController: ferramentas de desenvolvimento', () => {
  const build = (devTools: 'true' | 'false') => {
    const service = { exportApplied: jest.fn().mockResolvedValue([]) };
    const config = { get: () => devTools } as unknown as ConfigService<
      Env,
      true
    >;
    const controller = new ApplicationsController(
      service as unknown as ApplicationsService,
      {} as never,
      {} as never,
      config,
    );
    return { controller, service };
  };

  it('sem DEV_TOOLS=true, a exportação não existe (404) e a web esconde o botão', () => {
    const { controller, service } = build('false');
    expect(() => controller.export('u1')).toThrow(NotFoundException);
    expect(service.exportApplied).not.toHaveBeenCalled();
    expect(controller.devToolsStatus()).toEqual({ export: false });
  });

  it('com DEV_TOOLS=true, exporta', async () => {
    const { controller, service } = build('true');
    await expect(controller.export('u1')).resolves.toEqual([]);
    expect(service.exportApplied).toHaveBeenCalledWith('u1');
    expect(controller.devToolsStatus()).toEqual({ export: true });
  });
});
