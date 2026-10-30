import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import { JobPostingDraft } from '@devstart/shared-types';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AnalyzeJobPostingDto } from './dto/analyze-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(RequireUserGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** Lê o texto de um anúncio e devolve os campos para a candidatura. */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(
    @CurrentUserId() userId: string,
    @Body() dto: AnalyzeJobPostingDto,
  ): Promise<JobPostingDraft> {
    return this.jobs.analyze(userId, dto.text);
  }
}
