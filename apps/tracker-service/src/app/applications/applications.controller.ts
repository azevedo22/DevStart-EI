import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import {
  Accessibility,
  ActivityEvent,
  ApplicationBoard,
  ApplicationStats,
  Interview,
  JobApplication,
  JobApplicationDetail,
  parseActivityRange,
} from '@devstart/shared-types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SaveInterviewDto } from '../interviews/dto/interview.dto';
import { InterviewsService } from '../interviews/interviews.service';
import { ActivityService } from './activity.service';
import { ApplicationsService } from './applications.service';
import { MoveApplicationDto, SaveApplicationDto } from './dto/application.dto';

/** Um id malformado dá 404, como um id de outra pessoa. */
const Id = () =>
  Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }));

@Controller('applications')
@UseGuards(RequireUserGuard)
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly interviews: InterviewsService,
    private readonly activityService: ActivityService,
  ) {}

  // Rotas fixas antes de ':id'.
  @Get('board')
  board(
    @CurrentUserId() userId: string,
    @Query('accessibility') accessibility?: Accessibility,
    @Query('q') q?: string,
  ): Promise<ApplicationBoard> {
    return this.applications.board(userId, { accessibility, q });
  }

  @Get('stats')
  stats(@CurrentUserId() userId: string): Promise<ApplicationStats> {
    return this.applications.stats(userId);
  }

  /** Eventos por dia, para o relatório semanal (?from=&to=&tz=). */
  @Get('activity')
  activity(
    @CurrentUserId() userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tz') tz?: string,
  ): Promise<ActivityEvent[]> {
    const range = parseActivityRange({ from, to, tz });
    if ('error' in range) throw new BadRequestException(range.error);
    return this.activityService.activity(userId, range);
  }

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query('accessibility') accessibility?: Accessibility,
    @Query('q') q?: string,
  ): Promise<JobApplication[]> {
    return this.applications.list(userId, { accessibility, q });
  }

  @Get(':id')
  detail(
    @CurrentUserId() userId: string,
    @Id() id: string,
  ): Promise<JobApplicationDetail> {
    return this.applications.detail(userId, id);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body() dto: SaveApplicationDto,
  ): Promise<JobApplication> {
    return this.applications.create(userId, dto);
  }

  @Put(':id')
  update(
    @CurrentUserId() userId: string,
    @Id() id: string,
    @Body() dto: SaveApplicationDto,
  ): Promise<JobApplication> {
    return this.applications.update(userId, id, dto);
  }

  @Patch(':id/move')
  move(
    @CurrentUserId() userId: string,
    @Id() id: string,
    @Body() dto: MoveApplicationDto,
  ): Promise<JobApplication> {
    return this.applications.move(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUserId() userId: string, @Id() id: string): Promise<void> {
    return this.applications.remove(userId, id);
  }

  @Post(':id/interviews')
  addInterview(
    @CurrentUserId() userId: string,
    @Id() id: string,
    @Body() dto: SaveInterviewDto,
  ): Promise<Interview> {
    return this.interviews.create(userId, id, dto);
  }
}
