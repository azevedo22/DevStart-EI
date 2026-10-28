import {
  SkillGapResult,
  StackMatch,
  calculateSkillGap,
} from '@devstart/shared-types';
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import { ProfileService } from '../profile/profile.service';
import { ProjectsService } from '../projects/projects.service';

/**
 * Diagnóstico com os dados guardados do utilizador.
 * A pré-visualização sem conta continua em POST /skill-gap/preview (CatalogController).
 */
@Controller('skill-gap')
@UseGuards(RequireUserGuard)
export class SkillGapController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly profile: ProfileService,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  async forStack(
    @CurrentUserId() userId: string,
    @Query('stackId') stackId?: string,
  ): Promise<SkillGapResult> {
    if (!stackId) throw new BadRequestException('Indica a stack em ?stackId=');
    const stack = this.catalog.findStack(stackId);
    const [competencies, withProjects] = await this.load(userId);
    return calculateSkillGap(stack, competencies, withProjects);
  }

  /** Compatibilidade com todas as stacks, da mais próxima para a mais distante. */
  @Get('overview')
  async overview(@CurrentUserId() userId: string): Promise<StackMatch[]> {
    const [competencies, withProjects] = await this.load(userId);
    return this.catalog
      .findStacks()
      .map((stack) => {
        const r = calculateSkillGap(stack, competencies, withProjects);
        return {
          stackId: stack.id,
          title: stack.title,
          matchPercentage: r.matchPercentage,
          missingCount: r.missing.length + r.belowLevel.length,
        };
      })
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  private load(userId: string) {
    return Promise.all([
      this.profile.listCompetencies(userId),
      this.projects.competenciesWithProjects(userId),
    ]);
  }
}
