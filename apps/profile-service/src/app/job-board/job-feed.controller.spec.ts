import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { JobFeedController } from './job-feed.controller';
import { JobFeedService } from './job-feed.service';

describe('JobFeedController: textos das vagas', () => {
  it('sem DEV_TOOLS=true, a rota não existe (404)', () => {
    const feed = { textsByUrl: jest.fn() };
    const config = { get: () => 'false' } as unknown as ConfigService<
      Env,
      true
    >;
    const controller = new JobFeedController(
      feed as unknown as JobFeedService,
      config,
    );
    expect(() => controller.texts({ urls: ['https://x.pt'] })).toThrow(
      NotFoundException,
    );
    expect(feed.textsByUrl).not.toHaveBeenCalled();
  });
});
