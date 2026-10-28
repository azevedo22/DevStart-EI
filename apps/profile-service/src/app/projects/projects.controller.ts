import { Project } from '@devstart/shared-types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import { SaveProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

/** Um id malformado dá 404, como um id de outra pessoa: o cliente não aprende nada com ele. */
const ProjectId = () =>
  Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }));

@Controller('projects')
@UseGuards(RequireUserGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<Project[]> {
    return this.projects.list(userId);
  }

  @Get(':id')
  get(
    @CurrentUserId() userId: string,
    @ProjectId() id: string,
  ): Promise<Project> {
    return this.projects.get(userId, id);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body() dto: SaveProjectDto,
  ): Promise<Project> {
    return this.projects.create(userId, dto);
  }

  @Put(':id')
  update(
    @CurrentUserId() userId: string,
    @ProjectId() id: string,
    @Body() dto: SaveProjectDto,
  ): Promise<Project> {
    return this.projects.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @ProjectId() id: string,
  ): Promise<void> {
    return this.projects.remove(userId, id);
  }
}
