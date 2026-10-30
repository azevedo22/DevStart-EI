import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import {
  JobFeedNewCount,
  JobFeedQuery,
  JobFeedResponse,
} from '@devstart/shared-types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobFeedQueryDto } from './dto/job-feed-query.dto';
import { JobFeedService } from './job-feed.service';

@Controller('jobs/feed')
@UseGuards(RequireUserGuard)
export class JobFeedController {
  constructor(private readonly feed: JobFeedService) {}

  /** Vagas abertas, filtradas e ordenadas pela compatibilidade com o perfil. */
  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query() query: JobFeedQueryDto,
  ): Promise<JobFeedResponse> {
    return this.feed.feed(userId, query);
  }

  /** Quantas vagas novas há desde a última visita (para o número no menu). */
  @Get('new-count')
  async newCount(@CurrentUserId() userId: string): Promise<JobFeedNewCount> {
    return { count: await this.feed.newCount(userId) };
  }

  /** Os filtros da última visita. */
  @Get('last-query')
  async lastQuery(
    @CurrentUserId() userId: string,
  ): Promise<JobFeedQuery | null> {
    return this.feed.lastQuery(userId);
  }

  /** Marca a visita: o que está na lista deixa de ser novo. */
  @Put('visit')
  @HttpCode(HttpStatus.NO_CONTENT)
  visit(
    @CurrentUserId() userId: string,
    @Body() query: JobFeedQueryDto,
  ): Promise<void> {
    return this.feed.markVisited(userId, { ...query });
  }
}
