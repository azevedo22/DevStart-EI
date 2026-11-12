import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import {
  JobFeedNewCount,
  JobFeedQuery,
  JobFeedResponse,
  JobListingText,
} from '@devstart/shared-types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { JobFeedQueryDto } from './dto/job-feed-query.dto';
import { JobListingTextsDto } from './dto/job-listing-texts.dto';
import { JobFeedService } from './job-feed.service';

@Controller('jobs/feed')
@UseGuards(RequireUserGuard)
export class JobFeedController {
  constructor(
    private readonly feed: JobFeedService,
    private readonly config: ConfigService<Env, true>,
  ) {}

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

  /**
   * Ferramenta de desenvolvimento: o texto das vagas com estes links, para a
   * exportação de avaliação. Sem DEV_TOOLS=true, a rota não existe (404).
   * As vagas são públicas (ITJobs), por isso não há dados de outros utilizadores.
   */
  @Post('texts')
  @HttpCode(HttpStatus.OK)
  texts(@Body() dto: JobListingTextsDto): Promise<JobListingText[]> {
    if (this.config.get('DEV_TOOLS', { infer: true }) !== 'true') {
      throw new NotFoundException();
    }
    return this.feed.textsByUrl(dto.urls);
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
